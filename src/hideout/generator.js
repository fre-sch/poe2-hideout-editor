/**
 * Array placement: parameters in, `Doodad` objects out.
 *
 * Pure arithmetic -- no Konva, no signals, no fetch. A project file stores the
 * parameters and not the doodads, so this module *is* part of the file format
 * (wiki/decisions/array-placement.md) and is pinned by golden tests: changing
 * the math fails a test instead of a hideout.
 *
 * ## The parameters
 *
 *     layer       the layer id the doodads are written into
 *     type        "grid" | "ellipse" | "polygon" | "line" | "bezier"
 *     source      [{hash, name, fv}], cycled by index
 *     box           {center, width, height, rotation} the shapes that fill a box
 *     ends          {start, end}                      "line", "bezier"
 *     controls      {first, second}                   "bezier"
 *     corners       integer                           "polygon"
 *     distribution  "corners" | "edges"               "polygon"
 *     resolution  {x, y} for a grid, a number otherwise
 *     rotation    {base, increment, align}
 *     random      {seed, jitter: {x, y, rotation}, variation: [index, ...]}
 *
 * ## Frames
 *
 * Positions are in doodad units -- the space `Doodad.x` and `Doodad.y` live in
 * -- and angles are degrees the stage would read, which is what `units.js`
 * converts and what the sidebar shows. So there is exactly one place where the
 * axis swap and the rotation sense are reasoned about, and it is `units.js`.
 *
 * A shape is built in its own frame first: x across the box, y *up* it, the way
 * a player sees it. That frame is fixed by the polygon phase below -- a
 * triangle points up -- and the grid uses the same one, so its row `j = 0` is
 * the bottom row of the box.
 *
 * ## Where the points go
 *
 * The grid is a lattice at cell centres. A line, an ellipse and a Bézier are
 * polylines walked at equal arc length, which is why the curves come out evenly
 * spaced rather than crowded where they turn. A polygon is dealt to its edges
 * instead, so that a doodad lands *on* a corner rather than near one -- see
 * `alongEdges`.
 *
 * `outline` hands the same polyline to the gizmo, so what a player sees and what
 * the doodads sit on cannot disagree.
 */

import { Doodad } from "./model.js";
import * as units from "./units.js";
import * as variation from "./variation.js";

/**
 * How finely a curve is measured, not how many doodads it carries. A curve with
 * no closed-form arc length is walked by sampling it; 512 segments is accurate
 * to parts per million, for the ellipse and the Bézier alike.
 */
const CURVE_SEGMENTS = 512;

/** A step this close to the end of an edge starts the next one. See `pointAt`. */
const EPSILON = 1e-9;

/** Where a polygon's doodads sit. The default is `ON_CORNERS`. */
export const ON_CORNERS = "corners";
export const ON_EDGES = "edges";

const DEGREE = Math.PI / 180;

/**
 * The doodads a generator evaluates to, in index order.
 *
 * A source of nothing is refused rather than evaluated to nothing: `source` is
 * cycled by index, so an empty one is a division by zero wearing a modulo, and
 * an array that quietly places nothing is a layout a player has to work out for
 * themselves. The sidebar keeps the last source doodad for the same reason.
 */
export function generate(generator) {
  if (!generator.source?.length) {
    throw new Error(`Array '${generator.layer}' has no doodad to place`);
  }
  return placements(generator).map((placement, index) =>
    doodadAt(generator, index, placement),
  );
}

/**
 * The polyline a shape is drawn as: the points in doodad units, and whether the
 * last one joins the first.
 *
 * For every type but the grid it is also the polyline the walk consumes, so
 * what a player sees and what the doodads sit on cannot disagree. A grid's
 * doodads are a lattice instead, and what it is drawn as is the box they are
 * spread inside -- the same box, through the same frame change.
 */
