/**
 * An array's gizmo: the outline its doodads sit on, and the handles that move,
 * rotate and scale it -- and, for the arrays that are only coming along, the
 * proxies that let a selection's box carry them (`Movers`, below).
 *
 * The outline is the generator's own polyline through `units.toStage`, so the
 * drawing cannot disagree with the placement and the axis swap is reasoned
 * about once. Nothing here draws an ellipse as a rotated `Konva.Ellipse`, which
 * would be a second opinion about where the doodads went.
 *
 * The parameters are the truth and the nodes are the drawing. Every gesture
 * writes the box or the ends, redraws the gizmo from them, and dispatches
 * `changed` -- no state in between for the two to drift apart in.
 *
 * The box is `transform.Box` rather than a plain `Konva.Transformer`: it
 * measures itself once a frame, refuses to flip, and snaps its rotation. see
 * `transform.js`, and issues/0041 for what the plain one costs on a pan.
 *
 * A line and a Bézier carry ends instead of a box, and get a handle per point
 * they hold. Which handles are up is read off the parameters rather than the
 * type, said once in `POINTS`.
 *
 * A gizmo is never serialized: it exists while the generator sidebar is open.
 */

import Konva from "konva";

import * as arrays from "../hideout/arrays.js";
import * as generator from "../hideout/generator.js";
import * as model from "../hideout/model.js";
import * as units from "../hideout/units.js";
import { Box } from "./transform.js";

const COLOR = "#FF66FF";
const HANDLE_FILL = "#301030";

/**
 * The points a shape can be dragged by, in handle order: where each one lives in
 * the parameters, and whether it is on the shape or pulling at it.
 *
 * A point the parameters do not carry has no handle, so this one table is what
 * makes a line two-handled and a Bézier four-handled.
 */
const POINTS = [
  { field: "ends", key: "start", control: false },
  { field: "ends", key: "end", control: false },
  { field: "controls", key: "first", control: true },
  { field: "controls", key: "second", control: true },
];

/** Which end each control belongs to, for the leash drawn between them. */
const LEASHES = [
  { from: 0, to: 2 },
  { from: 1, to: 3 },
];

/**
 * The endpoint handles and the outline's grab area, in screen pixels.
 *
 * Divided by the zoom before they reach a node, unlike the transformer's
 * anchors, which draw themselves in screen pixels already. A handle that grows
 * as the view zooms out covers the hideout it belongs to.
 */
const HANDLE_RADIUS = 6;
const CONTROL_RADIUS = 4;
const GRAB_WIDTH = 14;

/**
 * The outline and its handles, for one array at a time.
 *
 * Dispatches `changed` whenever a gesture has written new parameters, on every
 * step of a drag rather than at its end: editing an array is live. see
 * decisions/array-placement.
 */
export class Gizmo extends EventTarget {
  constructor(layer) {
    super();

    this.array = null;
    this.zoom = 1;
    /** Where a move gesture started, so that a drag reads as a displacement. */
    this.origin = null;

    this.shapes = new Konva.Group({ visible: false });
    this.outline = new Konva.Line({
      stroke: COLOR,
      strokeWidth: 1,
      strokeScaleEnabled: false,
      draggable: true,
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
    });
    // What the box transforms. It draws nothing -- the transformer draws the
    // border, and the outline draws the shape -- and it listens to nothing, so
    // that a box lying over another layer's doodads still lets them be clicked.
    this.boxRect = new Konva.Rect({ listening: false });
    this.points = POINTS.map((point) => pointHandle(point.control));
    // Under the handles and over the outline, and listening to nothing: a leash
    // is a line between two handles and never a thing to grab.
    this.leashes = LEASHES.map(() => leashLine());
    this.shapes.add(
      this.boxRect,
      this.outline,
      ...this.leashes,
      ...this.points,
    );
    layer.add(this.shapes);

    this.handles = new Box({ visible: false });
    layer.add(this.handles);

    this.outline.on("dragstart", this.startMoving);
    this.outline.on("dragmove", this.moving);
    this.outline.on("dragend", this.stopMoving);
    for (const [index, handle] of this.points.entries()) {
      handle.on("dragmove", () => this.pointMoved(index, handle));
      handle.on("dragend", this.redraw);
    }
    this.handles.on("transform", this.transforming);
    this.handles.on("transformend", this.transformed);
  }

  /**
   * The array whose gizmo is up, or `null` for none -- which is what the editor
   * shows whenever the generator sidebar is closed.
   */
  show(array) {
    this.array = array ?? null;
    this.handles.nodes(this.hasBox() ? [this.boxRect] : []);
    this.redraw();
  }

  hasBox() {
    return Boolean(this.array) && model.carriesBox(this.array.type);
  }

