/**
 * The viewport's composition root: it wires the stage, the selection, the
 * transformer and the labels together, and it is the only thing here that knows
 * about application state.
 *
 * Everything it wires is imperative and lives as long as the canvas does, so it
 * is a plain object rather than a component. `viewport.jsx` owns one of these
 * and hands it what the signals say.
 */

import * as state from "../state.js";
import * as units from "../hideout/units.js";
import * as arrays from "./arrays.js";
import * as bounds from "./bounds.js";
import * as doodads from "./doodads.js";
import * as groups from "./groups.js";
import * as select from "./select.js";
import * as transform from "./transform.js";
import { Doodad } from "../hideout/model.js";
import { Labels } from "./labels.js";
import { Stage } from "./stage.js";

const SELECT_BUTTON = 0;

/**
 * How far a band may span and still be a click, in pixels. A press meant to be
 * a click carries a pixel or two of the hand with it.
 */
const CLICK_SLOP = 3;

/**
 * How far each placement of a run lands from the one before, in doodad units.
 * The gizmo is 6 across, so a step of 4 overlaps and still leaves every doodad
 * of a run its own edge to be grabbed by.
 */
const CASCADE_STEP = 4;

/** A doodad the editor places, before the player has said anything else about it. */
const PLACED_ROTATION = 0;
const PLACED_VARIATION = 0;

export class Scene {
  constructor(container) {
    this.container = container;
    this.stage = new Stage(container);
    this.nodes = [];
    this.groups = new Map();
    this.layers = [];
    this.generated = new Set();
    this.outline = null;
    this.outlineRequest = 0;
    this.placement = null;
    this.highlighted = null;

    // Selecting happens in screen pixels: the band is a screen gesture, and
    // `getClientRect` measures a node where the player sees it, however the
    // view is zoomed or turned. A turned doodad therefore answers with the
    // upright box around it, which is the generous side to err on.
    this.selection = new select.Selection((node) => node.getClientRect());
    this.selection.addEventListener("changed", this.onSelectionChanged);

    this.transform = new transform.Transform(this.stage.overlay);
    this.transform.addEventListener("begin", this.onMoveBegun);
    this.transform.addEventListener("moving", this.onMoving);
    this.transform.addEventListener("changed", this.onMoved);

    this.arrays = new arrays.Gizmo(this.stage.overlay);
    this.arrays.addEventListener("changed", this.onArrayChanged);

    // The arrays a layer group carries along with the selection, drawn in the
    // overlay. They name their layers and read the parameters through this, so
    // they point at the array rather than at a copy of it. see `arrays.Movers`.
    this.movers = new arrays.Movers(this.stage.overlay, (layer) =>
      state.hideoutDocument.value?.findGenerator(layer),
    );

    this.labels = new Labels((published) => {
      state.labels.value = published;
    });

    this.stage.addEventListener("viewchanged", this.onViewChanged);
    this.stage.konva.on("mousedown", this.onBandStart);
    container.addEventListener("keydown", this.onKeyDown);
  }

  destroy() {
    this.endBand();
    state.band.value = null;
    this.container.removeEventListener("keydown", this.onKeyDown);
    this.labels.destroy();
    this.stage.destroy();
  }

  resize(width, height) {
    this.stage.resize(width, height);
  }

  // -- what the signals ask for ---------------------------------------------

  load(hideout) {
    this.selection.clear();
    this.movers.destroy();
    this.transform.setNodes([]);
    this.arrays.show(null);
    this.placement = null;
    this.highlighted = null;
    for (const node of this.nodes) {
      node.destroy();
    }
    for (const group of this.groups.values()) {
      group.destroy();
    }
    this.groups = new Map();

    this.nodes = (hideout?.doodads ?? []).map(doodads.create);
    this.showLayers(hideout?.layers ?? []);
    this.stage.fit(doodads.boundingRectangle(this.nodes));
  }

