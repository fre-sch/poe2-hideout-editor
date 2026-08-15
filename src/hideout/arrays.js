/**
 * The parameters an array starts life with, and the two edits that are geometry
 * rather than typing: changing its type, and moving the whole shape.
 *
 * `generator.js` reads parameters and `model.js` stores them; this is where a
 * set of them comes from. Here and not in the sidebar because fitting a shape
 * to a selection, turning a box into a line and carrying an array with a layer
 * group are arithmetic, and arithmetic is testable.
 */

import * as generator from "./generator.js";
import * as model from "./model.js";

/**
 * Room for a shape fitted to something with no size of its own -- one doodad,
 * or a row of them. Doodad units, where a hideout is a few hundred across, so a
 * new array arrives big enough to see and small enough to be somewhere.
 */
const MINIMUM_SIZE = 30;

/** What a `line` becomes a box of, having no thickness to keep. */
const LINE_HEIGHT = MINIMUM_SIZE;

const DEFAULT_CORNERS = 6;

/** A grid of nine is a shape a player can see the whole of and then change. */
const DEFAULT_RESOLUTION = { x: 3, y: 3 };

/**
 * The source in turn and the variations at random, which is what an array did
 * before either was a choice.
 */
const DEFAULT_PICK = {
  source: generator.CYCLE,
  variation: generator.RANDOM,
};

/**
 * A new array made from a selection: those doodads are the source, cycled, and
 * the shape is the box they occupy.
 *
 * The doodads themselves are the caller's to take: `gui/arrays.jsx` does, the
 * array's first generation standing where they stand. This is the arithmetic
 * half of it.
 */
export function fromSelection(doodads) {
  return {
    type: "grid",
    source: doodads.map(sourceOf),
    pick: { ...DEFAULT_PICK },
    box: boxAround(doodads),
    resolution: { ...DEFAULT_RESOLUTION },
    rotation: { base: 0, increment: 0, align: false },
    random: {
      seed: generator.randomSeed(),
      jitter: { x: 0, y: 0, rotation: 0 },
    },
  };
}

/**
 * What the generator keeps of a doodad: what it is, which variation it was
 * placed as, and which variations it may be drawn as -- none to begin with,
 * which means the one it came with. See `generator.js`.
 */
function sourceOf(doodad) {
  return {
    hash: doodad.hash,
    name: doodad.name,
    fv: doodad.fv,
    variation: [],
  };
}

/**
 * An unturned box holding the given doodads.
 *
 * The axes cross over: a box's own x runs across its width and reaches the
 * doodads' `y`, which is `generator.fromLocal`'s doing. So a wide box is wide
 * on the screen, which is where a player reads it.
 */
export function boxAround(doodads) {
  const across = spanOf(doodads.map((doodad) => doodad.y));
  const along = spanOf(doodads.map((doodad) => doodad.x));
  return {
    center: { x: along.middle, y: across.middle },
    width: across.size,
    height: along.size,
    rotation: 0,
  };
}

function spanOf(values) {
  if (values.length === 0) return { middle: 0, size: MINIMUM_SIZE };

  const low = Math.min(...values);
  const high = Math.max(...values);
  return {
    middle: (low + high) / 2,
    size: Math.max(high - low, MINIMUM_SIZE),
  };
}

// -- moving a whole array ----------------------------------------------------
//
// A layer group moves several layers at once, and an array in one moves by
// having its geometry rewritten: its doodads are computed, so there is nothing
// else to move. see decisions/layer-groups.

/**
 * Where an array is, as one point: the centre of its box, or the middle of its
 * ends for the two shapes drawn end to end.
 *
 * The midpoint, not the middle of the drawn curve: it is the point a player
 * aligns *by*, so it has to be predictable, and it is where a curve's box would
 * be centred. see `generator.boxOfEnds`.
 */
export function centerOf(parameters) {
  if (model.carriesBox(parameters.type)) return parameters.box.center;

  const { start, end } = parameters.ends;
  return along(start, end, 0.5);
}

/**
 * The same array moved rigidly: turned by `degrees` about `from`, which lands
 * at `to`.
 *
 * One motion and not a sequence of edits: a drag is read against where the array
 * was when the gesture started, so a long drag accumulates no rounding.
 *
 * Every point goes through the same turn, controls included -- a control left
 * behind would flatten a curve as it went. A box turns by its centre and its
 * angle together, which turns every corner about the pivot.
 */
export function moved(parameters, { from, to, degrees = 0 }) {
  const carry = (point) =>
    displaced(generator.turned(offset(point, from), degrees), to);
  if (model.carriesBox(parameters.type)) {
    return {
      ...parameters,
      box: {
        ...parameters.box,
        center: carry(parameters.box.center),
        rotation: parameters.box.rotation + degrees,
      },
    };
  }

  const moved_ = {
    ...parameters,
    ends: {
      start: carry(parameters.ends.start),
      end: carry(parameters.ends.end),
    },
  };
  if (!parameters.controls) return moved_;

  return {
    ...moved_,
    controls: {
      first: carry(parameters.controls.first),
      second: carry(parameters.controls.second),
    },
  };
}

/** The same array with its centre on a point, keeping its size, angle and shape. */
export function alignedTo(parameters, center) {
  return moved(parameters, { from: centerOf(parameters), to: center });
}

function offset(point, origin) {
  return { x: point.x - origin.x, y: point.y - origin.y };
}

function displaced(point, by) {
  return { x: point.x + by.x, y: point.y + by.y };
}

/**
 * The same array as another type: its geometry converted, and the fields the
 * new type needs and the old one had no use for filled in.
 *
 * The count carries over rather than the resolution itself, a grid counting in
 * two directions and everything else in one. So changing type twice is not
 * quite a round trip: three by three comes back as nine by one.
 */
export function withType(parameters, type) {
  if (type === parameters.type) return parameters;
  return {
    ...parameters,
    ...geometryFor(parameters, type),
    type,
    resolution: resolutionFor(parameters, type),
    corners: parameters.corners ?? DEFAULT_CORNERS,
    distribution: parameters.distribution ?? generator.ON_CORNERS,
  };
}

/**
 * A `Generator` carries the geometry of its own type and no other (see
 * `model.js`), so the shape being left is the shape to convert: a box, or a
 * pair of ends.
 *
 * A curve arrives straight, its controls a third and two thirds along the line
 * between its ends -- the Bézier that *is* that line -- so becoming a curve
 * moves no doodad until the player bends it.
 */
function geometryFor(parameters, type) {
  if (model.carriesBox(type)) {
    return { box: parameters.box ?? boxOfEnds(parameters.ends) };
  }

  const ends = parameters.ends ?? generator.endsOfBox(parameters.box);
  if (type === "line") return { ends };
  return { ends, controls: parameters.controls ?? straightControls(ends) };
}

function boxOfEnds(ends) {
  return generator.boxOfEnds(ends, LINE_HEIGHT);
}

function straightControls({ start, end }) {
  return {
    first: along(start, end, 1 / 3),
    second: along(start, end, 2 / 3),
  };
}

function along(start, end, fraction) {
  return {
    x: start.x + (end.x - start.x) * fraction,
    y: start.y + (end.y - start.y) * fraction,
  };
}

function resolutionFor(parameters, type) {
  const count = countOf(parameters);
  if (type === "grid") return { x: count, y: 1 };
  return count;
}

function countOf({ type, resolution }) {
  if (type === "grid") return resolution.x * resolution.y;
  return resolution;
}
