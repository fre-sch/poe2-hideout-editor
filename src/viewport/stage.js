/**
 * The Konva stage, its three layers, and the view controls.
 *
 * Replaces `MapControls`. The three.js editor remapped the mouse buttons so
 * that the left one was free for box selection; the same shape holds here --
 * left drags a selection, middle pans, the wheel zooms about the pointer.
 *
 * There are exactly three layers because each one is a real `<canvas>`, see
 * wiki/decisions/2d-rendering-with-konva.md. User layers, when they arrive,
 * are `Konva.Group` nodes inside `doodads`.
 */

import Konva from "konva";

/**
 * The whole view is turned so that it reads the way the game's camera shows a
 * hideout. The game looks along a diagonal of the floor grid, so a hideout
 * drawn straight onto its own axes arrives at 225 degrees to what a player
 * recognises.
 *
 * It sits on the stage, which is the one place it can sit without meaning
 * anything: the doodads, the outline and the grid are all under it and rotate
 * together, so the coordinate mapping in `units.toStage` stays what it says it
 * is and a hideout still lands on its own outline. Nothing below this line
 * knows the view is turned -- the rubber band and the labels work in screen
 * coordinates, and the zoom and fit maths below go through the stage's own
 * transform rather than assuming it is a scale and an offset.
 */
const VIEW_ROTATION = 225;

// Doodad units. The observed coordinate range is 116..867 across every sample,
// so a fixed square covers every hideout and needs no data to be drawn.
const GRID_EXTENT = 1000;
const GRID_MINOR = 10;
const GRID_MAJOR = 50;
const GRID_MINOR_COLOR = "#204070";
const GRID_MAJOR_COLOR = "#407090";

const ZOOM_STEP = 1.1;
const ZOOM_MIN = 0.05;
const ZOOM_MAX = 40;
const PAN_BUTTON = 1;
const FIT_PADDING = 40;

/**
 * Dispatches `viewchanged` whenever zoom or pan moved the world under the
 * pointer. Labels listen for it; nothing redraws on a timer.
 */
export class Stage extends EventTarget {
  constructor(container) {
    super();

    this.konva = new Konva.Stage({
      container,
      width: container.clientWidth,
      height: container.clientHeight,
      rotation: VIEW_ROTATION,
    });
    this.static = new Konva.Layer({ listening: false });
    this.doodads = new Konva.Layer();
    this.overlay = new Konva.Layer();
    this.konva.add(this.static, this.doodads, this.overlay);

    // Not cached, though the decision page allows for it: a Konva cache is a
    // bitmap taken at the current scale, so zooming in would blur the grid. Two
    // hundred lines with `strokeScaleEnabled` off cost less than that trade.
    this.static.add(grid());

    this.konva.on("wheel", this.onWheel);
    container.addEventListener("mousedown", this.onPanStart);
    container.addEventListener("contextmenu", preventDefault);
  }

  destroy() {
    this.endPan();
    this.konva.container().removeEventListener("mousedown", this.onPanStart);
    this.konva.container().removeEventListener("contextmenu", preventDefault);
    this.konva.destroy();
  }

  resize(width, height) {
    this.konva.size({ width, height });
    this.viewChanged();
  }

  viewChanged() {
    this.dispatchEvent(new CustomEvent("viewchanged"));
  }

  /**
   * Zoom and centre so that a rectangle of doodad units fills the view.
   *
   * The rectangle is axis aligned in doodad units, and the view is turned, so
   * what has to fit on screen is its turned extent -- wider and shorter than
   * the rectangle itself, by the usual pair of projections.
   */
  fit(rectangle) {
    if (!rectangle || rectangle.width <= 0 || rectangle.height <= 0) return;

    const turn = (VIEW_ROTATION * Math.PI) / 180;
    const across = Math.abs(Math.cos(turn));
    const down = Math.abs(Math.sin(turn));
    const scale = clamp(
      Math.min(
        (this.konva.width() - FIT_PADDING * 2) /
          (rectangle.width * across + rectangle.height * down),
        (this.konva.height() - FIT_PADDING * 2) /
          (rectangle.width * down + rectangle.height * across),
      ),
      ZOOM_MIN,
      ZOOM_MAX,
    );

    this.konva.scale({ x: scale, y: scale });
    this.centreOn({
      x: rectangle.x + rectangle.width / 2,
      y: rectangle.y + rectangle.height / 2,
    });
  }

  /** Pans so that a point in doodad units sits in the middle of the view. */
  centreOn(point) {
    this.konva.position({ x: 0, y: 0 });
    const landed = this.konva.getAbsoluteTransform().point(point);
    this.konva.position({
      x: this.konva.width() / 2 - landed.x,
      y: this.konva.height() / 2 - landed.y,
    });
    this.viewChanged();
  }

  onWheel = (event) => {
    event.evt.preventDefault();
    const pointer = this.konva.getPointerPosition();
    if (!pointer) return;

    // The point under the pointer is the one that must not move. Where it ends
    // up is asked of the stage rather than worked out, so the rotation costs
    // nothing here.
    const anchor = this.konva.getRelativePointerPosition();
    const zoomed = clamp(
      event.evt.deltaY < 0
        ? this.konva.scaleX() * ZOOM_STEP
        : this.konva.scaleX() / ZOOM_STEP,
      ZOOM_MIN,
      ZOOM_MAX,
    );

    this.konva.scale({ x: zoomed, y: zoomed });
    const landed = this.konva.getAbsoluteTransform().point(anchor);
    this.konva.position({
      x: this.konva.x() + pointer.x - landed.x,
      y: this.konva.y() + pointer.y - landed.y,
    });
    this.viewChanged();
  };

  /**
   * Panning listens on the window rather than the canvas, so that a drag that
   * leaves the viewport keeps panning and, more importantly, still ends.
   */
  onPanStart = (event) => {
    if (event.button !== PAN_BUTTON) return;
    event.preventDefault();
    this.panOrigin = {
      x: event.clientX - this.konva.x(),
      y: event.clientY - this.konva.y(),
    };
    window.addEventListener("mousemove", this.onPanMove);
    window.addEventListener("mouseup", this.onPanEnd);
  };

  onPanMove = (event) => {
    this.konva.position({
      x: event.clientX - this.panOrigin.x,
      y: event.clientY - this.panOrigin.y,
    });
    this.viewChanged();
  };

  onPanEnd = () => {
    this.endPan();
  };

  endPan() {
    window.removeEventListener("mousemove", this.onPanMove);
    window.removeEventListener("mouseup", this.onPanEnd);
  }
}

function grid() {
  const group = new Konva.Group({ listening: false });
  for (let offset = 0; offset <= GRID_EXTENT; offset += GRID_MINOR) {
    const major = offset % GRID_MAJOR === 0;
    const line = {
      stroke: major ? GRID_MAJOR_COLOR : GRID_MINOR_COLOR,
      strokeWidth: 1,
      strokeScaleEnabled: false,
      listening: false,
    };
    group.add(
      new Konva.Line({ ...line, points: [offset, 0, offset, GRID_EXTENT] }),
    );
    group.add(
      new Konva.Line({ ...line, points: [0, offset, GRID_EXTENT, offset] }),
    );
  }
  return group;
}

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}

function preventDefault(event) {
  event.preventDefault();
}
