/**
 * `src/hideout/arrays.js`: where a set of generator parameters comes from.
 *
 * Named for the parameters rather than the module, because `arrays.test.js` is
 * the gizmo's -- `src/viewport/arrays.js` -- and two files of that name would
 * be two answers to which one a failure is in.
 *
 * What is checked here is what a player would otherwise find out by making an
 * array and seeing it in the wrong place: the axes cross over between a box and
 * the doodads it holds, and changing a type has to carry the geometry across.
 */

import { describe, expect, it } from "vitest";

import * as arrays from "../src/hideout/arrays.js";
import * as generator from "../src/hideout/generator.js";
import { Doodad, Generator } from "../src/hideout/model.js";

function doodad(x, y, fv = 0) {
  return new Doodad("Stash", { hash: 3230065491, x, y, r: 0, fv }, "default");
}

describe("boxAround", () => {
  /**
   * A box's own x runs across its width and reaches the doodads' `y`, which is
   * the frame change in `generator.js`. Getting this the wrong way round gives
   * a box that is the right size and the wrong shape.
   */
  it("takes its width from the doodads' y and its height from their x", () => {
    const around = arrays.boxAround([doodad(100, 200), doodad(180, 300)]);

    expect(around).toEqual({
      center: { x: 140, y: 250 },
      width: 100,
      height: 80,
      rotation: 0,
    });
  });

  it("gives a shape room where the doodads have none of their own", () => {
    const around = arrays.boxAround([doodad(100, 200)]);

    expect(around.center).toEqual({ x: 100, y: 200 });
    expect(around.width).toBeGreaterThan(0);
    expect(around.height).toBe(around.width);
  });
});

describe("fromSelection", () => {
  it("makes the selection the source, in order and with its variations", () => {
    const made = arrays.fromSelection([doodad(0, 0, 3), doodad(10, 10)]);

    expect(made.source).toEqual([
      { hash: 3230065491, name: "Stash", fv: 3, variation: [] },
      { hash: 3230065491, name: "Stash", fv: 0, variation: [] },
    ]);
  });

  /** Chosen variations are the doodad's own, and it starts with the one it is. */
  it("chooses no variations, so every doodad keeps the one it was", () => {
    const made = arrays.fromSelection([doodad(0, 0, 3)]);

    expect(made.source[0].variation).toEqual([]);
    expect(generator.generate({ ...made, layer: "layer-2" })[0].fv).toBe(3);
  });

  it("walks the source in turn and its variations at random", () => {
    expect(arrays.fromSelection([doodad(0, 0)]).pick).toEqual({
      source: generator.CYCLE,
      variation: generator.RANDOM,
    });
  });

  it("is a generator the document accepts as it stands", () => {
    const made = arrays.fromSelection([doodad(100, 200)]);
    const array = new Generator({ ...made, layer: "layer-2" });

    expect(array.type).toBe("grid");
    expect(array.resolution).toEqual({ x: 3, y: 3 });
    expect(Number.isInteger(array.random.seed)).toBe(true);
  });
});

/**
 * Moving a whole array, which is how a layer group carries one along.
 *
 * The parameters are not what a player sees -- the doodads are -- so what is
 * checked is the doodads: every one of them has to arrive where the same rigid
 * motion would have put it. That is the claim a wrong rotation sense or a
 * forgotten `box.rotation` breaks, and neither shows up in a box read on its
 * own.
 */
