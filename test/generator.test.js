/**
 * The array generator's math.
 *
 * Two kinds of test here, and the second kind is the point. The first states
 * the rules -- counts, endpoints, corners, arc length, the lattice, the frame
 * -- in the terms wiki/issues/0032-hideout-array-generator-math.md accepts
 * them. The second is the golden tests: fixed parameters and a fixed seed
 * against the exact doodads they produce. A project file stores parameters and
 * not doodads, so the math is part of the file format and a change to it moves
 * a saved player's hideout. The goldens make that change deliberate.
 *
 * Positions are in doodad units, which the stage sees with its axes swapped --
 * local x runs along the box's width and becomes doodad `y`, local y runs up
 * the box and becomes doodad `-x`. `local` below is that inverse, and it is
 * what makes the geometry here readable as the shape a player drew.
 */

import { describe, expect, it } from "vitest";

import * as generator from "../src/hideout/generator.js";
import * as units from "../src/hideout/units.js";
import * as variation from "../src/hideout/variation.js";

const STASH = { hash: 3230065491, name: "Stash", fv: 0 };

function array(parameters) {
  return {
    layer: "layer-2",
    source: [STASH],
    rotation: { base: 0, increment: 0, align: false },
    random: { seed: 1, jitter: { x: 0, y: 0, rotation: 0 }, variation: [] },
    ...parameters,
  };
}

/** A box centred on the origin, so that local and doodad units differ only by
 * the frame and the arithmetic in a test stays readable. */
function box(width, height, rotation = 0) {
  return { center: { x: 0, y: 0 }, width, height, rotation };
}

/** A doodad's position back in the shape's own frame. */
function local(doodad) {
  return { x: doodad.y, y: -doodad.x };
}

function positions(doodads) {
  return doodads.map((doodad) => ({ x: doodad.x, y: doodad.y }));
}

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

/**
 * An angle wrapped into `(-180, 180]`. A doodad's `r` is a turn, so reading a
 * rotation of 10 degrees back out of one gives -350 unless it is wrapped.
 */
function wrapped(degrees) {
  return degrees - 360 * Math.round(degrees / 360);
}

describe("resolution", () => {
  const shapes = {
    grid: { type: "grid", box: box(100, 100), resolution: { x: 1, y: 1 } },
    line: {
      type: "line",
      ends: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
      resolution: 1,
    },
    ellipse: { type: "ellipse", box: box(100, 100), resolution: 1 },
    polygon: {
      type: "polygon",
      corners: 5,
      box: box(100, 100),
      resolution: 1,
    },
    bezier: {
      type: "bezier",
      ends: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
      controls: { first: { x: 0, y: 50 }, second: { x: 100, y: 50 } },
      resolution: 1,
    },
  };

  for (const [name, shape] of Object.entries(shapes)) {
    it(`places one doodad at a resolution of one: ${name}`, () => {
      expect(generator.generate(array(shape))).toHaveLength(1);
    });
  }

  it("multiplies the two resolutions of a grid", () => {
    const doodads = generator.generate(
      array({ type: "grid", box: box(100, 100), resolution: { x: 3, y: 4 } }),
    );
    expect(doodads).toHaveLength(12);
  });

  it("counts an outline's doodads by its single resolution", () => {
    for (const count of [2, 7, 40]) {
      const doodads = generator.generate(
        array({ type: "ellipse", box: box(100, 100), resolution: count }),
      );
      expect(doodads).toHaveLength(count);
    }
  });

  it("writes the doodads into the layer the generator names", () => {
    const doodads = generator.generate(
      array({ type: "ellipse", box: box(100, 100), resolution: 3 }),
    );
    expect(doodads.map((doodad) => doodad.layer)).toEqual([
      "layer-2",
      "layer-2",
      "layer-2",
    ]);
  });
});