export function outline(generator) {
  switch (generator.type) {
    case "line":
      return {
        points: [generator.ends.start, generator.ends.end],
        closed: false,
      };
    case "polygon":
      return {
        points: polygonCorners(generator.box, generator.corners),
        closed: true,
      };
    case "bezier":
      return {
        points: bezierPoints(generator.ends, generator.controls),
        closed: false,
      };
    case "ellipse":
      return { points: ellipsePoints(generator.box), closed: true };
    case "grid":
      return { points: boxCorners(generator.box), closed: true };
    default:
      throw new Error(`A '${generator.type}' has no outline`);
  }
}

/** A new seed for the "Regenerate seed" button: 32 bits, unsigned. */
export function randomSeed() {
  return Math.floor(Math.random() * 0x100000000) >>> 0;
}

/**
 * The two ends of a box's own x axis: what a shape becomes when its type is
 * changed to `line`.
 *
 * The pair with the reverse below is here rather than in the sidebar that asks
 * for it, because both are the frame change of `fromLocal` read in one direction
 * or the other -- and the frames are reasoned about in this module only.
 */
export function endsOfBox(box) {
  const half = box.width / 2;
  return {
    start: fromLocal({ x: -half, y: 0 }, box),
    end: fromLocal({ x: half, y: 0 }, box),
  };
}

/**
 * The box a line spans, given the height it is to have: its own x axis runs
 * from one end to the other, so a shape made out of a line keeps the line's
 * length and the direction it was drawn in.
 */
export function boxOfEnds(ends, height) {
  const span = { x: ends.end.x - ends.start.x, y: ends.end.y - ends.start.y };
  return {
    center: scale(add(ends.start, ends.end), 0.5),
    width: Math.hypot(span.x, span.y),
    height,
    rotation: angleOf(span),
  };
}

/**
 * Where the doodads land and which way the shape runs there, before any
 * rotation or jitter: `{x, y, direction}` in doodad units and stage degrees.
 *
 * `direction` is the local x axis -- the box's own x for a grid, the tangent
 * for an outline -- and it is both what *align to shape* faces a doodad along
 * and the frame position jitter is applied in.
 */
function placements(generator) {
  if (generator.type === "grid") return lattice(generator);
  if (generator.type === "polygon") return alongEdges(generator);
  return walk(outline(generator), countOf(generator));
}

/**
 * A polygon's doodads, dealt to its edges rather than walked around its
 * perimeter.
 *
 * The walk is right for the shapes that have nothing to land on: equal arc
 * length is even spacing, and an ellipse has no corners to miss. A polygon is
 * chosen *for* its corners, and a walk lands a doodad a hair off one whenever
 * the arithmetic does not come out exactly -- which reads as a mistake at every
 * corner of a sharp shape. So the count is shared out edge by edge, and each
 * edge lays its share out from one end: a doodad is on a corner or it is not.
 *
 * The two distributions are one half-step apart. `ON_CORNERS` starts each edge
 * at its own start corner and follows at `step / share`. `ON_EDGES` sits at
 * `(step + 0.5) / share`, which is the edge's midpoint for a share of one and
 * stays centred on it for more.
 *
 * The cost lands on a box that is not square: a stretched polygon has edges of
 * different lengths, and equal shares on unequal edges are not equal spacing.
 * That is the trade a shape with corners is asking for -- a corner every time,
 * against a gap that varies -- and the ellipse is there for the other answer.
 */
function alongEdges(generator) {
  const corners = polygonCorners(generator.box, generator.corners);
  const count = countOf(generator);
  const phase = generator.distribution === ON_EDGES ? 0.5 : 0;
  return corners.flatMap((from, index) => {
    const to = corners[(index + 1) % corners.length];
    const share = shareOf(count, corners.length, index);
    return range(share).map((step) =>
      pointAlong(from, to, (step + phase) / share, generator.box.center),
    );
  });
}

