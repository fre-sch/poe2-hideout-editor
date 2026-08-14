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
 * `Box` is the transformer itself and `Transform` is what it does to a
 * selection of doodads. The split is not decoration: `viewport/arrays.js` needs
 * the same box around an array's shape and none of the doodad arithmetic below
 * -- wiki issue 0034.
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
 * What every box in the editor agrees about, whatever it holds.
 *
 * The array's box takes the same snaps and the same refusal to flip as the
 * selection's -- wiki issue 0034 -- because they are the same gesture on the
 * same screen, and a player who has learnt one has learnt the other.
 */
const BOX_DEFAULTS = {
  rotationSnaps: ROTATION_SNAPS,
  rotationSnapTolerance: ROTATION_SNAP_TOLERANCE,
  // Mirroring would leave every gizmo pointing the way it was while the
  // arrangement turned inside out, and a doodad has no mirror to save.
  flipEnabled: false,
  // Stretching one axis is the point of having the anchors at all, so the
  // corners are free too; Shift is Konva's own way to ask for the ratio.
  keepRatio: false,
  // Dragging inside the box moves what it holds, but the scene decides that
  // rather than Konva. The area Konva would claim is a shape in the overlay
  // layer, above the doodads, so it would swallow the click that takes a doodad
  // back out of the selection.
  shouldOverdrawWholeArea: false,
  ignoreStroke: true,
};

/**
 * The transformer, measuring itself at most once a frame.
 *
 * Konva remeasures the box for every node whose absolute transform changed, and
 * one pan changes all of them at once: ten selected doodads measured the box ten
 * times a frame, each measurement walking all ten nodes -- wiki issue 0041. All
 * of those asks describe the same frame, so the first one schedules the work and
 * the rest are it.
 *
 * A frame and not a timer, and none of the asks is dropped: the callback runs
 * before the browser paints, so the box is still drawn where it belongs in the
 * frame the view moved in.
 *
 * **The handles need nothing done about the zoom.** `Konva.Transformer`
 * overrides `getAbsoluteTransform` to return its own transform, so it measures
 * the nodes in screen pixels and draws itself in screen pixels however the stage
 * is scaled or turned. Dividing the anchor size by the stage's scale is
 * therefore not a fix but the bug: it makes handles that grow as the view zooms
 * out.
 */
export class Box extends Konva.Transformer {
  constructor(config) {
    super({ ...BOX_DEFAULTS, ...config });
    // Here rather than in the config because it needs the transformer it
    // belongs to, and Konva calls it with no receiver of its own.
    this.anchorDragBoundFunc((_was, wants) => this.inside(wants));
  }

  /**
   * `frame` is undefined until the first ask, and no class field declares it:
   * Konva's constructor may update, and a field initialiser runs after that and
   * would drop the frame it scheduled.
   */
  update() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => this.flush());
  }

  /** The scheduled measurement, now. */
  flush() {
    if (!this.frame) return;
    cancelAnimationFrame(this.frame);
    this.frame = null;
    super.update();
  }

  /**
   * Konva measures a grab from where the anchor already is, so a scheduled
   * measurement has to land before a gesture starts.
   */
  _handleMouseDown(event) {
    this.flush();
    super._handleMouseDown(event);
  }

  /**
   * The box's own space, in screen pixels -- and the one place it is asked for.
   *
   * The box measures itself a frame at a time, so anything reading where it *is*
   * has to let a scheduled measurement land first. Reading it is rarer than
   * moving it: these are gestures, and they arrive one at a time.
   */
  space() {
    this.flush();
    return this.getAbsoluteTransform();
  }

  /**
   * An anchor position, in screen pixels, brought back inside the floor.
   *
   * The box is turned with the view, so "nearer the opposite side" is a
   * question in the box's own space and the point has to be asked there. Its
   * `getAbsoluteTransform` is that space -- it returns its own transform and
   * nothing above it, which is also why the box is in screen pixels to begin
   * with.
   *
   * The rotate handle is left alone. It is dragged around the outside of the
   * box, where nothing it does is a collapse.
   */
  inside(point) {
    const anchor = this.getActiveAnchor();
    if (anchor === "rotater") return point;

    const space = this.space();
    const box = { width: this.width(), height: this.height() };
    return space.point(
      clamped(anchor, box, space.copy().invert().point(point)),
    );
  }

  /**
   * Whether a point in screen pixels is inside the box. The box is turned with
   * the view, so the question is asked in the box's own space, where it spans
   * `0..width` across and `0..height` down.
   */
  encloses(point) {
    const at = this.space().copy().invert().point(point);
    return (
      at.x >= 0 && at.x <= this.width() && at.y >= 0 && at.y <= this.height()
    );
  }

  /** Whether a node is one of the handles. Anchors are the box's children. */
  grips(node) {
    return node.getParent() === this;
  }

  /**
   * The corner a resize turns about: the one across the box from the anchor
   * being dragged, in screen pixels.
   *
   * A side anchor leaves one axis alone, and that axis's coordinate here is
   * whichever end of it -- the end that does not move is not worth choosing
   * between.
   */
  corner(anchor) {
    return this.space().point({
      x: anchor.includes("left") ? this.width() : 0,
      y: anchor.includes("top") ? this.height() : 0,
    });
  }

  /** Which gesture the anchors are running: the rotate handle, or the rest. */
  resizing() {
    const anchor = this.getActiveAnchor();
    return Boolean(anchor) && anchor !== "rotater";
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.frame = null;
    return super.destroy();
  }
}

/**
 * Dispatches `begin` as a gesture starts, `moving` while it is under way, and
 * `changed` once it has been written back to the domain doodads. All three
 * matter: the labels have to follow the doodads across the drag rather than
 * catch up when it ends, and a rider reads its motion against where it stood
 * when the gesture began.
 */
