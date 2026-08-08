import { describe, expect, it } from "vitest";
import * as units from "../src/hideout/units.js";

describe("rotation", () => {
  // Negative because the game counts `r` the other way round from the stage,
  // which was measured against the game rather than derived -- see units.js.
  const quarters = [
    [0, 0],
    [16384, -90],
    [32768, -180],
    [49152, -270],
  ];

  for (const [rotation, degrees] of quarters) {
    it(`${rotation} is ${degrees} degrees, both ways`, () => {
      expect(units.toDegrees(rotation)).toBe(degrees);
      expect(units.fromDegrees(degrees)).toBe(rotation);
    });
  }

  it("round trips the last representable value", () => {
    expect(units.fromDegrees(units.toDegrees(65535))).toBe(65535);
  });

  it("wraps a full turn back to zero rather than out of range", () => {
    expect(units.fromDegrees(360)).toBe(0);
    expect(units.fromDegrees(-360)).toBe(0);
  });

  it("wraps an angle past a full turn into range", () => {
    expect(units.fromDegrees(90)).toBe(49152);
    expect(units.fromDegrees(450)).toBe(49152);
  });

  it("round trips every value in the file's range", () => {
    for (let rotation = 0; rotation < units.TURN; rotation++) {
      expect(units.fromDegrees(units.toDegrees(rotation))).toBe(rotation);
    }
  });
});

describe("position", () => {
  it("composes to identity over the observed coordinate range", () => {
    for (let x = 100; x <= 900; x += 7) {
      for (let y = 100; y <= 900; y += 11) {
        expect(units.fromStage(units.toStage({ x, y }))).toEqual({ x, y });
      }
    }
  });

  it("swaps the axes, agreeing with the bounds SVGs", () => {
    // `scripts/converter.py` writes SVG x from doodad y and SVG y from doodad
    // x. A bounds trace has to land on its own outline.
    expect(units.toStage({ x: 392, y: 389 })).toEqual({ x: 389, y: 392 });
  });

  it("rounds a stage position onto the file's integer grid", () => {
    expect(units.fromStage({ x: 389.4, y: 392.6 })).toEqual({ x: 393, y: 389 });
  });
});