describe("line", () => {
  const ends = { start: { x: -100, y: -50 }, end: { x: 300, y: 150 } };

  it("puts its first and last doodads on its endpoints", () => {
    const doodads = generator.generate(
      array({ type: "line", ends, resolution: 9 }),
    );
    expect(positions(doodads).at(0)).toEqual(ends.start);
    expect(positions(doodads).at(-1)).toEqual(ends.end);
  });

  it("spaces the rest evenly between them", () => {
    const places = positions(
      generator.generate(array({ type: "line", ends, resolution: 5 })),
    );
    const steps = places.slice(1).map((point, index) => {
      return distance(places[index], point);
    });
    for (const step of steps) {
      expect(step).toBeCloseTo(steps[0], 6);
    }
  });
});

describe("bezier", () => {
  const ends = { start: { x: 0, y: 0 }, end: { x: 400, y: 0 } };

  function curve(controls, parameters) {
    return array({ type: "bezier", ends, controls, ...parameters });
  }

  it("puts its first and last doodads on its endpoints", () => {
    const places = positions(
      generator.generate(
        curve(
          { first: { x: 0, y: 300 }, second: { x: 400, y: 300 } },
          { resolution: 7 },
        ),
      ),
    );
    expect(places.at(0)).toEqual(ends.start);
    expect(places.at(-1)).toEqual(ends.end);
  });

  /**
   * The case that decides the walk. Both controls on the start point make a
   * curve that covers a straight line at `t³`, so stepping the parameter would
   * pile seven doodads into the first quarter of it. Stepping the arc length
   * spaces them evenly, which here is a number a test can name exactly.
   */
  it("spaces the doodads by length and not by parameter", () => {
    const places = positions(
      generator.generate(
        curve({ first: { ...ends.start }, second: { ...ends.start } }, { resolution: 5 }),
      ),
    );
    expect(places).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 300, y: 0 },
      { x: 400, y: 0 },
    ]);
  });

  /** Controls a third and two thirds along are the straight line itself, which
   * is what a shape arrives as when it is changed to a curve. */
  it("is the line between its ends until it is bent", () => {
    const straight = generator.generate(
      curve(
        { first: { x: 400 / 3, y: 0 }, second: { x: 800 / 3, y: 0 } },
        { resolution: 5 },
      ),
    );
    expect(positions(straight).map((point) => point.x)).toEqual([
      0, 100, 200, 300, 400,
    ]);
  });

  it("draws the curve it walks, open and sampled", () => {
    const drawn = generator.outline(
      curve({ first: { x: 0, y: 300 }, second: { x: 400, y: 300 } }),
    );

    expect(drawn.closed).toBe(false);
    expect(drawn.points.at(0)).toEqual(ends.start);
    expect(drawn.points.at(-1)).toEqual(ends.end);
    expect(drawn.points.length).toBeGreaterThan(100);
  });

  /** An S bends both ways, which is what the second control is for. */
  it("bends twice where the controls pull opposite ways", () => {
    const places = positions(
      generator.generate(
        curve(
          { first: { x: 0, y: 200 }, second: { x: 400, y: -200 } },
          { resolution: 21 },
        ),
      ),
    );
    expect(Math.max(...places.map((point) => point.y))).toBeGreaterThan(20);
    expect(Math.min(...places.map((point) => point.y))).toBeLessThan(-20);
  });
});