  /**
   * Whether a node belongs to this gizmo -- its outline, its endpoints, or one
   * of the transformer's anchors.
   *
   * The scene asks before it starts a rubber band. Konva starts the drag itself
   * from the same mousedown, and a band running underneath it would select the
   * hideout while the player moved an array.
   */
  grips(node) {
    return node.getParent() === this.shapes || this.handles.grips(node);
  }

  /**
   * The gizmo as the parameters now say. Everything is derived, so a redraw is
   * how any change reaches the screen, whichever gesture made it.
   */
  redraw = () => {
    this.shapes.visible(Boolean(this.array));
    this.handles.visible(this.hasBox());
    if (!this.array) return;

    this.drawOutline();
    this.drawBoxRect();
    this.drawPoints();
    this.scaleToZoom();
  };

  drawOutline() {
    const shape = generator.outline(this.array);
    this.outline.position({ x: 0, y: 0 });
    this.outline.points(stagePoints(shape));
    this.outline.closed(shape.closed);
  }

  drawBoxRect() {
    if (!this.hasBox()) return;

    this.boxRect.setAttrs(rectOf(this.array.box));
    this.handles.forceUpdate();
  }

  /**
   * A handle over every point the parameters carry, and none over a point they
   * do not. A grid holds no `ends`, so its four handles are simply absent.
   */
  drawPoints() {
    for (const [index, handle] of this.points.entries()) {
      const at = pointOf(this.array, index);
      handle.visible(Boolean(at));
      if (at) handle.position(units.toStage(at));
    }
    this.drawLeashes();
  }

  /** The line from each end to the control pulling at it, where there is one. */
  drawLeashes() {
    for (const [index, leash] of this.leashes.entries()) {
      const ends = LEASHES[index];
      const from = pointOf(this.array, ends.from);
      const to = pointOf(this.array, ends.to);
      leash.visible(Boolean(from && to));
      if (from && to) {
        leash.points(stagePoints({ points: [from, to] }));
      }
    }
  }

  /**
   * The view's zoom, for the handles that are not the transformer's.
   *
   * The transformer needs none of this: it overrides `getAbsoluteTransform` and
   * is therefore already in screen pixels. Everything else here is in the
   * world's units and has to be told.
   */
  viewScaled(zoom) {
    this.zoom = zoom;
    this.scaleToZoom();
  }

  scaleToZoom() {
    this.outline.hitStrokeWidth(GRAB_WIDTH / this.zoom);
    for (const handle of this.points) {
      handle.scale({ x: 1 / this.zoom, y: 1 / this.zoom });
    }
  }

  // -- gestures -------------------------------------------------------------

  /**
   * Moving the whole shape by dragging its outline, rather than by dragging
   * inside it.
   *
   * The interior is left alone deliberately. An array's box is a rectangle of
   * floor with other layers' doodads under it, and a gizmo that claims all of it
   * is a gizmo that swallows every click a player aims at one of them -- the
   * same reason `shouldOverdrawWholeArea` is refused in `transform.js`. The
   * outline's grab area is `GRAB_WIDTH` of screen pixels, so the edge is a
   * target rather than a hairline.
   *
   * Konva owns the outline's position for the length of the drag, so the drag is
   * read as a displacement from where the parameters were when it started, and
   * the outline is not redrawn until it ends. Redrawing it mid-drag would move
   * the points out from under the node Konva is still placing by them.
   */
  startMoving = () => {
    this.origin = this.hasBox()
      ? { center: { ...this.array.box.center } }
      : { points: POINTS.map((_, index) => pointOf(this.array, index)) };
  };

  /**
   * A shape drawn end to end moves by every point it carries, controls
   * included: a curve dragged by its middle is the same curve somewhere else,
   * and a control left behind would flatten it as it went.
   */
  moving = () => {
    const moved = units.fromStageExact(this.outline.position());
    if (this.hasBox()) {
      const center = displaced(this.origin.center, moved);
      this.array.box = { ...this.array.box, center };
    } else {
      for (const [index, at] of this.origin.points.entries()) {
        if (at) setPoint(this.array, index, displaced(at, moved));
      }
    }
    // The handles hold the rectangle and not the outline, so it has to be
    // carried along by hand.
    this.drawBoxRect();
    this.changed();
  };

  stopMoving = () => {
    this.origin = null;
    this.redraw();
  };

  /** One point dragged: the parameters say what the handle now says. */
  pointMoved(index, handle) {
    setPoint(this.array, index, units.fromStageExact(handle.position()));

    this.drawOutline();
    this.drawLeashes();
    this.changed();
  }

