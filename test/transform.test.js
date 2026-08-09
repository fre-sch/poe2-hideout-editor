/**
 * The floor under a resize.
 *
 * The rest of `viewport/transform.js` is a Konva `Transformer` and its events,
 * which need a canvas to exercise. This does not: it is the arithmetic that
 * decides whether a step of a resize is allowed, and it is the one part where
 * being wrong loses a player's arrangement for good -- see wiki issue 0038.
 */

import { describe, expect, it } from "vitest";

import { bounded } from "../src/viewport/transform.js";

const box = (width, height) => ({ x: 0, y: 0, width, height, rotation: 0 });

describe("bounded", () => {
  it("allows a resize that stays clear of the floor", () => {
    const wants = box(200, 90);

    expect(bounded(box(300, 100), wants)).toBe(wants);
  });

  it("refuses to squeeze a box down onto a point", () => {
    const was = box(300, 100);

    expect(bounded(was, box(2, 100))).toBe(was);
    expect(bounded(was, box(300, 2))).toBe(was);
  });

  /**
   * A box on its way past zero arrives as a negative width, and it is the same
   * collapse whichever side of zero it came out on: `flipEnabled` is off, so
   * nothing is mirrored, but the step still asks.
   */
  it("reads a negative width as the collapse it is", () => {
    const was = box(300, 100);

    expect(bounded(was, box(-5, 100))).toBe(was);
  });

  /**
   * Zoomed far enough out, every box is under the floor. Refusing to grow one
   * would make the whole hideout unresizable at the zoom that shows it.
   */
  it("still grows a box that is already under the floor", () => {
    const wants = box(20, 20);

    expect(bounded(box(10, 10), wants)).toBe(wants);
  });

  it("leaves a rotation alone, which changes neither side", () => {
    const wants = { x: 5, y: 5, width: 4, height: 4, rotation: 45 };

    expect(bounded(box(4, 4), wants)).toBe(wants);
  });
});