describe("polygon", () => {
  /**
   * The shape fills the box, which for four corners means the box itself --
   * a wide one included, where a k-gon on the inscribed ellipse would draw a
   * diamond. It is the outline that is tested and not the doodads: a walk by
   * arc length lands on the corners only when the edges are equal, which the
   * next test is about.
   */
  it("draws a four-corner polygon as the corners of a wide box", () => {
    const corners = generator.outline(
      array({ type: "polygon", corners: 4, box: box(4000, 2000) }),
    ).points;
    const rounded = corners
      .map(local)
      .map((corner) => ({ x: Math.round(corner.x), y: Math.round(corner.y) }));
    expect(new Set(rounded.map(JSON.stringify))).toEqual(
      new Set(
        [
          { x: 2000, y: 1000 },
          { x: 2000, y: -1000 },
          { x: -2000, y: -1000 },
          { x: -2000, y: 1000 },
        ].map(JSON.stringify),
      ),
    );
  });

  /** The box a triangle stays regular in, and the apex fills its top edge. */
  it("points a triangle up, with an edge along the bottom", () => {
    const doodads = generator.generate(
      array({ type: "polygon", corners: 3, box: box(1732, 1500), resolution: 3 }),
    );
    const corners = doodads.map(local);
    expect(corners.filter((corner) => corner.y > 0)).toHaveLength(1);
    expect(Math.max(...corners.map((corner) => corner.y))).toBe(750);
  });

  it("divides every edge evenly at a multiple of its corner count", () => {
    const square = { type: "polygon", corners: 4, box: box(24000, 24000) };
    const places = positions(generator.generate(array({ ...square, resolution: 12 })));

    for (const corner of cornersOf(square)) {
      expect(places).toContainEqual(corner);
    }

    const steps = places.map((point, index) => {
      return distance(point, places[(index + 1) % places.length]);
    });
    for (const step of steps) {
      expect(step).toBeCloseTo(steps[0], 6);
    }
  });

  /**
   * The corners are the reason a polygon is a polygon, so a doodad is on one or
   * it is not. A walk by arc length lands a hair off instead whenever the
   * arithmetic does not come out exactly -- the shape a stretched box makes it,
   * where the edges are of two different lengths.
   */
  it("lands on every corner of a stretched polygon, exactly", () => {
    const wide = { type: "polygon", corners: 5, box: box(4000, 1000) };
    const places = generator
      .generate(array({ ...wide, resolution: 10 }))
      .map((doodad) => ({ x: doodad.x, y: doodad.y }));

    for (const corner of cornersOf(wide)) {
      expect(places).toContainEqual(corner);
    }
  });

  /**
   * A corner belongs to two edges equally, so it faces along neither: it takes
   * the direction the two average to, which is the tangent of the circle through
   * it. On a square that is 45 degrees off each edge.
   */
  it("faces a doodad on a corner between its two edges", () => {
    const aligned = { base: 0, increment: 0, align: true };
    const square = array({
      type: "polygon",
      corners: 4,
      box: box(1000, 1000),
      resolution: 8,
      rotation: aligned,
    });
    // Eight doodads on a square: a corner, then a middle, all the way round.
    const facing = generator
      .generate(square)
      .map((doodad) => wrapped(units.toDegrees(doodad.r)));

    for (let corner = 0; corner < 8; corner += 2) {
      const edge = facing[corner + 1];
      expect(wrapped(facing[corner] - edge)).toBeCloseTo(45, 3);
    }
  });

  /**
   * The other distribution: the doodads sit about the middles of the edges, so
   * one per edge is one in the middle of each and no doodad is on a corner.
   */
  it("puts a doodad on every edge's middle where asked", () => {
    const square = {
      type: "polygon",
      corners: 4,
      box: box(1000, 1000),
      distribution: generator.ON_EDGES,
    };
    const places = positions(generator.generate(array({ ...square, resolution: 4 })));

    // In doodad units, which is where a midpoint of zero is a plain zero: the
    // local frame negates one axis and would report it as -0.
    expect(places).toEqual([
      { x: 0, y: 500 },
      { x: -500, y: 0 },
      { x: 0, y: -500 },
      { x: 500, y: 0 },
    ]);
    for (const corner of cornersOf(square)) {
      expect(places).not.toContainEqual(corner);
    }
  });

  /** Two per edge stay centred on its middle rather than starting at a corner. */
  it("spreads a bigger share about the middle it is given", () => {
    const places = positions(
      generator.generate(
        array({
          type: "polygon",
          corners: 4,
          box: box(1000, 1000),
          distribution: generator.ON_EDGES,
          resolution: 8,
        }),
      ),
    ).map(local);

    // The first edge runs up the box's own x, so its two share the same local x
    // and sit a quarter of the way in from each end.
    expect(places[0]).toEqual({ x: 500, y: -250 });
    expect(places[1]).toEqual({ x: 500, y: 250 });
  });

  /**
   * Fewer doodads than corners is not an error and not rounded up to one: the
   * shares are dealt out and some edges get none, which the sidebar warns about
   * in the words of whichever distribution is on.
   */
  it("deals a count that does not divide out over the edges", () => {
    const hexagon = {
      type: "polygon",
      corners: 6,
      box: box(1000, 1000),
    };
    expect(generator.generate(array({ ...hexagon, resolution: 4 }))).toHaveLength(4);
    expect(generator.generate(array({ ...hexagon, resolution: 8 }))).toHaveLength(8);
  });

  /** The corners as a doodad's rounded position would report them. */
  function cornersOf(polygon) {
    return generator
      .outline(array(polygon))
      .points.map((point) => ({
        x: Math.round(point.x),
        y: Math.round(point.y),
      }));
  }
});

