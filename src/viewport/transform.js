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
 * arrangement out" -- something the game's own editor cannot do at all. The
 * price of measuring spacing that way is that spacing multiplies, so `bounded`
 * is what stops a squeeze from reaching zero and staying there.
 *
 * **The handles need nothing done about the zoom.** `Konva.Transformer`
 * overrides `getAbsoluteTransform` to return its own transform, so it measures
 * the nodes in screen pixels and draws itself in screen pixels however the
 * stage is scaled or turned. Dividing the anchor size by the stage's scale is
 * therefore not a fix but the bug: it makes handles that grow as the view
 * zooms out.
 */

import Konva from "konva";

import * as doodads from "./doodads.js";

const ROTATION_SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];
const ROTATION_SNAP_TOLERANCE = 6;

/**
 * How small the box may be squeezed, in screen pixels.
 *
 * Not a matter of taste. The box measures how far apart the doodads are, and a
 * resize multiplies that distance -- so doodads squeezed onto one point are
 * doodads no later stretch can ever separate again, because every factor of
 * zero is zero. There is no undo to get out of it with.
 *
 * Konva's own floor is one pixel and is no help: it is the point where the box
 * has already collapsed, and it is reached by asking for it rather than by
 * arriving there. Twenty-four is a box still worth grabbing an anchor of.
 */
const MINIMUM_BOX = 24;

/**
 * Where an anchor may be dragged to, in the box's own space: no nearer the side
 * it is pulling against than the floor.
 *
 * The floor is held here, on the anchor, and not on the box `boundBoxFunc`
 * offers. By the time that is called Konva has already dealt with the flip --
 * it rewrites `_movingAnchorName` from `left` to `right` on the way past zero
 * -- so refusing the box there leaves the transformer holding an anchor the
 * player is not dragging. An anchor that never crosses is a flip that never
 * happens, and `flipEnabled` never comes into it.
 *
 * A box already under the floor -- every box is, at a far enough zoom out --
 * may still be grown but not shrunk, rather than being forced open to the
 * floor. Nothing is served by refusing to resize the hideout at the zoom that
 * shows all of it.
 */
export function clamped(anchor, box, point) {
  return {
    x: horizontally(anchor, box.width, point.x),
    y: vertically(anchor, box.height, point.y),
  };
}

function horizontally(anchor, width, x) {
  if (anchor.includes("left")) return Math.min(x, width - floor(width));
  if (anchor.includes("right")) return Math.max(x, floor(width));
  return x;
}

function vertically(anchor, height, y) {
  if (anchor.includes("top")) return Math.min(y, height - floor(height));
  if (anchor.includes("bottom")) return Math.max(y, floor(height));
  return y;
}

function floor(size) {
  return Math.min(MINIMUM_BOX, size);
}

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
    // Set here rather than above because it needs the transformer it belongs
    // to, and Konva calls it with no receiver of its own.
    this.konva.anchorDragBoundFunc((_was, wants) => this.insideBox(wants));

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

  /**
   * An anchor position, in screen pixels, brought back inside the floor.
   *
   * The box is turned with the view, so "nearer the opposite side" is a
   * question in the box's own space and the point has to be asked there. The
   * transformer's `getAbsoluteTransform` is that space -- it returns its own
   * transform and nothing above it, which is also why the box is in screen
   * pixels to begin with.
   *
   * The rotate handle is left alone. It is dragged around the outside of the
   * box, where nothing it does is a collapse.
   */
  insideBox(point) {
    const anchor = this.konva.getActiveAnchor();
    if (anchor === "rotater") return point;

    const space = this.konva.getAbsoluteTransform();
    const box = { width: this.konva.width(), height: this.konva.height() };
    const inside = clamped(anchor, box, space.copy().invert().point(point));
    return space.point(inside);
  }

  /** Whether a node is one the box would move. */
  holds(node) {
    return this.nodes.includes(node);
  }

  /** Whether a node is one of the handles. Anchors are the box's children. */
  grips(node) {
    return node.getParent() === this.konva;
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
    // The transformer's own list, not the one handed to `setNodes`: it filters
    // what it was given, and the nodes it wrote to are the nodes to undo.
    for (const node of this.konva.nodes()) {
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
