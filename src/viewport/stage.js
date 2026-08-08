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

  /** The rectangle the stage currently shows, in doodad units. */
  visibleRectangle() {
    const scale = this.konva.scaleX();
    return {
      x: -this.konva.x() / scale,
      y: -this.konva.y() / scale,
      width: this.konva.width() / scale,
      height: this.konva.height() / scale,
    };
  }

  /** Zoom and centre so that a rectangle of doodad units fills the view. */
  fit(rectangle) {
    if (!rectangle || rectangle.width <= 0 || rectangle.height <= 0) return;

    const width = this.konva.width() - FIT_PADDING * 2;
    const height = this.konva.height() - FIT_PADDING * 2;
    const scale = clamp(
      Math.min(width / rectangle.width, height / rectangle.height),
      ZOOM_MIN,
      ZOOM_MAX,
    );

    this.konva.scale({ x: scale, y: scale });
    this.konva.position({
      x: this.konva.width() / 2 - (rectangle.x + rectangle.width / 2) * scale,
      y: this.konva.height() / 2 - (rectangle.y + rectangle.height / 2) * scale,
    });
    this.viewChanged();
  }

  onWheel = (event) => {
    event.evt.preventDefault();
    const pointer = this.konva.getPointerPosition();
    if (!pointer) return;

    const scale = this.konva.scaleX();
    const zoomed = clamp(
      event.evt.deltaY < 0 ? scale * ZOOM_STEP : scale / ZOOM_STEP,
      ZOOM_MIN,
      ZOOM_MAX,
    );
    // The point under the pointer is the one that must not move.
    const anchor = {
      x: (pointer.x - this.konva.x()) / scale,
      y: (pointer.y - this.konva.y()) / scale,
    };

    this.konva.scale({ x: zoomed, y: zoomed });
    this.konva.position({
      x: pointer.x - anchor.x * zoomed,
      y: pointer.y - anchor.y * zoomed,
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
