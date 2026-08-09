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
 * arriving there.
 */
const MINIMUM_BOX = 24;

/**
 * The box a resize step may have: what it asked for, unless that is a collapse.
 *
 * A box already under the floor -- everything is, at a far enough zoom out --
 * may still be grown, or nothing under the floor could ever be resized at all.
 *
 * A negative side is a collapse whatever its size, and not a small one: it is
 * a box dragged out the far side of zero, and the doodads went through the
 * same point on the way. `flipEnabled` is off, so Konva keeps the sign off the
 * nodes' own scale, but the box swings through zero regardless -- and it is the
 * zero that does the damage, not the mirroring. Comparing how big a side is
 * rather than what it is misses a drag fast enough to jump the floor.
 */
export function bounded(was, wants) {
  if (collapsing(was.width, wants.width)) return was;
  if (collapsing(was.height, wants.height)) return was;
  return wants;
}

function collapsing(was, wants) {
  return wants < MINIMUM_BOX && wants < was;
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
      boundBoxFunc: bounded,
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
