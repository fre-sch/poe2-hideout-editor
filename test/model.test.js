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
    const document = HideoutDocument.fromText(SHRINE);

    expect(document.doodads.map((doodad) => doodad.name)).toEqual([
      "Stash",
      "Maraketh Incense Burner",
    ]);
  });

  it("round trips byte for byte", () => {
    expect(HideoutDocument.fromText(SHRINE).toText()).toBe(SHRINE);
  });

  it("passes the header through when a doodad is edited", () => {
    // The 3D editor rewrote hideout_name from its own hideout-type table and
    // wrote a typo into player files, wiki issue 0009.
    const document = HideoutDocument.fromText(SHRINE);
    document.doodads[0].x = 400;
    const written = HideoutDocument.fromText(document.toText());

    expect(written.header).toEqual({
      version: 1,
      language: "English",
      hideout_name: "Shrine Hideout",
      hideout_hash: 26805,
    });
    expect(written.doodads[0].x).toBe(400);
  });

  it("keeps a deleted doodad deleted", () => {
    // A scene graph the transform control re-parented out of resurrected them,
    // wiki issue 0001.
    const document = HideoutDocument.fromText(SHRINE);
    document.doodads.splice(0, 1);

    expect(HideoutDocument.fromText(document.toText()).doodads).toHaveLength(1);
  });
});