  /**
   * Draws the layers as they now stand: their groups, their flags, their order,
   * their colours, and which group each node belongs in.
   *
   * One method for all of it because a layer edit can be several of those at
   * once -- deleting a layer moves its doodads and drops a group -- and because
   * the sidebar publishes one signal for every kind of change.
   */
  showLayers(layers) {
    this.layers = layers;
    this.generated = generatedLayers();
    this.syncNodes();
    this.groups = groups.sync(
      this.stage.doodads,
      this.groups,
      layers,
      this.nodes,
      this.generated,
    );
    this.colorNodes();
    this.selection.discard(this.unselectableNodes());
    // A layer that has gone, or an array that has been detached, takes its
    // proxy with it. The set itself is the sidebar's to say -- `moveArrays`.
    if (this.movers.keepOnly(this.generated)) this.attachTransform();
    this.refreshLabels();
  }

  /**
   * Every node in the colour of the layer its doodad is in.
   *
   * Every node and not the ones that moved, a layer edit being one signal
   * whatever it changed. A node already wearing its colour is left alone, so
   * the walk costs a comparison per doodad. see `doodads.setColor`.
   *
   * After `groups.sync`, which refuses a node whose layer is gone.
   */
  colorNodes() {
    for (const node of this.nodes) {
      doodads.setColor(node, this.layerOf(node).color);
    }
  }

  /**
   * The drawing brought into step with the document's doodads, whichever way it
   * has moved: the ones that have left destroyed, the ones that have arrived
   * drawn.
   *
   * Neither direction is a gesture the viewport performed -- the sidebar takes
   * doodads out and puts them in -- so this is where the drawing hears about
   * them. Afterwards every node has a doodad in a layer, which is what
   * `groups.sync` insists on.
   */
  syncNodes() {
    const held = state.hideoutDocument.value?.doodads ?? [];
    this.dropGoneNodes(new Set(held));
    this.drawNewNodes(held);
  }

  dropGoneNodes(held) {
    const gone = this.nodes.filter((node) => !held.has(node.doodad));
    if (gone.length === 0) return;

    this.selection.discard(gone);
    for (const node of gone) {
      node.destroy();
    }
    this.nodes = this.nodes.filter((node) => held.has(node.doodad));
  }

  drawNewNodes(held) {
    const drawn = new Set(this.nodes.map((node) => node.doodad));
    const added = held.filter((doodad) => !drawn.has(doodad));
    if (added.length === 0) return;

    this.nodes = [...this.nodes, ...added.map(doodads.create)];
  }

  layerOf(node) {
    return this.layers.find((layer) => layer.id === node.doodad.layer);
  }

  /**
   * Whether a node is the player's to select. An array's doodads are not: they
   * are derived, and detaching the layer is what makes them ordinary.
   */
  selectableNode(node) {
    return groups.selectable(
      this.layerOf(node),
      this.generated.has(node.doodad.layer),
    );
  }

  selectableNodes() {
    return this.nodes.filter((node) => this.selectableNode(node));
  }

  unselectableNodes() {
    return this.nodes.filter((node) => !this.selectableNode(node));
  }

  visibleNodes() {
    return this.nodes.filter((node) => this.layerOf(node)?.visible);
  }

  /**
   * Draws the outline for a hideout type. Asynchronous, so a fast run through
   * the dropdown could land an earlier outline after a later one; the request
   * number is what stops that.
   */
  async showBounds(hash) {
    const request = ++this.outlineRequest;
    const outline = await bounds.load(hash);
    if (request !== this.outlineRequest) return;

    this.outline?.destroy();
    this.outline = outline;
    if (outline) this.stage.static.add(outline);
  }

  /**
   * Selects the nodes of the given doodads, as the sidebar asked.
   *
   * Hidden and locked layers are skipped, for the same reason the band skips
   * them: a selection the player cannot see or move is a selection that only
   * surprises them later.
   */
  selectDoodads(doodads) {
    const wanted = new Set(doodads);
    this.selection.set(
      this.selectableNodes().filter((node) => wanted.has(node.doodad)),
    );
  }

  /**
   * Colours the doodad the sidebar is pointing at, and puts back the one it was
   * pointing at before.
   *
   * The previous node is put back only if it is still drawn -- a doodad can be
   * deleted while its row is under the pointer -- which is also why the
   * highlight is looked up afresh rather than remembered.
   */
  highlightDoodad(doodad) {
    const node = this.nodes.find((drawn) => drawn.doodad === doodad) ?? null;
    if (node === this.highlighted) return;

    if (this.highlighted !== null && this.nodes.includes(this.highlighted)) {
      doodads.setHighlighted(this.highlighted, false);
    }
    this.highlighted = node;
    if (node !== null) doodads.setHighlighted(node, true);
  }