  /**
   * A step of a resize or a rotation, read off the rectangle.
   *
   * The scale is left on the node for the length of the gesture and read through
   * rather than undone every step. `transform.js` undoes it because its box is
   * measured off the nodes it holds, so a scale left on them would be measured
   * again and multiply; here the box *is* the node, and Konva's own arithmetic
   * is the thing being read.
   */
  transforming = () => {
    this.array.box = boxOf(this.boxRect);
    this.drawOutline();
    this.changed();
  };

  /**
   * The gesture's scale folded back into the width and the height.
   *
   * A generator's box has a size and no scale, so a scale left on the rectangle
   * is the rectangle claiming something the parameters cannot hold --
   * `unscaleNodes`' reasoning, applied to one node. `drawBoxRect` is what puts
   * it back to one.
   */
  transformed = () => {
    this.array.box = boxOf(this.boxRect);
    this.redraw();
    this.changed();
  };

  changed() {
    this.dispatchEvent(
      new CustomEvent("changed", { detail: { layer: this.array.layer } }),
    );
  }
}

/**
 * The arrays riding with a moving selection, one proxy node each.
 *
 * A layer group moves several layers at once, and an array's doodads cannot be
 * selected, so an array has nothing in the selection's box. The proxy is that
 * something: a rectangle standing where the array stands, handed to the
 * transformer with the doodads and read afterwards for the array's geometry.
 * see decisions/layer-groups.
 *
 * Drawn faintly, an array in the set being otherwise invisible until the drag
 * has already moved it. A rectangle of the shape's upright extent, the outline
 * belonging to the one array being worked on.
 *
 * The motion is read from where the gesture started: `begin` keeps the
 * parameters as they were, so a drag of a thousand steps applies one rigid
 * motion. The arithmetic is `arrays.moved`.
 *
 * A mover names its layer and asks for the parameters, `editedArray`'s
 * reasoning -- aligning a group replaces every generator it touches, so a mover
 * holding the old object would draw a shape nothing reads.
 */
export class Movers {
  /** `find(layer)` answers with the generator that layer carries, or nothing. */
  constructor(layer, find) {
    this.layer = layer;
    this.find = find;
    this.movers = [];
  }

  /** A proxy for each of these layers' arrays, and none for any other. */
  show(layers) {
    this.destroy();
    this.movers = layers
      .filter((layer) => Boolean(this.find(layer)))
      .map((layer) => new Mover(layer, this.find, this.layer));
  }

  get nodes() {
    return this.movers.map((mover) => mover.node);
  }

  /**
   * Forgets the arrays a layer edit has taken away, and says whether it forgot
   * any -- the caller is holding these nodes in a transformer, and a destroyed
   * node in one is a box measured off something that is not there.
   */
  keepOnly(layers) {
    const kept = new Set(layers);
    const gone = this.movers.filter((mover) => !kept.has(mover.layer));
    for (const mover of gone) {
      mover.destroy();
    }
    this.movers = this.movers.filter((mover) => kept.has(mover.layer));
    return gone.length > 0;
  }

  begin() {
    for (const mover of this.movers) {
      mover.begin();
    }
  }

  /** The parameters as the gesture now says, and the layers they belong to. */
  follow() {
    for (const mover of this.movers) {
      mover.follow();
    }
    return this.movers.map((mover) => mover.layer);
  }

  /** The proxies back onto the shapes they stand for, upright again. */
  redraw() {
    for (const mover of this.movers) {
      mover.redraw();
    }
  }

  destroy() {
    for (const mover of this.movers) {
      mover.destroy();
    }
    this.movers = [];
  }
}

/** One riding array: its proxy, and where both stood when the gesture began. */
class Mover {
  constructor(layer, find, drawnIn) {
    this.layer = layer;
    this.find = find;
    this.node = proxyRect();
    drawnIn.add(this.node);
    this.origin = null;
    this.redraw();
  }

  /** The parameters, asked for afresh: they may be a different object by now. */
  get array() {
    return this.find(this.layer);
  }

  begin() {
    this.origin = {
      parameters: structuredClone({ ...this.array }),
      rotation: this.node.rotation(),
    };
  }

  /**
   * The array where the proxy now is. The proxy is anchored on the array's
   * centre, so where it has been put *is* where the centre has gone, and the
   * turn is what the transformer has added to its rotation.
   *
   * Only the geometry is written back. Everything else about the array -- its
   * source, its seed, how many doodads it carries -- is not this gesture's, and
   * writing the whole clone back would undo an edit made between `begin` and
   * now.
   */
  follow() {
    if (this.origin === null || !this.array) return;

    const moved = arrays.moved(this.origin.parameters, {
      from: arrays.centerOf(this.origin.parameters),
      to: units.fromStageExact(this.node.position()),
      degrees: this.node.rotation() - this.origin.rotation,
    });
    Object.assign(this.array, model.shapeOf(moved));
  }

