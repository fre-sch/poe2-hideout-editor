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

    this.labels = new Labels((published) => {
      state.labels.value = published;
    });

    this.stage.addEventListener("viewchanged", this.refreshLabels);
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
    this.groups = groups.sync(
      this.stage.doodads,
      this.groups,
      layers,
      this.nodes,
    );
    this.selection.discard(this.unselectableNodes());
    this.refreshLabels();
  }

  layerOf(node) {
    return this.layers.find((layer) => layer.id === node.doodad.layer);
  }

  selectableNodes() {
    return this.nodes.filter((node) => groups.selectable(this.layerOf(node)));
  }

  unselectableNodes() {
    return this.nodes.filter((node) => !groups.selectable(this.layerOf(node)));
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

  showLabels(enabled) {
    this.labels.setEnabled(enabled);
  }

  showGrid(enabled) {
    this.stage.showGrid(enabled);
  }

  // -- rubber band ----------------------------------------------------------

  onBandStart = (event) => {
    if (event.evt.button !== SELECT_BUTTON) return;
    if (this.manipulating(event)) return;

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
   * Whether the left button belongs to the box rather than to the band. There
   * are no modes, so the answer is what the gesture started on -- wiki issue
   * 0038.
   *
   * A handle always is; a doodad already selected is, because dragging one is
   * how the whole selection is moved. Shift and Ctrl say "I am selecting"
   * either way, which is what keeps a doodad inside the selection reachable to
   * be taken out of it again.
   */
  manipulating(event) {
    if (this.transform.grips(event.target)) return true;
    if (event.evt.shiftKey || event.evt.ctrlKey) return false;
    return this.transform.holds(event.target);
  }

  onBandMove = (event) => {
    const area = this.bandArea(event);
    state.band.value = area;
    this.selection.drag(area, this.candidates);
  };

  onBandEnd = (event) => {
    this.selection.drag(this.bandArea(event), this.candidates);
    this.selection.end();
    state.band.value = null;
    this.endBand();
  };

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

  refreshLabels = () => {
    this.labels.refresh(this.visibleNodes(), this.stage.konva);
  };
}
