/**
 * The box and handles around the selection: moving, rotating and stretching it.
 *
 * There is no mode. The three.js editor had one because `TransformControls`
 * attached to a single object and each mode re-parented the selection into a
 * helper group -- see wiki/decisions/transform-control-reparenting.md, and the
 * two data-loss bugs it explains. `Konva.Transformer` takes a list of nodes and
 * re-parents nothing, so the reason for the modes went with the viewport that
 * needed them: the selection simply carries its box, wiki issue 0038.
 *
 * **Resizing moves doodads, it does not resize them.** A doodad has `hash`,
 * `x`, `y`, `r` and `fv` and no scale, so a scaled gizmo would be a gizmo that
 * lies about what will be saved. What the anchors are good for is the spacing:
 * `unscaleNodes` keeps the positions the transformer worked out and puts the
 * scale and the rotation back, which turns a corner drag into "spread this
 * arrangement out" -- something the game's own editor cannot do at all.
 */

import Konva from "konva";

import * as doodads from "./doodads.js";

const ROTATION_SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];
const ROTATION_SNAP_TOLERANCE = 6;

/**
 * The handles at zoom 1, in stage units. They are divided by the stage's scale
 * -- see `setZoom` -- so these are what they measure on screen at every zoom.
 */
const ANCHOR_SIZE = 10;
const ANCHOR_STROKE_WIDTH = 1;
const BORDER_STROKE_WIDTH = 1;
const ROTATE_ANCHOR_OFFSET = 30;

/**
 * Dispatches `moving` while a gesture is under way, and `changed` once it has
 * been written back to the domain doodads. Both matter: the labels have to
 * follow the doodads across the drag, not catch up when it ends.
 */
export class Transform extends EventTarget {
  constructor(layer) {
    super();

    this.konva = new Konva.Transformer({
      rotationSnaps: ROTATION_SNAPS,
      rotationSnapTolerance: ROTATION_SNAP_TOLERANCE,
      // Mirroring would leave every gizmo pointing the way it was while the
      // arrangement turned inside out, and a doodad has no mirror to save.
      flipEnabled: false,
      // Stretching one axis is the point of having the anchors at all, so the
      // corners are free too; Shift is Konva's own way to ask for the ratio.
      keepRatio: false,
      // The box is only ever as thick as its border, and a hideout is dense.
      // Off, so that the empty space inside a wide selection still bands.
      shouldOverdrawWholeArea: false,
      ignoreStroke: true,
    });
    layer.add(this.konva);

    this.nodes = [];
    this.step = null;
    this.konva.on("dragmove", this.moving);
    this.konva.on("transform", this.transforming);
    this.konva.on("dragend", this.commit);
    this.konva.on("transformend", this.commit);
  }

  /**
   * The selection, drawn and draggable.
   *
   * Dragging is enabled on the nodes rather than on the box: it is what Konva
   * proxies a whole-selection drag through, and leaving it off everywhere else
   * is what stops a doodad nobody selected from being dragged by accident.
   */
  setNodes(nodes) {
    for (const node of this.nodes) {
      node.draggable(false);
    }
    this.nodes = nodes;
    for (const node of nodes) {
      node.draggable(true);
    }
    this.konva.nodes(nodes);
    this.konva.visible(nodes.length > 0);
  }

  /** Whether a node is one the box would move. */
  holds(node) {
    return this.nodes.includes(node);
  }

  /** Whether a node is one of the handles. Anchors are the box's children. */
  grips(node) {
    return node.getParent() === this.konva;
  }

  /**
   * Keeps the handles the same size on screen.
   *
   * The box lives inside the stage, so that it lines up with the doodad grid
   * rather than with the screen, and the stage scales across a factor of 800.
   * Handles that grow with it are handles at one zoom and obstacles at another.
   */
  setZoom(scale) {
    this.konva.anchorSize(ANCHOR_SIZE / scale);
    this.konva.anchorStrokeWidth(ANCHOR_STROKE_WIDTH / scale);
    this.konva.borderStrokeWidth(BORDER_STROKE_WIDTH / scale);
    this.konva.rotateAnchorOffset(ROTATE_ANCHOR_OFFSET / scale);
    this.konva.forceUpdate();
  }

  moving = () => {
    this.dispatchEvent(new CustomEvent("moving"));
  };

  /**
   * Konva fires `transform` once per node, and all of those firings are the
   * same step of the same gesture -- the mouse event they carry is what says
   * so. Answering each of them would be quadratic in a selection that runs to
   * hundreds of doodads.
   */
  transforming = (event) => {
    if (event.evt && event.evt === this.step) return;
    this.step = event.evt;

    if (this.resizing()) this.unscaleNodes();
    this.moving();
  };

  /** Which gesture the anchors are running: the rotate handle, or the rest. */
  resizing() {
    const anchor = this.konva.getActiveAnchor();
    return Boolean(anchor) && anchor !== "rotater";
  }

  /**
   * Takes back everything a resize did to a node except where it put it.
   *
   * Every step, not once at the end, because Konva measures the box off the
   * nodes: a scale left on them would be measured again on the next step and
   * multiply. Undone each step, the box measures how far apart the doodads are,
   * which is exactly the thing the anchors are stretching.
   */
  unscaleNodes() {
    for (const node of this.nodes) {
      doodads.unscale(node);
    }
  }

  commit = () => {
    for (const node of this.konva.nodes()) {
      doodads.apply(node);
    }
    // The nodes just snapped onto the grid, so the box around them moved.
    this.konva.forceUpdate();
    this.dispatchEvent(new CustomEvent("changed"));
  };
}
