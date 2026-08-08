/**
 * The Konva stage, its three layers, and the view controls.
 *
 * Replaces the 3D editor's map controls, which remapped the mouse buttons so
 * that the left one was free for box selection; the same shape holds here --
 * left drags a selection, middle pans, right turns the view, and the wheel
 * zooms about the pointer.
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
 *
 * This is where the view starts and what `alignToGame` returns it to, not a
 * constant: the right mouse button turns it freely, which is how a player lines
 * an upright rubber band up with a row of doodads that runs diagonally.
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
const FIT_PADDING = 40;

const PAN_BUTTON = 1;
const ROTATE_BUTTON = 2;
// Half a turn across a thousand pixels of drag.
const ROTATION_PER_PIXEL = 0.18;

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
    // Kept as a field so it can be hidden; built once either way.
    this.grid = grid();
    this.static.add(this.grid);

    this.konva.on("wheel", this.onWheel);
    container.addEventListener("mousedown", this.onViewDragStart);
    // Without this the right button opens a menu instead of turning the view.
    container.addEventListener("contextmenu", preventDefault);
  }

  destroy() {
    this.endViewDrag();
    const container = this.konva.container();
    container.removeEventListener("mousedown", this.onViewDragStart);
    container.removeEventListener("contextmenu", preventDefault);
    this.konva.destroy();
  }

  resize(width, height) {
    this.konva.size({ width, height });
    this.viewChanged();
  }

  showGrid(enabled) {
    this.grid.visible(enabled);
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

    const turn = (this.konva.rotation() * Math.PI) / 180;
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
    this.keepUnder(point, {
      x: this.konva.width() / 2,
      y: this.konva.height() / 2,
    });
    this.viewChanged();
  }

  /**
   * Turns the view back to the game's perspective, about the middle of the
   * view, so that a player who has turned it to line up a selection has one way
   * back rather than a steady hand.
   */
  alignToGame() {
    const middle = { x: this.konva.width() / 2, y: this.konva.height() / 2 };
    const anchor = this.contentAt(middle);
    this.konva.rotation(VIEW_ROTATION);
    this.keepUnder(anchor, middle);
    this.viewChanged();
  }

  /** The doodad-unit point drawn at a point on screen. */
  contentAt(point) {
    return this.konva.getAbsoluteTransform().copy().invert().point(point);
  }

  /**
   * Pans so that a point in doodad units lands back under a point on screen.
   *
   * This is what makes zooming and turning feel anchored, and it is written
   * once because the stage's transform answers "where did it go" for both. Only
   * the panning is worked out by hand, and panning is the one part a rotation
   * cannot disturb: position is applied outside it.
   */
  keepUnder(anchor, pointer) {
    const landed = this.konva.getAbsoluteTransform().point(anchor);
    this.konva.position({
      x: this.konva.x() + pointer.x - landed.x,
      y: this.konva.y() + pointer.y - landed.y,
    });
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
    this.keepUnder(anchor, pointer);
    this.viewChanged();
  };

  /**
   * Middle drags the view about, right turns it. Which of the two it is gets
   * decided once, here, and the gesture then runs as the function it left in
   * `moveView`.
   *
   * Both listen on the window rather than the canvas, so that a drag leaving
   * the viewport keeps working and, more importantly, still ends.
   */
  onViewDragStart = (event) => {
    const gesture = this.gestureFor(event);
    if (!gesture) return;

    this.moveView = gesture;
    event.preventDefault();
    window.addEventListener("mousemove", this.onViewDragMove);
    window.addEventListener("mouseup", this.onViewDragEnd);
  };

  gestureFor(event) {
    if (event.button === PAN_BUTTON) return this.panning(event);
    if (event.button === ROTATE_BUTTON) return this.turning(event);
    return null;
  }

  onViewDragMove = (event) => {
    this.moveView(event);
    this.viewChanged();
  };

  onViewDragEnd = () => {
    this.endViewDrag();
  };

  endViewDrag() {
    window.removeEventListener("mousemove", this.onViewDragMove);
    window.removeEventListener("mouseup", this.onViewDragEnd);
  }

  panning(event) {
    const origin = {
      x: event.clientX - this.konva.x(),
      y: event.clientY - this.konva.y(),
    };
    return (moved) => {
      this.konva.position({
        x: moved.clientX - origin.x,
        y: moved.clientY - origin.y,
      });
    };
  }

  /**
   * Turning is driven sideways, about the point the drag started on, so that
   * the doodad a player is looking at stays where they are looking.
   *
   * The 3D editor had this on the same button, where it orbited a camera.
   * There is no camera, and there is only one axis left to turn about, so what
   * survives is the gesture rather than the mechanism -- and it earns its place:
   * an upright rubber band cannot pick out a row of doodads that runs diagonally
   * until the view is turned to meet it.
   */
  turning(event) {
    this.konva.setPointersPositions(event);
    const pointer = this.konva.getPointerPosition();
    const anchor = this.contentAt(pointer);
    const origin = { x: event.clientX, rotation: this.konva.rotation() };

    return (moved) => {
      const turned = (moved.clientX - origin.x) * ROTATION_PER_PIXEL;
      this.konva.rotation(origin.rotation + turned);
      this.keepUnder(anchor, pointer);
    };
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
