import { describe, expect, it } from "vitest";
import { HideoutDocument } from "../src/hideout/model.js";

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

function names(doodads) {
  return doodads.map((doodad) => doodad.name);
}