  /**
   * The proxy on the array as it now stands: over the shape's extent, anchored
   * on its centre, and upright -- the turn a gesture left on it is in the
   * parameters by now, so keeping it would be counting it twice.
   */
  redraw() {
    const array = this.array;
    if (!array) return;

    const extent = extentOf(generator.outline(array).points.map(units.toStage));
    const center = units.toStage(arrays.centerOf(array));
    this.node.setAttrs({
      ...center,
      offsetX: center.x - extent.x,
      offsetY: center.y - extent.y,
      width: extent.width,
      height: extent.height,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    });
    this.origin = null;
  }

  destroy() {
    this.node.destroy();
  }
}

/** The upright rectangle a set of stage points fits in. */
function extentOf(points) {
  const x = points.map((point) => point.x);
  const y = points.map((point) => point.y);
  const left = Math.min(...x);
  const top = Math.min(...y);
  return {
    x: left,
    y: top,
    width: Math.max(...x) - left,
    height: Math.max(...y) - top,
  };
}

/**
 * A proxy: seen and never touched. It listens to nothing, so a rectangle lying
 * over another layer's doodads still lets them be clicked -- the outline's
 * reasoning, and the boxRect's above.
 */
function proxyRect() {
  return new Konva.Rect({
    stroke: COLOR,
    strokeWidth: 1,
    dash: [2, 4],
    strokeScaleEnabled: false,
    opacity: 0.6,
    listening: false,
    perfectDrawEnabled: false,
    shadowForStrokeEnabled: false,
  });
}

/**
 * A generator's box as the rectangle the handles transform.
 *
 * A box is a centre, a size and a rotation, and so is a `Konva.Rect` whose
 * offset is its own middle -- the offset is what makes `position()` the centre
 * at any scale, and a centre is what a rotation has to turn about. The rotation
 * needs no conversion: a generator's angles are already the ones the stage
 * reads, which is `units.js`'s doing and not this module's.
 *
 * The box's own y runs *up* it where Konva's runs down, so the rectangle is
 * upside down in local terms. It covers the same region either way, being
 * centred, and it is never drawn: what a player sees is the outline, which came
 * through the generator's `fromLocal` and is not upside down.
 */
export function rectOf(box) {
  return {
    ...units.toStage(box.center),
    width: box.width,
    height: box.height,
    offsetX: box.width / 2,
    offsetY: box.height / 2,
    rotation: box.rotation,
    scaleX: 1,
    scaleY: 1,
  };
}

/** The box a rectangle now describes, in the units a generator holds it in. */
export function boxOf(rect) {
  return {
    center: units.fromStageExact(rect.position()),
    width: rect.width() * rect.scaleX(),
    height: rect.height() * rect.scaleY(),
    rotation: rect.rotation(),
  };
}

/** An outline's points as Konva wants them: `x, y, x, y`, in stage units. */
export function stagePoints({ points }) {
  return points.flatMap((point) => {
    const at = units.toStage(point);
    return [at.x, at.y];
  });
}

function displaced(point, by) {
  return { x: point.x + by.x, y: point.y + by.y };
}

/**
 * The point handle `index` is over, or `undefined` where this shape has none.
 * A grid carries no `ends` at all, and only a Bézier carries `controls`.
 */
function pointOf(array, index) {
  const { field, key } = POINTS[index];
  return array?.[field]?.[key];
}

/** The same point, written back. The whole record is replaced, not its field:
 * `moving` reads what a gesture started from, and a shared object would be
 * edited under it. */
function setPoint(array, index, at) {
  const { field, key } = POINTS[index];
  array[field] = { ...array[field], [key]: at };
}

/**
 * A handle. A control is drawn smaller and filled, so that "on the shape" and
 * "pulling at the shape" are told apart at a glance rather than by dragging one
 * and seeing what happens.
 */
function pointHandle(control) {
  return new Konva.Circle({
    radius: control ? CONTROL_RADIUS : HANDLE_RADIUS,
    fill: control ? COLOR : HANDLE_FILL,
    stroke: COLOR,
    strokeWidth: 1,
    strokeScaleEnabled: false,
    draggable: true,
    visible: false,
    perfectDrawEnabled: false,
    shadowForStrokeEnabled: false,
  });
}

/** Dashed, thin and deaf: it says which control belongs to which end. */
function leashLine() {
  return new Konva.Line({
    stroke: COLOR,
    strokeWidth: 1,
    dash: [4, 4],
    strokeScaleEnabled: false,
    listening: false,
    visible: false,
    perfectDrawEnabled: false,
    shadowForStrokeEnabled: false,
  });
}