  /**
   * Places a doodad the palette named, and selects it.
   *
   * The document's array gets the doodad and the scene gets a node for it: a
   * new doodad is one object in one array, the same as a loaded one.
   * `showLayers` puts the node in the group of the layer it names.
   *
   * It becomes the selection because placing and then moving is one gesture; a
   * doodad that has to be found again is a doodad placed twice.
   */
  placeDoodad({ hash, name }) {
    const hideout = state.hideoutDocument.value;
    if (!hideout) return;

    const doodad = new Doodad(
      name,
      {
        hash: Number(hash),
        ...this.nextPlacement(),
        r: PLACED_ROTATION,
        fv: PLACED_VARIATION,
      },
      state.activeLayer.value,
    );
    hideout.doodads.push(doodad);
    state.doodadCount.value = hideout.doodads.length;

    const node = doodads.create(doodad);
    this.nodes.push(node);
    this.showLayers(this.layers);
    this.selection.set([node]);
  }

  /**
   * Where the next placement goes: the middle of the view, or a step on from
   * the last one when the view has not moved since.
   *
   * Eight double-clicks at one coordinate is a stack nobody can pull apart, and
   * the middle of the view is the only place the first can go -- the palette
   * says nothing about where. Moving the view is how a player says the run is
   * over, which is the gesture they would make anyway.
   */
  nextPlacement() {
    const centre = units.fromStage(
      this.stage.contentAt(this.stage.middleOfView()),
    );
    const at = this.cascadesFrom(centre)
      ? {
          x: this.placement.at.x + CASCADE_STEP,
          y: this.placement.at.y + CASCADE_STEP,
        }
      : centre;

    this.placement = { centre, at };
    return at;
  }

  cascadesFrom(centre) {
    return (
      this.placement !== null &&
      this.placement.centre.x === centre.x &&
      this.placement.centre.y === centre.y
    );
  }

  // -- arrays ---------------------------------------------------------------

  /**
   * Raises the gizmo of the array in a layer, or puts it away for `null`.
   *
   * A layer id rather than the generator itself: which array is being edited is
   * the sidebar's to say, and where its parameters live is the document's.
   */
  showArray(layer) {
    const document_ = state.hideoutDocument.value;
    this.arrays.show(layer === null ? null : document_?.findGenerator(layer));
  }

  /**
   * The arrays that move with the selection, as layer ids: a layer group's, or
   * none.
   *
   * Their proxies join the selection in the box, see `arrays.Movers`. An id
   * naming no array is skipped rather than refused: the sidebar names a group's
   * layers, and which carry a generator is this side's question.
   */
  moveArrays(layers) {
    this.movers.show(layers);
    this.attachTransform();
  }

  /** The box over what it moves: the selected doodads, and the riding arrays. */
  attachTransform() {
    this.transform.setNodes(this.selection.nodes, this.movers.nodes);
  }

  onMoveBegun = () => {
    this.movers.begin();
  };

  /**
   * A step of a move: the labels follow the doodads, and every riding array is
   * regenerated where the gesture has now put it.
   *
   * Live, the way an array's own handles are: an array is its doodads, so there
   * is nothing else to judge a drag by. see `regenerateArray`.
   */
  onMoving = () => {
    this.refreshLabels();
    for (const layer of this.movers.follow()) {
      this.regenerateArray(layer);
    }
  };

  /** The same, and then the proxies back onto the shapes they now stand for. */
  onMoved = () => {
    this.onMoving();
    this.movers.redraw();
  };

  /**
   * An array's doodads brought back into step with its parameters, live.
   *
   * Nodes are moved, not replaced: a regenerated doodad is the same kind of
   * thing in a slightly different place, which is `doodads.place`. Building a
   * few hundred `Konva.Path` nodes per frame of a drag is the cost issues/0041
   * was about. Only a change in the *count* adds or destroys any.
   */
  onArrayChanged = (event) => {
    this.regenerateArray(event.detail.layer);
    // The sidebar is showing the numbers this gesture has just rewritten.
    state.arrayMoved.value++;
  };