/**
 * Edge `index`'s share of `count` doodads over `edges` edges: as even as whole
 * doodads allow, and the shares add up to the count by construction rather than
 * by a correction afterwards. Fewer doodads than edges leaves some edges empty,
 * which the sidebar warns about.
 */
function shareOf(count, edges, index) {
  return (
    Math.floor(((index + 1) * count) / edges) -
    Math.floor((index * count) / edges)
  );
}

/**
 * A point a fraction along an edge, and which way the shape runs there.
 *
 * A doodad on the corner is the one case the edge cannot answer: it belongs to
 * the edge arriving and the edge leaving equally, so neither direction is its.
 * The box's centre is what can say -- the corner faces along the circle through
 * it, which is where the two edges average to, and which is the same answer at
 * every corner of a regular shape.
 */
function pointAlong(from, to, fraction, center) {
  const span = { x: to.x - from.x, y: to.y - from.y };
  const at = add(from, scale(span, fraction));
  return {
    ...at,
    direction: fraction === 0 ? facingFrom(center, at) : angleOf(span),
  };
}

/** The tangent at a point of the circle about a centre, in stage degrees. */
function facingFrom(center, at) {
  return angleOf({ x: at.x - center.x, y: at.y - center.y }) - 90;
}

function countOf(generator) {
  const resolution = generator.resolution;
  if (generator.type === "grid") {
    return whole(resolution.x) * whole(resolution.y);
  }
  return whole(resolution);
}

function whole(count) {
  return Math.max(0, Math.floor(count) || 0);
}

/**
 * Cell centres, `j * n_x + i` along the box's own x first.
 *
 * Centres rather than a corner-to-corner lattice: the margins come out even, a
 * resolution of 1 is the middle of the box rather than a division by zero, and
 * nothing lands on the boundary the player drew.
 */
function lattice({ box, resolution }) {
  const columns = whole(resolution.x);
  const rows = whole(resolution.y);
  const points = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const local = {
        x: ((column + 0.5) / columns - 0.5) * box.width,
        y: ((row + 0.5) / rows - 0.5) * box.height,
      };
      points.push({ ...fromLocal(local, box), direction: box.rotation });
    }
  }
  return points;
}

/**
 * The regular k-gon scaled so its bounding box *is* the box.
 *
 * Vertex `m` of `k` at `-90 + 180/k + m * 360/k`, which puts an edge at the
 * bottom: four corners are the box's own corners and a triangle points up. An
 * odd corner count is not symmetric about its centre, so the fit recentres as
 * well as scales.
 */
function polygonCorners(box, corners) {
  const count = Math.max(3, Math.floor(corners) || 3);
  const phase = -90 + 180 / count;
  const unit = range(count).map((vertex) => {
    const angle = (phase + (vertex * 360) / count) * DEGREE;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  });
  return fitToBox(unit, box).map((local) => fromLocal(local, box));
}

/** The box's own four corners, anticlockwise from its bottom left. */
function boxCorners(box) {
  const half = { x: box.width / 2, y: box.height / 2 };
  return [
    { x: -half.x, y: -half.y },
    { x: half.x, y: -half.y },
    { x: half.x, y: half.y },
    { x: -half.x, y: half.y },
  ].map((local) => fromLocal(local, box));
}

/**
 * A cubic Bézier as a polyline, open, both ends included.
 *
 * Cubic and not quadratic: one control point per end is what draws an S, and a
 * path along a hideout wall bends twice as often as it bends once. It is
 * sampled and then walked like every other polyline, so the doodads come out
 * evenly spaced along the curve rather than crowded where it turns -- the
 * ellipse's reasoning, and the same ruler.
 *
 * The samples are the drawing as well, `outline` handing them to the gizmo, so a
 * curve a player sees is the curve the doodads sit on.
 */
function bezierPoints(ends, controls) {
  return range(CURVE_SEGMENTS + 1).map((step) =>
    bezierAt(ends, controls, step / CURVE_SEGMENTS),
  );
}