export class Transform extends EventTarget {
  constructor(layer) {
    super();

    this.konva = new Box();
    layer.add(this.konva);

    this.nodes = [];
    this.riders = [];
    this.written = new Set();
    this.step = null;
    this.pinned = null;
    this.konva.on("dragstart", this.begin);
    this.konva.on("dragmove", this.moving);
    this.konva.on("transformstart", this.begin);
    this.konva.on("transform", this.transforming);
    this.konva.on("dragend", this.commit);
    this.konva.on("transformend", this.commit);
  }

  /**
   * The selection, drawn and draggable, and the nodes riding along with it.
   *
   * Dragging is enabled on the nodes rather than on the box: it is what Konva
   * proxies a whole-selection drag through, and leaving it off everywhere else
   * is what stops a doodad nobody selected from being dragged by accident.
   *
   * **A rider is moved and not written back.** It stands for something that is
   * not a doodad -- an array, see `viewport/arrays.js` -- so `doodads.apply`
   * would have nothing to write into, and what happens to the thing it stands
   * for is whoever handed it over's business. Which is why the two lists are
   * two lists and not one with a flag.
   *
   * **Riders turn off the anchors.** Stretching a selection spreads doodads
   * apart, and there is no such thing as spreading an array apart -- resizing
   * its box changes its spacing, which is a different edit. One gesture cannot
   * mean both, so while anything is riding, the box moves and turns and does not
   * resize. See wiki/decisions/layer-groups.md.
   */
  setNodes(nodes, riders = []) {
    for (const node of [...this.nodes, ...this.riders]) {
      node.draggable(false);
    }
    this.nodes = nodes;
    this.riders = riders;
    // The same list as a set, for `movedDoodads`: that one runs per node on
    // every step of a resize, and a selection runs to hundreds of doodads.
    this.written = new Set(nodes);
    const all = [...nodes, ...riders];
    for (const node of all) {
      node.draggable(true);
    }
    this.konva.nodes(all);
    this.konva.resizeEnabled(riders.length === 0);
    this.konva.visible(all.length > 0);
  }

  /** Whether a node is one the box would move. */
  holds(node) {
    return this.nodes.includes(node) || this.riders.includes(node);
  }

  /** Whether a point in screen pixels is inside the box around the selection. */
  encloses(point) {
    return this.konva.nodes().length > 0 && this.konva.encloses(point);
  }

  /**
   * Starts moving the selection from a gesture that did not land on a doodad.
   *
   * Konva moves a selection by dragging one of its nodes and letting the
   * transformer carry the rest, which is what happens when a player grabs a
   * gizmo. Any node will do to start it -- a rider as readily as a doodad,
   * which is what moves a group holding no doodads at all: a drag is a delta,
   * not a destination, so the one that is grabbed does not jump to the pointer.
   */
  startDragging(event) {
    this.konva.nodes()[0].startDrag(event);
  }

  /** Whether a node is one of the handles. Anchors are the box's children. */
  grips(node) {
    return this.konva.grips(node);
  }

  /**
   * The anchor is read once here and remembered for the gesture. Konva swaps
   * the one it is holding around when a box is dragged past itself -- `left`
   * becomes `right` -- and which corner is standing still must not swap with
   * it.
   */
  begin = () => {
    this.step = null;
    this.pinned = null;
    this.dispatchEvent(new CustomEvent("begin"));
    if (!this.konva.resizing()) return;

    const anchor = this.konva.getActiveAnchor();
    this.pinned = { anchor, at: this.konva.corner(anchor) };
  };

  /**
   * Puts the far corner back where the resize started.
   *
   * Konva holds the far edge of the *box* still, and the box is the doodads'
   * spread plus one gizmo: the doodad nearest that edge sits half a gizmo
   * inside it, so scaling its position by `k` lands its edge `(1 - k)` half
   * gizmos outside where it was. The far edge drifts, by less than the dragged
   * one moves, which is the whole of the effect -- and it accumulates over a
   * drag, since nothing puts it back.
   *
   * The selection is moved rigidly, so nothing about the spacing this step
   * worked out changes.
   */
  repin() {
    const drifted = this.konva.corner(this.pinned.anchor);
    const across = this.pinned.at.x - drifted.x;
    const down = this.pinned.at.y - drifted.y;
    if (across === 0 && down === 0) return;

    for (const node of this.konva.nodes()) {
      const at = node.absolutePosition();
      node.absolutePosition({ x: at.x + across, y: at.y + down });
    }
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

    // Unscale first: the box is measured off the nodes, so the corner cannot be
    // read until they are the size they are going to be.
    if (this.pinned) {
      this.unscaleNodes();
      this.repin();
    }
    this.moving();
  };

  /**
   * Takes back everything a resize did to a node except where it put it.
   *
   * Every step, not once at the end, because Konva measures the box off the
   * nodes: a scale left on them would be measured again on the next step and
   * multiply. Undone each step, the box measures how far apart the doodads are,
   * which is exactly the thing the anchors are stretching.
   */
  unscaleNodes() {
    for (const node of this.movedDoodads()) {
      doodads.unscale(node);
    }
  }

  /**
   * The doodad nodes the box actually wrote to: the transformer's own list, not
   * the one handed to `setNodes` -- it filters what it was given -- and the
   * riders left out of it, they being nothing `doodads.js` can measure.
   */
  movedDoodads() {
    return this.konva.nodes().filter((node) => this.written.has(node));
  }

  commit = () => {
    this.pinned = null;
    for (const node of this.movedDoodads()) {
      doodads.apply(node);
    }
    // The nodes just snapped onto the grid, so the box around them moved.
    this.konva.forceUpdate();
    this.dispatchEvent(new CustomEvent("changed"));
  };
}