  /**
   * The arrays the sidebar has rewritten: their doodads regenerated, and the
   * gizmo drawn again from parameters that may be a different object -- changing
   * a type builds new ones, see `model.replaceGenerator`.
   *
   * The gizmo is drawn for whatever the state now says is being worked on
   * rather than for a layer named here, so an edit landing beside a change of
   * layer cannot raise handles over the wrong array. The proxies are redrawn
   * for the same reason: aligning a group moves arrays standing in the box.
   */
  refreshArrays(layers) {
    this.showArray(state.editedArray.value);
    for (const layer of layers) {
      this.regenerateArray(layer);
    }
    this.movers.redraw();
  }

  regenerateArray(layer) {
    const document_ = state.hideoutDocument.value;
    document_.regenerate(layer);

    const held = this.nodes.filter((node) => node.doodad.layer === layer);
    const wanted = document_.doodadsIn(layer);
    reuseNodes(held, wanted);
    if (held.length !== wanted.length) {
      this.replaceNodesOf(layer, held, wanted);
    }
    this.refreshLabels();
  }

  /**
   * The layer's node list after a regeneration changed how many doodads it
   * holds: the surplus destroyed, the shortfall built, and `showLayers` left to
   * put the new ones in the right group.
   */
  replaceNodesOf(layer, held, wanted) {
    for (const node of held.slice(wanted.length)) {
      node.destroy();
    }
    this.nodes = [
      ...this.nodes.filter((node) => node.doodad.layer !== layer),
      ...held.slice(0, wanted.length),
      ...wanted.slice(held.length).map(doodads.create),
    ];
    state.doodadCount.value = state.hideoutDocument.value.doodads.length;
    this.showLayers(this.layers);
  }

  showLabels(enabled) {
    this.labels.setEnabled(enabled);
  }

  showGrid(enabled) {
    this.stage.showGrid(enabled);
  }

  // -- rubber band ----------------------------------------------------------

  onBandStart = (event) => {
    if (event.evt.button !== SELECT_BUTTON) return;
    if (this.grabbedSelection(event)) return;

    // Keyboard shortcuts are bound to the container, not to the window, so the
    // container has to take focus for them to arrive -- wiki issue 0010.
    this.container.focus();
    this.bandOrigin = this.stage.konva.getPointerPosition();
    // Settled once for the gesture: a layer cannot be locked or hidden while
    // the button is down, and a hideout runs to hundreds of nodes per move.
    this.candidates = this.selectableNodes();
    this.selection.begin(event.evt);
    state.band.value = select.rectangle(this.bandOrigin, this.bandOrigin);

    // On the window, so that a drag leaving the canvas still tracks and, above
    // all, still ends.
    window.addEventListener("mousemove", this.onBandMove);
    window.addEventListener("mouseup", this.onBandEnd);
  };

  /**
   * Whether the left button belongs to the selection rather than to the band,
   * and starts the move if it does. There are no modes, so where the gesture
   * started is the whole of the answer -- wiki issue 0038.
   *
   * A handle always belongs to it, and so does anywhere inside the box: a
   * selection is moved by grabbing it, not by finding one of its doodads.
   * Konva's `shouldOverdrawWholeArea` is refused, see `transform.js`.
   *
   * Shift and Ctrl say "I am selecting", which keeps the click that deselects
   * working and leaves a band startable inside the box.
   */
  grabbedSelection(event) {
    if (this.transform.grips(event.target)) return true;
    // An array's own handles, which Konva is already dragging by the time this
    // runs: a band underneath one would select the hideout while it moved.
    if (this.arrays.grips(event.target)) return true;
    if (event.evt.shiftKey || event.evt.ctrlKey) return false;
    // Konva starts this one itself, and starting a second is a second drag.
    if (this.transform.holds(event.target)) return true;

    if (!this.transform.encloses(this.stage.konva.getPointerPosition())) {
      return false;
    }
    this.transform.startDragging(event);
    return true;
  }

  onBandMove = (event) => {
    const area = this.bandArea(event);
    state.band.value = area;
    this.selection.drag(area, this.candidatesIn(area));
  };