/** The point at parameter `t`, by the Bernstein weights. */
function bezierAt({ start, end }, { first, second }, t) {
  const rest = 1 - t;
  return add(
    add(scale(start, rest * rest * rest), scale(first, 3 * rest * rest * t)),
    add(scale(second, 3 * rest * t * t), scale(end, t * t * t)),
  );
}

function ellipsePoints(box) {
  return range(CURVE_SEGMENTS).map((segment) => {
    const angle = (segment / CURVE_SEGMENTS) * 2 * Math.PI;
    const local = {
      x: (Math.cos(angle) * box.width) / 2,
      y: (Math.sin(angle) * box.height) / 2,
    };
    return fromLocal(local, box);
  });
}

/** Local points stretched and shifted so that their extent is the box's. */
function fitToBox(points, box) {
  const x = extentOf(points.map((point) => point.x));
  const y = extentOf(points.map((point) => point.y));
  return points.map((point) => ({
    x: (point.x - x.middle) * (box.width / x.span),
    y: (point.y - y.middle) * (box.height / y.span),
  }));
}

function extentOf(values) {
  const low = Math.min(...values);
  const high = Math.max(...values);
  return { middle: (low + high) / 2, span: high - low || 1 };
}

/**
 * `count` points spread along a polyline at equal arc length.
 *
 * A closed outline steps by `length / count`, so the last point does not land
 * on the first. An open one steps by `length / (count - 1)`, so both endpoints
 * carry a doodad; a single point on an open line sits at its start, there being
 * no way for one doodad to be at both ends.
 */
function walk({ points, closed }, count) {
  if (count < 1) return [];

  const segments = segmentsOf(points, closed);
  const length = segments.reduce((total, segment) => total + segment.length, 0);
  const step = closed ? length / count : length / Math.max(count - 1, 1);
  return range(count).map((index) => pointAt(segments, index * step));
}

function segmentsOf(points, closed) {
  const ends = closed ? [...points, points[0]] : points;
  return range(ends.length - 1).map((index) => {
    const from = ends[index];
    const span = {
      x: ends[index + 1].x - from.x,
      y: ends[index + 1].y - from.y,
    };
    return {
      from,
      span,
      length: Math.hypot(span.x, span.y),
      direction: angleOf(span),
    };
  });
}

/**
 * The point at an arc length along the polyline, and the direction of the edge
 * carrying it.
 *
 * A step landing on a joint belongs to the edge it *starts*, so a walk reads the
 * direction it is about to travel in rather than the one it has finished with.
 * The last edge takes whatever is left over, so the end of an open walk lands on
 * the final point rather than falling off it.
 *
 * Only the line and the ellipse are walked. A polygon's corners are worth
 * landing on exactly, which arc length cannot promise -- see `alongEdges`.
 */
function pointAt(segments, distance) {
  let remaining = distance;
  for (const [index, segment] of segments.entries()) {
    const last = index === segments.length - 1;
    if (remaining < segment.length - EPSILON || last) {
      const fraction = segment.length > 0 ? remaining / segment.length : 0;
      return {
        x: segment.from.x + segment.span.x * fraction,
        y: segment.from.y + segment.span.y * fraction,
        direction: segment.direction,
      };
    }
    remaining -= segment.length;
  }
  return { x: 0, y: 0, direction: 0 };
}

/**
 * One placement as the file holds it. The only rounding in the module is here,
 * where a `Doodad` is created; a parameter that is rounded on every apply
 * drifts.
 */
function doodadAt(generator, index, placement) {
  const source = generator.source[index % generator.source.length];
  const point = jittered(placement, index, generator.random);
  return new Doodad(
    source.name,
    {
      hash: source.hash,
      x: round(point.x),
      y: round(point.y),
      r: units.fromDegrees(facing(generator, index, placement)),
      fv: variationAt(source.fv, generator, index),
    },
    generator.layer,
  );
}