describe("ellipse", () => {
  /**
   * The arc length of an ellipse from its local +x axis to a parameter angle,
   * summed straight off the integral. Independent of the generator's own
   * 512-segment ruler, which is the point of measuring it here.
   */
  function arcLength(radii, angle) {
    const steps = 20000;
    let total = 0;
    for (let step = 0; step < steps; step++) {
      const at = (angle * (step + 0.5)) / steps;
      total +=
        Math.hypot(radii.x * Math.sin(at), radii.y * Math.cos(at)) *
        (angle / steps);
    }
    return total;
  }

  function arcSteps(width, height, count) {
    const radii = { x: width / 2, y: height / 2 };
    const doodads = generator.generate(
      array({ type: "ellipse", box: box(width, height), resolution: count }),
    );
    const angles = doodads.map((doodad) => {
      const point = local(doodad);
      const angle = Math.atan2(point.y / radii.y, point.x / radii.x);
      return angle < 0 ? angle + 2 * Math.PI : angle;
    });
    return angles
      .slice(1)
      .map((angle, index) => arcLength(radii, angle) - arcLength(radii, angles[index]));
  }

  it("spaces a circle's doodads evenly", () => {
    const steps = arcSteps(2000, 2000, 12);
    for (const step of steps) {
      expect(step).toBeCloseTo(steps[0], 0);
    }
  });

  /** The case that decided the walk: stepping the parameter instead would
   * crowd the doodads at the two pointy ends. */
  it("spaces a three-to-one ellipse's doodads evenly by arc length", () => {
    const steps = arcSteps(6000, 2000, 12);
    for (const step of steps) {
      expect(step / steps[0]).toBeCloseTo(1, 2);
    }
  });
});

describe("grid", () => {
  it("lays cell centres out along the box, indexed by row", () => {
    const doodads = generator.generate(
      array({ type: "grid", box: box(400, 200), resolution: { x: 2, y: 2 } }),
    );
    expect(doodads.map(local)).toEqual([
      { x: -100, y: -50 },
      { x: 100, y: -50 },
      { x: -100, y: 50 },
      { x: 100, y: 50 },
    ]);
  });

  it("follows the box's rotation and not the world's axes", () => {
    const doodads = generator.generate(
      array({ type: "grid", box: box(1000, 500, 90), resolution: { x: 2, y: 1 } }),
    );
    expect(positions(doodads)).toEqual([
      { x: -250, y: 0 },
      { x: 250, y: 0 },
    ]);
  });
});

