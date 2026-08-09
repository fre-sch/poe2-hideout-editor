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

    // Selecting happens in screen pixels: the band is a screen gesture, and
    // `getClientRect` measures a node where the player sees it, however the
    // view is zoomed or turned. A turned doodad therefore answers with the
    // upright box around it, which is the generous side to err on.
    this.selection = new select.Selection((node) => node.getClientRect());
    this.selection.addEventListener("changed", this.onSelectionChanged);

    this.transform = new transform.Transform(this.stage.overlay);
    this.transform.addEventListener("moving", this.refreshLabels);
    this.transform.addEventListener("changed", this.refreshLabels);

    this.arrays = new arrays.Gizmo(this.stage.overlay);
    this.arrays.addEventListener("changed", this.onArrayChanged);

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
    this.transform.setNodes([]);
    this.arrays.show(null);
    this.placement = null;
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
   * and which group each node belongs in.
   *
   * One method for all of it because a layer edit can be several of those at
   * once -- deleting a layer moves its doodads and drops a group -- and because
   * the sidebar publishes one signal for every kind of change.
   */
  showLayers(layers) {
    this.layers = layers;
    this.generated = generatedLayers();
    this.dropNodesOfGoneLayers(layers);
    this.groups = groups.sync(
      this.stage.doodads,
      this.groups,
      layers,
      this.nodes,
      this.generated,
    );
    this.selection.discard(this.unselectableNodes());
    this.refreshLabels();
  }

  /**
   * The nodes of a layer that is no longer there.
   *
   * Deleting a layer hands its doodads to another one and leaves nothing to
   * drop -- except for an array, which takes its doodads with it, and that
   * delete happens in the sidebar. So this is where the drawing hears about
   * them. Every other node keeps `groups.sync`'s guarantee that it has a group
   * to be drawn in.
   */
  dropNodesOfGoneLayers(layers) {
    const known = new Set(layers.map((layer) => layer.id));
    const gone = this.nodes.filter((node) => !known.has(node.doodad.layer));
    if (gone.length === 0) return;

    this.selection.discard(gone);
    for (const node of gone) {
      node.destroy();
    }
    this.nodes = this.nodes.filter((node) => known.has(node.doodad.layer));
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
   * Places a doodad the palette named, and selects it.
   *
   * The document's array gets the doodad and the scene gets a node for it, in
   * that order and nowhere else -- a new doodad is one object in one array, the
   * same as a loaded one. `showLayers` is what puts the node in the group of the
   * layer it names, so nothing here knows how a layer is drawn.
   *
   * It becomes the selection because placing and then moving is meant to be one
   * gesture; a doodad that has to be found again is a doodad placed twice.
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
   * the middle of the view is the only place the first one can go -- the palette
   * is a list of names and says nothing about where. Moving the view is how a
   * player says "that run is over", which is the same gesture they would make
   * anyway to place somewhere else.
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
   * An array's doodads brought back into step with its parameters, live.
   *
   * **Nodes are moved, not replaced.** Destroying and building a few hundred
   * `Konva.Path` nodes on every frame of a drag is the shape of the cost wiki
   * issue 0041 was about, and none of it is necessary: a regenerated doodad is
   * the same kind of thing in a slightly different place, which is what
   * `doodads.place` is for. Only a change in the *count* adds or destroys any,
   * and only then does the drawing have to be told about layers again.
   */
  onArrayChanged = (event) => {
    this.regenerateArray(event.detail.layer);
    // The sidebar is showing the numbers this gesture has just rewritten.
    state.arrayMoved.value++;
  };

  /**
   * An array the sidebar has rewritten: its doodads regenerated, and its gizmo
   * drawn again from parameters that may be a different object -- changing a
   * type builds new ones, see `model.replaceGenerator`.
   *
   * The gizmo is drawn for whatever the state says is being edited rather than
   * for the layer named here, and the two differ exactly once: **Close &
   * discard** restores an array and closes its sidebar in one action.
   */
  refreshArray(layer) {
    this.showArray(state.editedArray.value);
    this.regenerateArray(layer);
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
   * A handle always belongs to it, and so does anywhere inside the box, which
   * is a rectangle of empty floor as often as not: a selection is moved by
   * grabbing it, not by finding one of its doodads to grab. Konva offers that
   * as `shouldOverdrawWholeArea`, and it is refused -- the area it claims is a
   * shape above the doodads, and it would swallow the click that takes one of
   * them back out of the selection.
   *
   * Shift and Ctrl say "I am selecting", which is what keeps that click
   * working, and what leaves a band startable inside the box.
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
   * The two gestures ask different questions. A sweep asks what is under the
   * region, and answering it with the upright box around each doodad is the
   * generous side to err on. A click asks which doodad is being pointed at, and
   * the box is the wrong answer to that: a turned gizmo's box is much bigger
   * than the drawing, and in a dense hideout several of them cover any given
   * pixel. So a click is put to the gizmos themselves, and a player who wants
   * the generous answer has it a few pixels of sweep away.
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

    const nodes = this.selection.nodes;
    this.transform.setNodes(nodes);
    state.selection.value = nodes.map((node) => node.doodad);
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
   * Deletion removes doodads from the one array that holds them. There is no
   * second collection for them to survive in, which is wiki issue 0001, and no
   * mode change is involved, which is wiki issue 0005.
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
