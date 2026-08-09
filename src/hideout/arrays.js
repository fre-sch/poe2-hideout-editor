/**
 * The parameters an array starts life with, and the one edit that is geometry
 * rather than typing: changing its type.
 *
 * `generator.js` reads parameters and `model.js` stores them; this is where a
 * set of them comes from. It is here and not in the sidebar because none of it
 * is a matter of buttons: fitting a shape to a selection and turning a box into
 * a line are arithmetic, and arithmetic is testable.
 */

import * as generator from "./generator.js";
import * as model from "./model.js";

/**
 * Room for a shape fitted to something with no size of its own -- one doodad,
 * or a row of them. In doodad units, where a hideout is a few hundred across
 * and doodads sit some ten apart, so a new array arrives big enough to see and
 * small enough to be somewhere.
 */
const MINIMUM_SIZE = 30;

/** What a `line` becomes a box of, having no thickness to keep. */
const LINE_HEIGHT = MINIMUM_SIZE;

const DEFAULT_CORNERS = 6;

/** A grid of nine is a shape a player can see the whole of and then change. */
const DEFAULT_RESOLUTION = { x: 3, y: 3 };

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
    box: boxAround(doodads),
    resolution: { ...DEFAULT_RESOLUTION },
    rotation: { base: 0, increment: 0, align: false },
    random: {
      seed: generator.randomSeed(),
      jitter: { x: 0, y: 0, rotation: 0 },
      variation: [],
    },
  };
}

/** What the generator keeps of a doodad: what it is, and which variation. */
function sourceOf(doodad) {
  return { hash: doodad.hash, name: doodad.name, fv: doodad.fv };
}

/**
 * An unturned box holding the given doodads.
 *
 * The axes cross over: a box's own x runs across its width and reaches the
 * doodads' `y`, which is `fromLocal`'s doing -- see `generator.js`. So a wide
 * box is wide on the screen, which is the only place a player reads it.
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

/**
 * The same array as another type: its geometry converted, and the fields the
 * new type needs and the old one had no use for filled in.
 *
 * The count is what carries over rather than the resolution itself, a grid
 * counting in two directions and everything else in one. Changing type twice is
 * therefore not quite a round trip -- three by three comes back as nine by one
 * -- and it says what it does: the doodads stay put and the shape changes under
 * them.
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
 * A `Generator` carries the geometry of its own type and no other -- see
 * `model.js` -- so the shape being left is the shape there is to convert. There
 * are two of them: a box, and a pair of ends.
 *
 * A curve arrives straight. Its controls sit a third and two thirds of the way
 * along the line between its ends, which is the Bézier that *is* that line, so a
 * shape becoming a curve does not move a doodad until the player bends it.
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
