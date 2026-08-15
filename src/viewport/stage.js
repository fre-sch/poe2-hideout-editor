/**
 * The Konva stage, its three layers, and the view controls.
 *
 * Left drags a selection, middle pans, right turns the view, the wheel zooms
 * about the pointer.
 *
 * Exactly three layers, each being a real `<canvas>`. User layers are
 * `Konva.Group` nodes inside `doodads`. see decisions/2d-rendering-with-konva.
 */

import Konva from "konva";

/**
 * The view is turned to read the way the game's camera shows a hideout: the
 * game looks along a diagonal of the floor grid.
 *
 * On the stage, which is the one place it means nothing -- the doodads, the
 * outline and the grid turn together, so `units.toStage` stays what it says it
 * is. Nothing below knows the view is turned: the band and the labels work in
 * screen coordinates, and the zoom and fit go through the stage's transform.
 *
 * Where the view starts and what `alignToGame` returns it to, not a constant:
 * the right button turns it freely, which is how a player lines an upright band
 * up with a diagonal row of doodads.
 */
const VIEW_ROTATION = 225;

// Doodad units. The observed coordinate range is 116..867 across every sample,
// so a fixed square covers every hideout and needs no data to be drawn.
const GRID_EXTENT = 2000;
const GRID_MINOR = 10;
const GRID_MAJOR = 50;
const GRID_MINOR_COLOR = "#103060";
const GRID_MAJOR_COLOR = "#407090";

/**
 * The coordinate labels on the major lines. Monospace because they are read as
 * numbers rather than as words, and in the major line's own colour because they
 * are that line, written down.
 *
 * The gap and size are screen pixels, a label being counter-turned and
 * counter-scaled. see `alignGridLabels`. Below `GRID_LABEL_SPACING` between
 * major lines there is no room to read one.
 */
const GRID_LABEL_FONT = "monospace";
const GRID_LABEL_SIZE = 11;
const GRID_LABEL_GAP = 3;
const GRID_LABEL_SPACING = 27;

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
    // Inside the grid, so that the toggle hides both without knowing there are
    // two things to hide.
    this.gridLabels = gridLabels();
    this.grid.add(this.gridLabels);
    this.static.add(this.grid);

    // On the world origin rather than the stage's own top left corner: the grid
    // and every hideout grow away from the origin, and a turn of VIEW_ROTATION
    // about the viewport corner puts all of it off the screen.
    this.centreOn({ x: 500, y: 500 });

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
    this.alignGridLabels();
    this.dispatchEvent(new CustomEvent("viewchanged"));
  }

  /**
   * Keeps the coordinate labels upright and one size, whatever the view is
   * doing.
   *
   * Anchored in the world so a label stays on the line it names, but read on
   * the screen -- turned with the view it would be upside down for most of a
   * turn. Turning and scaling each back makes its own space the screen's, which
   * is what lets `corner` be a number of pixels.
   *
   * Which way those pixels point is the world's business, so the corner is
   * turned with the view: a label says "this side of my line", and a
   * screen-fixed offset would cross the line as the view came round.
   */
  alignGridLabels() {
    const zoom = this.konva.scaleX();
    const readable = GRID_MAJOR * zoom >= GRID_LABEL_SPACING;

    this.gridLabels.visible(readable);
    if (!readable) return;

    const turned = this.konva.rotation() - VIEW_ROTATION;
    for (const label of this.gridLabels.getChildren()) {
      const corner = turnedBy(label.corner, turned);
      label.rotation(-this.konva.rotation());
      label.scale({ x: 1 / zoom, y: 1 / zoom });
      // A Konva offset moves a node by the negative of itself.
      label.offset({ x: -corner.x, y: -corner.y });
    }
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
    this.keepUnder(point, this.middleOfView());
    this.viewChanged();
  }

  /** The middle of the view, in viewport pixels. */
  middleOfView() {
    return { x: this.konva.width() / 2, y: this.konva.height() / 2 };
  }

  /**
   * Turns the view back to the game's perspective, about the middle of the
   * view, so a player who turned it to line up a selection has a way back.
   */
  alignToGame() {
    const middle = this.middleOfView();
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
   * What makes zooming and turning feel anchored, written once because the
   * stage's transform answers "where did it go" for both. Only the panning is
   * worked out by hand, and position is applied outside the rotation.
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
   * Middle drags the view about, right turns it. Decided once here, and the
   * gesture then runs as the function left in `moveView`.
   *
   * Both listen on the window rather than the canvas, so a drag leaving the
   * viewport keeps working and still ends.
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
   * It earns its button: an upright rubber band cannot pick out a diagonal row
   * of doodads until the view is turned to meet it.
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

/**
 * A coordinate on every major line, along the axes of the world: the `y` labels
 * lie on the line where `x` is zero, and the `x` labels on the line where `y`
 * is zero.
 *
 * Each label names its axis, and the axis it names is the file's -- `toStage`
 * swaps them, so a bare number on a view turned 225 degrees is one a player
 * cannot attribute.
 *
 * The two families read off opposite sides of their lines, which keeps `x 0`
 * and `y 0` off each other at the origin. Which side was measured by eye
 * against the game's orientation, and is what `corner` holds.
 */
function gridLabels() {
  const group = new Konva.Group({ listening: false });
  for (let offset = 0; offset <= GRID_EXTENT; offset += GRID_MAJOR) {
    group.add(
      gridLabel(`y ${offset}`, { x: offset, y: 0 }, (width) => ({
        x: -width * 1.5,
        y: -GRID_LABEL_GAP,
      })),
    );
    group.add(
      gridLabel(`x ${offset}`, { x: 0, y: offset }, () => ({
        x: 0,
        y: GRID_LABEL_GAP,
      })),
    );
  }
  return group;
}

/**
 * `corner` says where the label's top left goes from the point it names, in
 * pixels of the default view. Carried on the node, the way a doodad is:
 * `alignGridLabels` needs it every time the view turns.
 */
function gridLabel(text, at, corner) {
  const label = new Konva.Text({
    text,
    x: at.x,
    y: at.y,
    fontFamily: GRID_LABEL_FONT,
    fontSize: GRID_LABEL_SIZE,
    fill: GRID_MAJOR_COLOR,
    listening: false,
    perfectDrawEnabled: false,
  });
  label.corner = corner(label.width());
  return label;
}

/** A point turned clockwise by `degrees`, the way the y-down stage turns. */
function turnedBy(point, degrees) {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}

function preventDefault(event) {
  event.preventDefault();
}
