import { describe, expect, it } from "vitest";
import { Generator, HideoutDocument } from "../src/hideout/model.js";

const SHRINE = `﻿{
  "version": 1,
  "language": "English",
  "hideout_name": "Shrine Hideout",
  "hideout_hash": 26805,
  "doodads": {
    "Stash": {
      "hash": 3230065491,
      "x": 392,
      "y": 389,
      "r": 0,
      "fv": 0
    },
    "Maraketh Incense Burner": {
      "hash": 279768580,
      "x": 393,
      "y": 389,
      "r": 32768,
      "fv": 128
    }
  }
}`;

/** Six doodads, which is enough to tell one generation from another. */
const GRID = {
  type: "grid",
  source: [{ hash: 3230065491, name: "Stash", fv: 0 }],
  box: { center: { x: 400, y: 300 }, width: 120, height: 80, rotation: 0 },
  resolution: { x: 3, y: 2 },
  rotation: { base: 0, increment: 0, align: false },
  random: { seed: 1, jitter: { x: 0, y: 0, rotation: 0 }, variation: [] },
};

describe("HideoutDocument", () => {
  it("holds doodads in one flat array, in file order", () => {
    const document_ = HideoutDocument.fromText(SHRINE);

    expect(document_.doodads.map((doodad) => doodad.name)).toEqual([
      "Stash",
      "Maraketh Incense Burner",
    ]);
  });

  it("keeps a deleted doodad deleted", () => {
    // A scene graph the transform control re-parented out of resurrected them,
    // wiki issue 0001.
    const document_ = HideoutDocument.fromText(SHRINE);
    document_.doodads.splice(0, 1);

    expect(document_.doodads).toHaveLength(1);
  });
});

describe("layers", () => {
  it("gives a plain .hideout one layer named after the hideout", () => {
    const document_ = HideoutDocument.fromText(SHRINE);

    expect(document_.layers.map((layer) => layer.name)).toEqual([
      "Shrine Hideout",
    ]);
    expect(document_.doodads.every((doodad) => doodad.layer === "default")).toBe(
      true,
    );
  });

  it("orders doodads by layer, then by the order they are held in", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    const garden = document_.addLayer("Garden");
    document_.assign([document_.doodads[0]], garden.id);

    expect(names(document_.orderedDoodads())).toEqual([
      "Maraketh Incense Burner",
      "Stash",
    ]);

    document_.moveLayer(garden.id, -1);
    expect(names(document_.orderedDoodads())).toEqual([
      "Stash",
      "Maraketh Incense Burner",
    ]);
  });

  it("leaves hidden layers out of the export order, and keeps them elsewhere", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    const garden = document_.addLayer("Garden");
    document_.assign([document_.doodads[0]], garden.id);
    garden.visible = false;
    garden.locked = true;

    expect(names(document_.exportedDoodads())).toEqual([
      "Maraketh Incense Burner",
    ]);
    expect(names(document_.orderedDoodads())).toHaveLength(2);

    garden.visible = true;
    expect(names(document_.exportedDoodads())).toHaveLength(2);
  });

  it("clamps a move at the ends of the list rather than wrapping", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    const garden = document_.addLayer("Garden");
    document_.moveLayer(garden.id, -5);

    expect(document_.layers[0].id).toBe(garden.id);
  });

  it("hands a deleted layer's doodads to the layer named for them", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    const garden = document_.addLayer("Garden");
    document_.assign(document_.doodads, garden.id);
    document_.removeLayer(garden.id, "default");

    expect(document_.doodads).toHaveLength(2);
    expect(document_.doodadsIn("default")).toHaveLength(2);
  });

  it("refuses to delete the last layer", () => {
    const document_ = HideoutDocument.fromText(SHRINE);

    expect(() => document_.removeLayer("default", "default")).toThrow();
  });

  it("refuses to hand doodads to a layer that does not exist", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    const garden = document_.addLayer("Garden");

    expect(() => document_.removeLayer(garden.id, "nowhere")).toThrow();
    expect(document_.layers).toHaveLength(2);
  });

  it("gives every new layer an id no other layer has", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    const named = document_.addLayer("First");
    document_.removeLayer("default", named.id);

    const ids = [named.id, document_.addLayer("Second").id];
    expect(new Set(ids).size).toBe(2);
  });
});

describe("Generator", () => {
  it("keeps the fields the type it names has, and no others", () => {
    const line = new Generator({
      ...GRID,
      type: "line",
      ends: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
      resolution: 4,
    });

    expect(line.ends).toEqual({ start: { x: 0, y: 0 }, end: { x: 100, y: 0 } });
    expect("box" in line).toBe(false);
  });

  it("refuses a type it does not know", () => {
    expect(() => new Generator({ ...GRID, type: "spiral" })).toThrow(/spiral/);
  });
});

describe("array layers", () => {
  it("places the generator's doodads when the layer is added", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    const array = document_.addArrayLayer("Braziers", GRID);

    expect(document_.findGenerator(array.layer)).toBe(array);
    expect(document_.doodadsIn(array.layer)).toHaveLength(6);
    expect(names(document_.orderedDoodads())).toHaveLength(8);
  });

  it("replaces the doodads it placed before, rather than adding to them", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    const array = document_.addArrayLayer("Braziers", GRID);

    array.resolution = { x: 2, y: 2 };
    document_.regenerate(array.layer);

    expect(document_.doodadsIn(array.layer)).toHaveLength(4);
    expect(document_.doodads).toHaveLength(6);
  });

  it("refuses to regenerate a layer that carries no generator", () => {
    const document_ = HideoutDocument.fromText(SHRINE);

    expect(() => document_.regenerate("default")).toThrow(/no generator/);
  });

  it("keeps the doodads and drops the parameters on a detach", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    const array = document_.addArrayLayer("Braziers", GRID);
    document_.detach(array.layer);

    expect(document_.generators).toEqual([]);
    expect(document_.doodadsIn(array.layer)).toHaveLength(6);
  });

  it("deletes the doodads with the layer, needing nowhere to put them", () => {
    // The exception to "deleting a layer never deletes doodads": they were
    // derived, so there is nobody to hand them to.
    const document_ = HideoutDocument.fromText(SHRINE);
    const array = document_.addArrayLayer("Braziers", GRID);
    document_.removeLayer(array.layer);

    expect(document_.doodads).toHaveLength(2);
    expect(document_.generators).toEqual([]);
    expect(document_.findLayer(array.layer)).toBeUndefined();
  });

  it("hands a detached layer's doodads on like any other layer's", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    const array = document_.addArrayLayer("Braziers", GRID);
    document_.detach(array.layer);
    document_.removeLayer(array.layer, "default");

    expect(document_.doodadsIn("default")).toHaveLength(8);
  });
});

function names(doodads) {
  return doodads.map((doodad) => doodad.name);
}
