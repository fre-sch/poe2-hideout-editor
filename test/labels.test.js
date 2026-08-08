import { describe, expect, it } from "vitest";

import * as labels from "../src/viewport/labels.js";

function node(name, x, y) {
  return { doodad: { name }, getAbsolutePosition: () => ({ x, y }) };
}

const stage = { width: () => 100, height: () => 50 };

describe("visible", () => {
  it("labels a doodad inside the canvas, at its pixel position", () => {
    expect(labels.visible([node("Stash", 12.4, 30.6)], stage)).toEqual([
      { x: 12, y: 31, text: "Stash" },
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