/** `tangent + base + index * increment`, then jitter. */
function facing(generator, index, placement) {
  const rotation = generator.rotation ?? {};
  const tangent = alignsToShape(generator) ? placement.direction : 0;
  const turned =
    tangent + (rotation.base ?? 0) + index * (rotation.increment ?? 0);
  return turned + noise(generator.random, index, "rotation");
}

/** The grid ignores *align to shape*: the box rotation already faces it. */
function alignsToShape(generator) {
  return generator.type !== "grid" && Boolean(generator.rotation?.align);
}

/**
 * Position jitter in the shape's local frame: `x` along the direction the shape
 * runs, `y` across it. So jitter on a rotated grid pushes doodads along the
 * grid, and on a fence it is a jitter along the fence and a jitter across it.
 */
function jittered(placement, index, random) {
  const along = directionVector(placement.direction);
  const across = rotate(along, -90);
  return add(
    placement,
    add(
      scale(along, noise(random, index, "x")),
      scale(across, noise(random, index, "y")),
    ),
  );
}

function variationAt(fv, generator, index) {
  const indices = generator.random?.variation;
  if (!indices?.length) return fv;
  return variation.withIndex(
    fv,
    indices[
      hash(generator.random.seed, index, CHANNEL.variation) % indices.length
    ],
  );
}

/**
 * A channel's displacement for one doodad: uniform in `[-1, 1)` times the
 * magnitude the parameters give it, so jitter never exceeds its magnitude.
 */
function noise(random, index, channel) {
  const magnitude = random?.jitter?.[channel] ?? 0;
  if (!magnitude) return 0;

  const value = hash(random.seed, index, CHANNEL[channel]) / 0x100000000;
  return (value * 2 - 1) * magnitude;
}

const CHANNEL = { x: 1, y: 2, rotation: 3, variation: 4 };

/**
 * A hash of `(seed, index, channel)`, not a stream.
 *
 * A sequence would mean that changing the resolution from forty to forty-one
 * reshuffles all forty. A hash means doodad 12 keeps what it had, whatever else
 * changed. The mixing is the murmur3 finaliser, inline because one hash is not
 * a dependency.
 */
function hash(seed, index, channel) {
  let value = (seed ?? 0) >>> 0;
  value = Math.imul(value ^ (index + 1), 0x9e3779b1) >>> 0;
  value = Math.imul(value ^ channel, 0x85ebca6b) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;
  return value >>> 0;
}

/**
 * A point of the shape's own frame -- x across the box, y up it -- in doodad
 * units, turned by the box rotation and placed at its centre.
 *
 * The two swaps are the frame change: doodad units see the floor from above
 * with the axes exchanged, and the stage sees y growing downwards.
 */
function fromLocal({ x, y }, box) {
  return add(box.center, rotate({ x: -y, y: x }, box.rotation));
}

/** A vector in doodad units, turned by an angle the stage would read. */
function rotate({ x, y }, degrees) {
  const angle = degrees * DEGREE;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: x * cos + y * sin, y: -x * sin + y * cos };
}

/** The angle the stage would read off a direction in doodad units. */
function angleOf({ x, y }) {
  return Math.atan2(x, y) / DEGREE;
}

/** The unit vector at a stage angle, in doodad units. */
function directionVector(degrees) {
  return rotate({ x: 0, y: 1 }, degrees);
}

function add(first, second) {
  return { x: first.x + second.x, y: first.y + second.y };
}

function scale({ x, y }, factor) {
  return { x: x * factor, y: y * factor };
}

// The `+ 0` is `units.js`'s: rounding a small negative gives -0, which equals
// zero under every comparison but `Object.is` and prints as "-0".
function round(value) {
  return Math.round(value) + 0;
}

function range(count) {
  return Array.from({ length: count }, (_, index) => index);
}