  onBandEnd = (event) => {
    const area = this.bandArea(event);
    this.selection.drag(area, this.candidatesIn(area));
    this.selection.end();
    state.band.value = null;
    this.endBand();
  };

  /**
   * What a band of this size may take: everything selectable, or -- for a band
   * with no size, which is a click -- only the doodad actually under the
   * pointer.
   *
   * The two ask different questions. A sweep asks what is under the region, and
   * the upright box around each doodad is the generous side to err on. A click
   * asks which doodad is pointed at, and a turned gizmo's box is much bigger
   * than the drawing -- in a dense hideout several cover any given pixel. So a
   * click is put to the gizmos themselves.
   */
  candidatesIn(area) {
    if (area.width > CLICK_SLOP || area.height > CLICK_SLOP) {
      return this.candidates;
    }
    const picked = this.stage.konva.getIntersection(
      this.stage.konva.getPointerPosition(),
    );
    // Whatever is topmost may be a handle, or a doodad in a locked layer.
    return this.candidates.includes(picked) ? [picked] : [];
  }

  /**
   * The band in viewport pixels. `setPointersPositions` is what lets a drag
   * that has left the canvas keep reporting where it is.
   */
  bandArea(event) {
    this.stage.konva.setPointersPositions(event);
    return select.rectangle(
      this.bandOrigin,
      this.stage.konva.getPointerPosition(),
    );
  }

  endBand() {
    window.removeEventListener("mousemove", this.onBandMove);
    window.removeEventListener("mouseup", this.onBandEnd);
  }

  onSelectionChanged = (event) => {
    const { added, removed, settled } = event.detail;
    for (const node of added) {
      doodads.setSelected(node, true);
    }
    for (const node of removed) {
      doodads.setSelected(node, false);
    }
    if (!settled) return;

    this.attachTransform();
    state.selection.value = this.selection.nodes.map((node) => node.doodad);
  };

  // -- keyboard -------------------------------------------------------------

  onKeyDown = (event) => {
    switch (event.key) {
      case "Delete":
        this.deleteSelection();
        break;
      case "Escape":
        this.selection.clear();
        break;
      case "f":
        this.stage.fit(doodads.boundingRectangle(this.selection.nodes));
        break;
      case "g":
        this.stage.alignToGame();
        break;
      case "h":
        state.showHelp.value = true;
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  /**
   * Deletion removes doodads from the one array that holds them: no second
   * collection to survive in, no mode change. see
   * decisions/transform-control-reparenting.
   */
  deleteSelection() {
    const nodes = this.selection.nodes;
    if (nodes.length === 0) return;

    const deleted = new Set(nodes.map((node) => node.doodad));
    const hideout = state.hideoutDocument.value;
    hideout.doodads = hideout.doodads.filter((doodad) => !deleted.has(doodad));
    state.doodadCount.value = hideout.doodads.length;

    this.selection.discard(nodes);
    this.nodes = this.nodes.filter((node) => !deleted.has(node.doodad));
    for (const node of nodes) {
      node.destroy();
    }
    this.refreshLabels();
  }

  /**
   * The nodes are handed over as a function, not a list: a view that moves asks
   * for labels several times a frame, and `visibleNodes` walks the whole
   * hideout.
   */
  refreshLabels = () => {
    this.labels.refresh(() => this.visibleNodes(), this.stage.konva);
  };

  /**
   * The gizmos that are not drawn in screen pixels have to be told the zoom.
   * The transformers work it out themselves -- see `viewport/transform.js`.
   */
  onViewChanged = () => {
    this.arrays.viewScaled(this.stage.konva.scaleX());
    this.refreshLabels();
  };
}

/** The ids of the layers whose doodads an array writes. */
function generatedLayers() {
  const generators = state.hideoutDocument.value?.generators ?? [];
  return new Set(generators.map((array) => array.layer));
}

/** Regenerated doodads onto the nodes that were drawing the previous ones. */
function reuseNodes(nodes, doodads_) {
  for (const [index, node] of nodes.slice(0, doodads_.length).entries()) {
    node.doodad = doodads_[index];
    doodads.place(node);
  }
}
