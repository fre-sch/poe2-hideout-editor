import { describe, expect, it } from "vitest";

import * as labels from "../src/viewport/labels.js";

function node(name, x, y) {
  return { doodad: { name }, getAbsolutePosition: () => ({ x, y }) };
}

const stage = { width: () => 100, height: () => 50 };

describe("visible", () => {
  /**
   * The doodad and not its name: what a label reads is the table's answer or
   * the file's, and the overlay asks that when it renders -- wiki issue 0059.
   */
  it("labels a doodad inside the canvas, at its pixel position", () => {
    const stash = node("Stash", 12.4, 30.6);

    expect(labels.visible([stash], stage)).toEqual([
      { x: 12, y: 31, doodad: stash.doodad },
    ]);
  });

  it("drops what the canvas does not show", () => {
    const outside = [
      node("left", -1, 10),
      node("right", 101, 10),
      node("above", 10, -1),
      node("below", 10, 51),
    ];
    expect(labels.visible(outside, stage)).toEqual([]);
  });
});
