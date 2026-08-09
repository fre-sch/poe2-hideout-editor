/**
 * An array's gizmo: the outline its doodads sit on, and the handles that move,
 * rotate and scale it.
 *
 * **The outline is the generator's own polyline, converted.** `generator.outline`
 * hands back the points a walk consumes -- the box for a grid -- and every one of
 * them goes through `units.toStage`. So the drawing cannot disagree with the
 * placement, and the axis swap happens in one place rather than being reasoned
 * about twice. Nothing here draws an ellipse as a `Konva.Ellipse` with a
 * rotation, which would be a second opinion about where the doodads went.
 *
 * **The parameters are the truth and the nodes are the drawing.** Every gesture
 * ends in the same three steps: write the box or the ends, redraw the gizmo from
 * them, and dispatch `changed` so the scene regenerates. There is no state in
 * between for the two to drift apart in.
 *
 * **The box is `transform.Box` and not a plain `Konva.Transformer`.** It measures
 * itself once a frame, refuses to flip, and snaps its rotation the way the
 * selection's box does -- see there, and wiki issue 0041 for what the plain one
 * costs on a pan.
 *
 * Three of the four shapes carry a box. A line carries two ends instead, and gets
 * a handle on each: a rotate-and-scale box around two points is a way of asking
 * for the same two points less directly.
 *
 * A gizmo is never serialized. What is drawn here exists while the generator
 * sidebar is open and nowhere else.
 */

import Konva from "konva";

import * as generator from "../hideout/generator.js";
import * as units from "../hideout/units.js";
import { Box } from "./transform.js";

const COLOR = "#FF66FF";
const HANDLE_FILL = "#301030";

/**
 * The endpoint handles and the outline's grab area, in screen pixels.
 *
 * Screen pixels, so they are divided by the zoom before they reach a node --
 * unlike the transformer's anchors, which draw themselves in screen pixels
 * already. A handle that grows as the view zooms out is a handle covering the
 * hideout it belongs to.
 */
const HANDLE_RADIUS = 6;
const GRAB_WIDTH = 14;

/**
 * The outline and its handles, for one array at a time.
 *
 * Dispatches `changed` whenever a gesture has written new parameters -- on every
 * step of a drag, not at its end, because editing an array is live
 * (wiki/decisions/array-placement.md).
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
    this.ends = [endHandle(), endHandle()];
    this.shapes.add(this.boxRect, this.outline, ...this.ends);
    layer.add(this.shapes);

    this.handles = new Box({ visible: false });
    layer.add(this.handles);

    this.outline.on("dragstart", this.startMoving);
    this.outline.on("dragmove", this.moving);
    this.outline.on("dragend", this.stopMoving);
    for (const [index, handle] of this.ends.entries()) {
      handle.on("dragmove", () => this.endMoved(index, handle));
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
    return Boolean(this.array) && this.array.type !== "line";
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
    this.drawEnds();
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

  drawEnds() {
    const line = this.array.type === "line";
    for (const handle of this.ends) {
      handle.visible(line);
    }
    if (!line) return;

    const ends = this.array.ends;
    this.ends[0].position(units.toStage(ends.start));
    this.ends[1].position(units.toStage(ends.end));
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
    for (const handle of this.ends) {
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
      : {
          start: { ...this.array.ends.start },
          end: { ...this.array.ends.end },
        };
  };

  moving = () => {
    const moved = units.fromStageExact(this.outline.position());
    if (this.hasBox()) {
      const center = displaced(this.origin.center, moved);
      this.array.box = { ...this.array.box, center };
    } else {
      this.array.ends = {
        start: displaced(this.origin.start, moved),
        end: displaced(this.origin.end, moved),
      };
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

  /** One end of a line, dragged: the handle is where the endpoint now is. */
  endMoved(index, handle) {
    const at = units.fromStageExact(handle.position());
    const ends = { ...this.array.ends };
    ends[index === 0 ? "start" : "end"] = at;
    this.array.ends = ends;

    this.drawOutline();
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

function endHandle() {
  return new Konva.Circle({
    radius: HANDLE_RADIUS,
    fill: HANDLE_FILL,
    stroke: COLOR,
    strokeWidth: 1,
    strokeScaleEnabled: false,
    draggable: true,
    visible: false,
    perfectDrawEnabled: false,
    shadowForStrokeEnabled: false,
  });
}