describe("moved", () => {
  const COMMON = {
    layer: "layer-2",
    source: [{ hash: 3230065491, name: "Stash", fv: 0 }],
    rotation: { base: 0, increment: 0, align: false },
    random: { seed: 1, jitter: { x: 0, y: 0, rotation: 0 } },
  };
  const BOX = {
    center: { x: 400, y: 300 },
    width: 120,
    height: 80,
    rotation: 37,
  };
  const ENDS = { start: { x: 100, y: 120 }, end: { x: 260, y: 400 } };

  const SHAPES = [
    { ...COMMON, type: "grid", box: BOX, resolution: { x: 3, y: 2 } },
    { ...COMMON, type: "ellipse", box: BOX, resolution: 8 },
    { ...COMMON, type: "polygon", box: BOX, corners: 5, resolution: 10 },
    { ...COMMON, type: "line", ends: ENDS, resolution: 5 },
    {
      ...COMMON,
      type: "bezier",
      ends: ENDS,
      controls: { first: { x: 200, y: 150 }, second: { x: 210, y: 380 } },
      resolution: 6,
    },
  ];

  /**
   * Both sides are rounded onto the file's integer grid, half a unit each, so
   * they may differ by one and no more.
   */
  const ROUNDING = 1;

  function expectMoved(parameters, motion) {
    const before = generator.generate(parameters);
    const after = generator.generate(
      new Generator(arrays.moved(parameters, motion)),
    );

    expect(after).toHaveLength(before.length);
    for (const [index, doodad] of before.entries()) {
      const turned = generator.turned(
        { x: doodad.x - motion.from.x, y: doodad.y - motion.from.y },
        motion.degrees ?? 0,
      );
      expect(
        Math.abs(after[index].x - (turned.x + motion.to.x)),
      ).toBeLessThanOrEqual(ROUNDING);
      expect(
        Math.abs(after[index].y - (turned.y + motion.to.y)),
      ).toBeLessThanOrEqual(ROUNDING);
    }
  }

  it("displaces every doodad of every shape by the same amount", () => {
    for (const parameters of SHAPES) {
      expectMoved(new Generator(parameters), {
        from: { x: 0, y: 0 },
        to: { x: 30, y: -70 },
      });
    }
  });

  it("turns every doodad of every shape about the pivot", () => {
    for (const parameters of SHAPES) {
      const array = new Generator(parameters);
      expectMoved(array, {
        from: arrays.centerOf(array),
        to: arrays.centerOf(array),
        degrees: 25,
      });
    }
  });

  it("turns and displaces in one motion", () => {
    for (const parameters of SHAPES) {
      const array = new Generator(parameters);
      expectMoved(array, {
        from: arrays.centerOf(array),
        to: { x: 700, y: 200 },
        degrees: -140,
      });
    }
  });

  /** A move is rigid: the shape is somewhere else and is not another shape. */
  it("keeps the size of a box and the length of a line", () => {
    const box = new Generator(SHAPES[1]);
    const moved = arrays.moved(box, {
      from: { x: 0, y: 0 },
      to: { x: 10, y: 10 },
      degrees: 90,
    });

    expect(moved.box.width).toBe(BOX.width);
    expect(moved.box.height).toBe(BOX.height);
    expect(moved.box.rotation).toBe(BOX.rotation + 90);

    const line = arrays.moved(new Generator(SHAPES[3]), {
      from: { x: 0, y: 0 },
      to: { x: 0, y: 0 },
      degrees: 33,
    });
    expect(length(line.ends)).toBeCloseTo(length(ENDS), 9);
  });

  it("carries a curve's controls with its ends", () => {
    const curve = arrays.moved(new Generator(SHAPES[4]), {
      from: { x: 0, y: 0 },
      to: { x: 5, y: 5 },
    });

    expect(curve.controls.first).toEqual({ x: 205, y: 155 });
  });
});

