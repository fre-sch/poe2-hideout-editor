/**
 * The `fv` split, against the sample the specification was written from.
 *
 * `maraketh_chest_variations_and_flips.hideout` is one doodad placed 24 times:
 * every variation along one line, every variation mirrored along a parallel one.
 * It is the evidence for the split, so it is what the split is tested against --
 * and the literal cases below pin the arithmetic where the file is absent.
 */

import { describe, expect, it } from "vitest";

import * as gameExport from "./game-export.js";
import * as variation from "../src/hideout/variation.js";
import { HideoutDocument } from "../src/hideout/model.js";

describe("of", () => {
  it("reads the low seven bits", () => {
    expect(variation.of(0)).toBe(0);
    expect(variation.of(11)).toBe(11);
    expect(variation.of(139)).toBe(11);
  });
});

describe("ordinal", () => {
  it("counts from one, the way the palette counts", () => {
    expect(variation.ordinal(0)).toBe(1);
    expect(variation.ordinal(11)).toBe(12);
    expect(variation.ordinal(139)).toBe(12);
  });
});

describe("mirrored", () => {
  it("reads bit seven and nothing else", () => {
    expect(variation.mirrored(0)).toBe(false);
    expect(variation.mirrored(127)).toBe(false);
    expect(variation.mirrored(128)).toBe(true);
    expect(variation.mirrored(135)).toBe(true);
  });
});

describe("mirrorToggled", () => {
  it("turns mirroring on and off, keeping the variation", () => {
    expect(variation.mirrorToggled(7)).toBe(135);
    expect(variation.mirrorToggled(135)).toBe(7);
  });
});

describe("withIndex", () => {
  it("keeps the mirroring it was given", () => {
    expect(variation.withIndex(0, 5)).toBe(5);
    expect(variation.withIndex(128, 5)).toBe(133);
  });
});

describe("next", () => {
  it("cycles a doodad's variations and wraps to the first", () => {
    expect(variation.next(0, 12)).toBe(1);
    expect(variation.next(10, 12)).toBe(11);
    expect(variation.next(11, 12)).toBe(0);
  });

  it("carries the mirroring round with it", () => {
    expect(variation.next(139, 12)).toBe(128);
  });

  /** A doodad no table knows, and one with nothing to choose. */
  it("stays where it is when there is nowhere to go", () => {
    expect(variation.next(3, 0)).toBe(3);
    expect(variation.next(3, undefined)).toBe(3);
    expect(variation.next(0, 1)).toBe(0);
  });
});

const sample = gameExport.find("maraketh_chest_variations_and_flips");

describe.skipIf(!sample)("the game's own variations and mirrors", () => {
  const document_ = HideoutDocument.fromText(gameExport.readText(sample));
  const chests = document_.doodads.filter(
    (doodad) => doodad.name === "Maraketh Chest",
  );

  it("reads twelve variations, each of them both ways", () => {
    const placed = chests.map((doodad) => [
      variation.of(doodad.fv),
      variation.mirrored(doodad.fv),
    ]);
    for (let index = 0; index < 12; index++) {
      expect(placed).toContainEqual([index, false]);
      expect(placed).toContainEqual([index, true]);
    }
  });

  it("mirrors every one of them back to its unmirrored twin", () => {
    for (const doodad of chests) {
      const flipped = variation.mirrorToggled(doodad.fv);
      expect(variation.of(flipped)).toBe(variation.of(doodad.fv));
      expect(variation.mirrored(flipped)).toBe(!variation.mirrored(doodad.fv));
    }
  });
});