describe("rotation", () => {
  const ends = { start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } };

  function degrees(doodads) {
    return doodads.map((doodad) => wrapped(units.toDegrees(doodad.r)));
  }

  it("adds the increment doodad by doodad", () => {
    const doodads = generator.generate(
      array({
        type: "line",
        ends,
        resolution: 4,
        rotation: { base: 10, increment: 15, align: false },
      }),
    );
    expect(degrees(doodads).map(Math.round)).toEqual([10, 25, 40, 55]);
  });

  it("faces a doodad along the shape when aligned", () => {
    const doodads = generator.generate(
      array({
        type: "line",
        ends,
        resolution: 2,
        rotation: { base: 0, increment: 0, align: true },
      }),
    );
    // The line runs along doodad x, which the stage draws pointing down.
    expect(degrees(doodads).map(Math.round)).toEqual([90, 90]);
  });

  it("leaves a grid's rotation to the box, aligned or not", () => {
    const aligned = { base: 20, increment: 0, align: true };
    const doodads = generator.generate(
      array({ type: "grid", box: box(100, 100, 45), resolution: { x: 2, y: 1 }, rotation: aligned }),
    );
    expect(degrees(doodads).map(Math.round)).toEqual([20, 20]);
  });
});

describe("randomness", () => {
  const ends = { start: { x: 0, y: 0 }, end: { x: 4000, y: 0 } };
  const jittering = {
    type: "line",
    ends,
    rotation: { base: 0, increment: 0, align: false },
    random: {
      seed: 2463534242,
      jitter: { x: 30, y: 30, rotation: 20 },
      variation: [],
    },
  };

  it("repeats itself exactly for the same seed and parameters", () => {
    const parameters = array({ ...jittering, resolution: 20 });
    const first = generator.generate(parameters).map((d) => d.toFields());
    const second = generator.generate(parameters).map((d) => d.toFields());
    expect(second).toEqual(first);
  });

  it("differs for a different seed", () => {
    const one = generator.generate(array({ ...jittering, resolution: 20 }));
    const other = generator.generate(
      array({
        ...jittering,
        resolution: 20,
        random: { ...jittering.random, seed: 1 },
      }),
    );
    expect(positions(other)).not.toEqual(positions(one));
  });

  /**
   * Stability across a change of resolution, channel by channel. Positions
   * move because the shape is divided differently -- that is the resolution
   * doing its job -- so each channel is isolated from that: rotation does not
   * depend on the count at all, and a line of zero length places every doodad
   * at one point, leaving the position jitter alone to be compared.
   */
  describe("changing the resolution from 40 to 41", () => {
    function fieldsAt(resolution, parameters = {}) {
      return generator
        .generate(array({ ...jittering, ...parameters, resolution }))
        .slice(0, 40)
        .map((doodad) => doodad.toFields());
    }

    it("leaves the rotation of doodads 0 to 39 alone", () => {
      expect(fieldsAt(41).map((fields) => fields.r)).toEqual(
        fieldsAt(40).map((fields) => fields.r),
      );
    });

    it("leaves the position jitter of doodads 0 to 39 alone", () => {
      const still = { ends: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } } };
      expect(fieldsAt(41, still)).toEqual(fieldsAt(40, still));
    });

    it("leaves the variations of doodads 0 to 39 alone", () => {
      const varied = {
        random: { ...jittering.random, variation: [0, 1, 2, 3, 4, 5] },
      };
      expect(fieldsAt(41, varied).map((fields) => fields.fv)).toEqual(
        fieldsAt(40, varied).map((fields) => fields.fv),
      );
    });
  });

  it("never displaces a doodad further than the jitter magnitude", () => {
    const magnitude = { x: 30, y: 12, rotation: 20 };
    const parameters = { ...jittering, resolution: 50 };
    const jittered = generator.generate(
      array({ ...parameters, random: { ...jittering.random, jitter: magnitude } }),
    );
    const still = generator.generate(
      array({
        ...parameters,
        random: { ...jittering.random, jitter: { x: 0, y: 0, rotation: 0 } },
      }),
    );

    const reach = Math.hypot(magnitude.x, magnitude.y);
    jittered.forEach((doodad, index) => {
      // One unit of slack for the rounding that makes a doodad's position
      // integral.
      expect(distance(doodad, still[index])).toBeLessThanOrEqual(reach + 1);
      const turned = wrapped(
        units.toDegrees(doodad.r) - units.toDegrees(still[index].r),
      );
      expect(Math.abs(turned)).toBeLessThanOrEqual(magnitude.rotation + 0.01);
    });
  });
});

