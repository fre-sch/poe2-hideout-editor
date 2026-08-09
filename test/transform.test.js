/**
 * The floor under a resize.
 *
 * The rest of `viewport/transform.js` is a Konva `Transformer` and its events,
 * which need a canvas to exercise. This does not: it is the arithmetic that
 * decides how far an anchor may be dragged, and it is the one part where being
 * wrong loses a player's arrangement for good -- see wiki issue 0038. The
 * points are in the box's own space, where the box spans `0..width` across and
 * `0..height` down.
 */

import { describe, expect, it } from "vitest";

import { clamped } from "../src/viewport/transform.js";

const BOX = { width: 300, height: 100 };

const at = (anchor, x, y) => clamped(anchor, BOX, { x, y });

describe("clamped", () => {
  it("leaves an anchor alone well inside the box", () => {
    expect(at("top-left", 40, 30)).toEqual({ x: 40, y: 30 });
  });

  it("stops a side anchor short of the side it pulls against", () => {
    expect(at("middle-left", 290, 0).x).toBe(276);
    expect(at("middle-right", 5, 0).x).toBe(24);
    expect(at("top-center", 0, 95).y).toBe(76);
    expect(at("bottom-center", 0, 5).y).toBe(24);
  });

  it("stops a corner on both counts at once", () => {
    expect(at("bottom-right", 8, 9)).toEqual({ x: 24, y: 24 });
  });

  /**
   * The collapse this is all for: dragging an anchor out the far side of the
   * box. Konva reads that as a flip and rewrites which anchor it is holding,
   * so it has to be stopped before it happens rather than refused afterwards.
   */
  it("never lets an anchor cross the box", () => {
    expect(at("middle-left", 900, 0).x).toBe(276);
    expect(at("middle-right", -900, 0).x).toBe(24);
    expect(at("top-left", 400, 300)).toEqual({ x: 276, y: 76 });
  });

  it("moves the side it is not pulling on freely", () => {
    expect(at("middle-left", 100, 5000).y).toBe(5000);
    expect(at("top-center", -5000, 20).x).toBe(-5000);
  });

  it("grows a box outwards however small it is", () => {
    expect(at("middle-left", -500, 0).x).toBe(-500);
    expect(at("bottom-right", 900, 900)).toEqual({ x: 900, y: 900 });
  });

  /**
   * Zoomed far enough out, a whole hideout is a few pixels across. Holding the
   * floor there would force the box open to it, which moves doodads nobody
   * asked to move; the box may then be grown but not shrunk.
   */
  it("holds a box already under the floor where it is", () => {
    const tiny = { width: 10, height: 10 };

    expect(clamped("middle-left", tiny, { x: 4, y: 0 }).x).toBe(0);
    expect(clamped("middle-right", tiny, { x: 6, y: 0 }).x).toBe(10);
    expect(clamped("middle-right", tiny, { x: 80, y: 0 }).x).toBe(80);
  });
});