function length({ start, end }) {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

describe("centerOf and alignedTo", () => {
  const BOX = {
    center: { x: 400, y: 300 },
    width: 120,
    height: 80,
    rotation: 37,
  };

  it("reads a box shape's centre off its box", () => {
    expect(arrays.centerOf({ type: "grid", box: BOX })).toEqual(BOX.center);
  });

  /** The midpoint of the ends: where a box over the shape would be centred. */
  it("reads an end-to-end shape's centre off its ends", () => {
    expect(
      arrays.centerOf({
        type: "line",
        ends: { start: { x: 100, y: 100 }, end: { x: 300, y: 200 } },
      }),
    ).toEqual({ x: 200, y: 150 });
  });

  it("puts an array's centre on a point, keeping its size and angle", () => {
    const aligned = arrays.alignedTo(
      { type: "ellipse", box: BOX },
      { x: 50, y: 60 },
    );

    expect(aligned.box.center).toEqual({ x: 50, y: 60 });
    expect(aligned.box.width).toBe(BOX.width);
    expect(aligned.box.height).toBe(BOX.height);
    expect(aligned.box.rotation).toBe(BOX.rotation);
  });

  it("puts two shapes of different kinds on the same centre", () => {
    const target = { x: 500, y: 500 };
    const line = arrays.alignedTo(
      {
        type: "line",
        ends: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
      },
      target,
    );

    expect(arrays.centerOf(line)).toEqual(target);
    expect(line.ends).toEqual({
      start: { x: 450, y: 500 },
      end: { x: 550, y: 500 },
    });
  });
});

describe("withType", () => {
  const GRID = {
    layer: "layer-2",
    type: "grid",
    source: [{ hash: 3230065491, name: "Stash", fv: 0 }],
    box: { center: { x: 200, y: 100 }, width: 100, height: 40, rotation: 0 },
    resolution: { x: 3, y: 2 },
    rotation: { base: 0, increment: 0, align: false },
    random: { seed: 1, jitter: { x: 0, y: 0, rotation: 0 }, variation: [] },
  };

  it("stretches a line along the box it was", () => {
    const line = new Generator(arrays.withType(GRID, "line"));

    expect(line.ends).toEqual({
      start: { x: 200, y: 50 },
      end: { x: 200, y: 150 },
    });
    expect("box" in line).toBe(false);
  });

  it("spans a box over the line it was", () => {
    const line = arrays.withType(GRID, "line");
    const ellipse = new Generator(arrays.withType(line, "ellipse"));

    expect(ellipse.box.center).toEqual(GRID.box.center);
    expect(ellipse.box.width).toBe(GRID.box.width);
    expect(ellipse.box.height).toBeGreaterThan(0);
  });

  /**
   * A grid counts in two directions and everything else counts along itself, so
   * what carries over is the number of doodads rather than the resolution.
   */
  it("keeps the count when the shape stops counting in two directions", () => {
    expect(arrays.withType(GRID, "ellipse").resolution).toBe(6);
    expect(
      arrays.withType(arrays.withType(GRID, "ellipse"), "grid").resolution,
    ).toEqual({ x: 6, y: 1 });
  });

  it("gives a polygon corners to be made of", () => {
    expect(arrays.withType(GRID, "polygon").corners).toBeGreaterThanOrEqual(3);
  });

  /**
   * A curve arrives as the line it replaces: its controls a third and two
   * thirds along, which is the Bézier that is that line. So changing to a curve
   * does not move a doodad until the player bends it.
   */
  it("starts a curve straight, along the ends it is given", () => {
    const curve = new Generator(arrays.withType(GRID, "bezier"));
    const line = new Generator(arrays.withType(GRID, "line"));

    expect(curve.ends).toEqual(line.ends);
    // A third and two thirds of the way from one end to the other.
    expect(curve.controls.first.x).toBe(200);
    expect(curve.controls.first.y).toBeCloseTo(50 + 100 / 3, 9);
    expect(curve.controls.second.x).toBe(200);
    expect(curve.controls.second.y).toBeCloseTo(50 + 200 / 3, 9);
    expect(positionsOf(curve)).toEqual(positionsOf(line));
  });

  it("keeps a curve's ends when it becomes a line, and drops its controls", () => {
    const curve = arrays.withType(GRID, "bezier");
    const line = new Generator(arrays.withType(curve, "line"));

    expect(line.ends).toEqual(curve.ends);
    expect("controls" in line).toBe(false);
  });

  /** A curve has no thickness, so a box made of one is spanned like a line's. */
  it("spans a box over a curve by its ends", () => {
    const curve = arrays.withType(GRID, "bezier");
    const grid = new Generator(arrays.withType(curve, "grid"));

    expect(grid.box.center).toEqual(GRID.box.center);
    expect(grid.box.width).toBe(GRID.box.width);
  });

  function positionsOf(parameters) {
    return generator
      .generate({ ...parameters, resolution: 5 })
      .map((doodad) => ({ x: doodad.x, y: doodad.y }));
  }

  it("changes nothing when the type is the one it already has", () => {
    expect(arrays.withType(GRID, "grid")).toBe(GRID);
  });
});