describe("variation", () => {
  const mirroredSource = { hash: 4, name: "Maraketh Chest", fv: 128 + 3 };

  function generated(source, indices) {
    return generator.generate(
      array({
        type: "line",
        source: [source],
        ends: { start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } },
        resolution: 30,
        random: { seed: 4242, jitter: { x: 0, y: 0, rotation: 0 }, variation: indices },
      }),
    );
  }

  it("chooses from the indices it was given, and only those", () => {
    const indices = [2, 5, 9];
    const chosen = generated(STASH, indices).map((doodad) =>
      variation.of(doodad.fv),
    );
    expect(new Set(chosen)).toEqual(new Set(indices));
    for (const index of chosen) {
      expect(indices).toContain(index);
    }
  });

  it("keeps a mirrored source doodad mirrored", () => {
    for (const doodad of generated(mirroredSource, [0, 1, 2])) {
      expect(variation.mirrored(doodad.fv)).toBe(true);
    }
  });

  it("leaves the source's own variation alone when given no indices", () => {
    for (const doodad of generated(mirroredSource, [])) {
      expect(doodad.fv).toBe(mirroredSource.fv);
    }
  });
});

describe("source", () => {
  it("cycles the sources by index", () => {
    const sources = [
      { hash: 1, name: "One", fv: 0 },
      { hash: 2, name: "Two", fv: 5 },
    ];
    const doodads = generator.generate(
      array({
        type: "grid",
        source: sources,
        box: box(100, 100),
        resolution: { x: 5, y: 1 },
      }),
    );
    expect(doodads.map((doodad) => doodad.hash)).toEqual([1, 2, 1, 2, 1]);
    expect(doodads.map((doodad) => doodad.name)).toEqual([
      "One",
      "Two",
      "One",
      "Two",
      "One",
    ]);
    expect(doodads.map((doodad) => doodad.fv)).toEqual([0, 5, 0, 5, 0]);
  });
});

describe("outline", () => {
  it("hands the gizmo the polyline the walk consumes", () => {
    const line = generator.outline(
      array({
        type: "line",
        ends: { start: { x: 1, y: 2 }, end: { x: 3, y: 4 } },
      }),
    );
    expect(line).toEqual({
      points: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      closed: false,
    });

    expect(
      generator.outline(array({ type: "polygon", corners: 6, box: box(100, 100) })),
    ).toMatchObject({ closed: true });
    expect(
      generator.outline(array({ type: "ellipse", box: box(100, 100) })).points,
    ).toHaveLength(512);
  });

  /**
   * A grid's doodads are a lattice and not a walk, so its outline is the one
   * thing there is to draw: the box they are spread inside, through the same
   * frame change everything else goes through.
   */
  it("draws a grid as its own box", () => {
    const drawn = generator.outline(array({ type: "grid", box: box(100, 40) }));

    expect(drawn.closed).toBe(true);
    expect(drawn.points.map(local)).toEqual([
      { x: -50, y: -20 },
      { x: 50, y: -20 },
      { x: 50, y: 20 },
      { x: -50, y: 20 },
    ]);
  });
});

/**
 * The two conversions a change of type is made of. They live in this module
 * because they are the frame change of `fromLocal` read one way and then the
 * other, and the frames are reasoned about here only.
 */
