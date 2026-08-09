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
      { hash: 3230065491, name: "Stash", fv: 3 },
      { hash: 3230065491, name: "Stash", fv: 0 },
    ]);
  });

  it("is a generator the document accepts as it stands", () => {
    const made = arrays.fromSelection([doodad(100, 200)]);
    const array = new Generator({ ...made, layer: "layer-2" });

    expect(array.type).toBe("grid");
    expect(array.resolution).toEqual({ x: 3, y: 3 });
    expect(array.random.variation).toEqual([]);
    expect(Number.isInteger(array.random.seed)).toBe(true);
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

  it("changes nothing when the type is the one it already has", () => {
    expect(arrays.withType(GRID, "grid")).toBe(GRID);
  });
});
