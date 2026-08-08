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
import * as bounds from "./bounds.js";
import * as doodads from "./doodads.js";
import * as select from "./select.js";
import * as transform from "./transform.js";
import { Labels } from "./labels.js";
import { Stage } from "./stage.js";

const SELECT_BUTTON = 0;

export class Scene {
  constructor(container) {
    this.container = container;
    this.stage = new Stage(container);
    this.nodes = [];
    this.outline = null;
    this.outlineRequest = 0;
    this.mode = transform.SELECT;

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
    for (const node of this.nodes) {
      node.destroy();
    }

    this.nodes = (hideout?.doodads ?? []).map(doodads.create);
    if (this.nodes.length > 0) this.stage.doodads.add(...this.nodes);
    this.stage.fit(doodads.boundingRectangle(this.nodes));
    this.refreshLabels();
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

  setMode(mode) {
    this.mode = mode;
    this.transform.setMode(mode);
  }

  showLabels(enabled) {
    this.labels.setEnabled(enabled);
  }

  // -- rubber band ----------------------------------------------------------

  /**
   * Selecting is a select-mode gesture only, as it was in 3D: in translate and
   * rotate mode the left button belongs to the transformer.
   */
  onBandStart = (event) => {
    if (event.evt.button !== SELECT_BUTTON) return;
    if (this.mode !== transform.SELECT) return;

    // Keyboard shortcuts are bound to the container, not to the window, so the
    // container has to take focus for them to arrive -- wiki issue 0010.
    this.container.focus();
    this.bandOrigin = this.stage.konva.getPointerPosition();
    this.selection.begin(event.evt);
    state.band.value = select.rectangle(this.bandOrigin, this.bandOrigin);

    // On the window, so that a drag leaving the canvas still tracks and, above
    // all, still ends.
    window.addEventListener("mousemove", this.onBandMove);
    window.addEventListener("mouseup", this.onBandEnd);
  };

  onBandMove = (event) => {
    const area = this.bandArea(event);
    state.band.value = area;
    this.selection.drag(area, this.nodes);
  };

  onBandEnd = (event) => {
    this.selection.drag(this.bandArea(event), this.nodes);
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
      case "1":
        state.viewportMode.value = transform.SELECT;
        break;
      case "2":
        state.viewportMode.value = transform.TRANSLATE;
        break;
      case "3":
        state.viewportMode.value = transform.ROTATE;
        break;
      case "f":
        this.stage.fit(doodads.boundingRectangle(this.selection.nodes));
        break;
      case "g":
        this.stage.alignToGame();
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
    this.labels.refresh(this.nodes, this.stage.konva);
  };
}