describe("box and ends", () => {
  const PLACED = {
    center: { x: 200, y: 100 },
    width: 100,
    height: 40,
    rotation: 0,
  };

  it("puts a box's ends on its own x axis, which is its width", () => {
    expect(generator.endsOfBox(PLACED)).toEqual({
      start: { x: 200, y: 50 },
      end: { x: 200, y: 150 },
    });
  });

  it("spans a box along a line, keeping its length and direction", () => {
    const spanned = generator.boxOfEnds(generator.endsOfBox(PLACED), 40);

    expect(spanned).toEqual(PLACED);
  });

  it("takes a turned box out to its ends and back unchanged", () => {
    const turned = box(100, 40, 30);
    const there = generator.boxOfEnds(generator.endsOfBox(turned), 40);

    expect(there.center.x).toBeCloseTo(turned.center.x);
    expect(there.center.y).toBeCloseTo(turned.center.y);
    expect(there.width).toBeCloseTo(turned.width);
    expect(wrapped(there.rotation)).toBeCloseTo(turned.rotation);
  });
});

/**
 * The compatibility surface. These are not hand-computed: they are what the
 * math produced on the day it was written, recorded so that it cannot change
 * by accident. A failure here is either a bug being fixed on purpose or a
 * player's hideout about to move.
 */
describe("golden", () => {
  const arrays = {
    grid: array({
      type: "grid",
      box: { center: { x: 400, y: 300 }, width: 120, height: 80, rotation: 30 },
      resolution: { x: 3, y: 2 },
      rotation: { base: 10, increment: 15, align: false },
      random: {
        seed: 2463534242,
        jitter: { x: 2, y: 2, rotation: 5 },
        variation: [],
      },
    }),
    line: array({
      type: "line",
      source: [{ hash: 11, name: "Fence", fv: 0 }],
      ends: { start: { x: -100, y: -50 }, end: { x: 300, y: 150 } },
      resolution: 5,
      rotation: { base: 0, increment: 30, align: true },
      random: { seed: 7, jitter: { x: 0, y: 4, rotation: 0 }, variation: [] },
    }),
    ellipse: array({
      type: "ellipse",
      source: [
        { hash: 1, name: "One", fv: 0 },
        { hash: 2, name: "Two", fv: 128 },
      ],
      box: { center: { x: 1000, y: 500 }, width: 600, height: 200, rotation: 45 },
      resolution: 7,
      rotation: { base: 0, increment: 0, align: true },
      random: {
        seed: 12345,
        jitter: { x: 0, y: 0, rotation: 0 },
        variation: [1, 2, 3],
      },
    }),
    polygon: array({
      type: "polygon",
      corners: 5,
      source: [{ hash: 7, name: "Torch", fv: 3 }],
      box: { center: { x: 0, y: 0 }, width: 400, height: 400, rotation: 0 },
      resolution: 9,
      rotation: { base: 90, increment: -5, align: true },
      random: { seed: 99, jitter: { x: 3, y: 1, rotation: 2 }, variation: [0, 4] },
    }),
    bezier: array({
      type: "bezier",
      source: [{ hash: 11, name: "Fence", fv: 0 }],
      ends: { start: { x: -100, y: -50 }, end: { x: 300, y: 150 } },
      controls: { first: { x: 0, y: 200 }, second: { x: 200, y: -100 } },
      resolution: 6,
      rotation: { base: 0, increment: 0, align: true },
      random: { seed: 4242, jitter: { x: 0, y: 3, rotation: 0 }, variation: [] },
    }),
    // The same shape by its other distribution, at two doodads to an edge: the
    // pair are a quarter in from each end, and no corner carries one.
    polygonEdges: array({
      type: "polygon",
      corners: 5,
      distribution: generator.ON_EDGES,
      source: [{ hash: 7, name: "Torch", fv: 3 }],
      box: { center: { x: 0, y: 0 }, width: 400, height: 400, rotation: 0 },
      resolution: 10,
      rotation: { base: 90, increment: -5, align: true },
      random: { seed: 99, jitter: { x: 3, y: 1, rotation: 2 }, variation: [0, 4] },
    }),
  };

  const expected = {
    grid: [
      { hash: 3230065491, x: 397, y: 254, r: 63806, fv: 0 },
      { hash: 3230065491, x: 416, y: 289, r: 61592, fv: 0 },
      { hash: 3230065491, x: 436, y: 323, r: 57952, fv: 0 },
      { hash: 3230065491, x: 363, y: 273, r: 55318, fv: 0 },
      { hash: 3230065491, x: 384, y: 308, r: 52053, fv: 0 },
      { hash: 3230065491, x: 403, y: 346, r: 49614, fv: 0 },
    ],
    line: [
      { hash: 11, x: -101, y: -47, r: 53988, fv: 0 },
      { hash: 11, x: 1, y: -3, r: 48527, fv: 0 },
      { hash: 11, x: 99, y: 52, r: 43065, fv: 0 },
      { hash: 11, x: 201, y: 97, r: 37604, fv: 0 },
      { hash: 11, x: 299, y: 153, r: 32143, fv: 0 },
    ],
    ellipse: [
      { hash: 1, x: 1212, y: 712, r: 8384, fv: 3 },
      { hash: 2, x: 1039, y: 663, r: 22710, fv: 131 },
      { hash: 1, x: 896, y: 536, r: 25157, fv: 3 },
      { hash: 2, x: 790, y: 378, r: 28739, fv: 131 },
      { hash: 1, x: 878, y: 290, r: 53181, fv: 1 },
      { hash: 2, x: 1036, y: 396, r: 56763, fv: 131 },
      { hash: 1, x: 1163, y: 539, r: 59210, fv: 1 },
    ],
    // Moved 2026-08-09 with wiki issue 0035, deliberately: a polygon's doodads
    // are dealt to its edges instead of walked round its perimeter, so that a
    // corner carries one exactly rather than nearly.
    polygon: [
      { hash: 7, x: 201, y: 123, r: 54663, fv: 0 },
      { hash: 7, x: -49, y: 199, r: 3646, fv: 4 },
      { hash: 7, x: -125, y: 99, r: 11064, fv: 4 },
      { hash: 7, x: -199, y: -2, r: 18921, fv: 4 },
      { hash: 7, x: -124, y: -99, r: 26633, fv: 4 },
      { hash: 7, x: -45, y: -200, r: 34761, fv: 0 },
      { hash: 7, x: 76, y: -163, r: 41060, fv: 0 },
      { hash: 7, x: 200, y: -122, r: 49418, fv: 0 },
      { hash: 7, x: 199, y: 0, r: 56396, fv: 4 },
    ],
    bezier: [
      { hash: 11, x: -100, y: -50, r: 61545, fv: 0 },
      { hash: 11, x: -43, y: 31, r: 56174, fv: 0 },
      { hash: 11, x: 50, y: 57, r: 48333, fv: 0 },
      { hash: 11, x: 150, y: 43, r: 48333, fv: 0 },
      { hash: 11, x: 243, y: 69, r: 56174, fv: 0 },
      { hash: 11, x: 302, y: 149, r: 61545, fv: 0 },
    ],
    polygonEdges: [
      { hash: 7, x: 139, y: 142, r: 62147, fv: 0 },
      { hash: 7, x: 12, y: 181, r: 63638, fv: 4 },
      { hash: 7, x: -87, y: 149, r: 11064, fv: 4 },
      { hash: 7, x: -162, y: 48, r: 12117, fv: 4 },
      { hash: 7, x: -162, y: -49, r: 26633, fv: 4 },
      { hash: 7, x: -84, y: -151, r: 27599, fv: 0 },
      { hash: 7, x: 15, y: -182, r: 41060, fv: 0 },
      { hash: 7, x: 139, y: -142, r: 41935, fv: 0 },
      { hash: 7, x: 199, y: -62, r: 56396, fv: 4 },
      { hash: 7, x: 200, y: 64, r: 57479, fv: 0 },
    ],
  };

  for (const [shape, parameters] of Object.entries(arrays)) {
    it(`places the same doodads it always did: ${shape}`, () => {
      const doodads = generator.generate(parameters);
      expect(doodads.map((doodad) => doodad.toFields())).toEqual(
        expected[shape],
      );
    });
  }
});
