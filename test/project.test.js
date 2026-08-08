import { describe, expect, it } from "vitest";
import * as project from "../src/hideout/project.js";
import { Doodad, HideoutDocument, Layer } from "../src/hideout/model.js";

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

describe("bake", () => {
  it("writes a freshly loaded .hideout back byte for byte", () => {
    expect(project.bake(HideoutDocument.fromText(SHRINE))).toBe(SHRINE);
  });

  it("writes the same file after a save and a load", () => {
    const saved = project.serialize(HideoutDocument.fromText(SHRINE));

    expect(project.bake(project.parse(saved))).toBe(SHRINE);
  });

  it("exports a locked layer like any other", () => {
    // Locking is about the mouse and says nothing about the file.
    const document_ = HideoutDocument.fromText(SHRINE);
    document_.layers[0].locked = true;

    expect(project.bake(document_)).toBe(SHRINE);
  });

  it("leaves a hidden layer out", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    const garden = document_.addLayer("Garden");
    document_.assign([document_.doodads[0]], garden.id);
    garden.visible = false;

    const baked = project.bake(document_);

    expect(baked).not.toMatch(/"Stash"/);
    expect(baked).toMatch(/"Maraketh Incense Burner"/);
  });

  it("writes a hideout with no doodads when every layer is hidden", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    document_.layers[0].visible = false;

    expect(project.bake(document_)).toMatch(/"doodads":\s*\{\s*\}/);
  });

  it("exports in layer order", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    const garden = document_.addLayer("Garden");
    document_.assign([document_.doodads[0]], garden.id);

    expect(project.bake(document_)).toMatch(
      /"Maraketh Incense Burner"[\s\S]*"Stash"/,
    );
  });
});

describe("project files", () => {
  it("round trips layers, their flags and their membership", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    const garden = document_.addLayer("Garden");
    garden.visible = false;
    garden.locked = true;
    document_.assign([document_.doodads[1]], garden.id);

    const loaded = project.parse(project.serialize(document_));

    expect(loaded.layers).toEqual(document_.layers);
    expect(loaded.doodadsIn(garden.id).map((doodad) => doodad.name)).toEqual([
      "Maraketh Incense Burner",
    ]);
  });

  it("round trips the header verbatim", () => {
    // The editor does not synthesize hideout_name, wiki issue 0009.
    const loaded = project.parse(
      project.serialize(HideoutDocument.fromText(SHRINE)),
    );

    expect(loaded.header).toEqual({
      version: 1,
      language: "English",
      hideout_name: "Shrine Hideout",
      hideout_hash: 26805,
    });
  });

  it("keeps generators, empty or not", () => {
    const document_ = HideoutDocument.fromText(SHRINE);

    expect(JSON.parse(project.serialize(document_)).generators).toEqual([]);
    expect(project.parse(project.serialize(document_)).generators).toEqual([]);
  });

  it("refuses a format version it does not know", () => {
    const text = project.serialize(HideoutDocument.fromText(SHRINE));
    const future = text.replace('"format_version": 1', '"format_version": 2');

    expect(() => project.parse(future)).toThrow(/format version 2/);
  });

  it("refuses a file that is not a project at all", () => {
    expect(() => project.parse('{"format": "something else"}')).toThrow();
  });

  it("refuses a doodad in a layer the file does not list", () => {
    const text = project.serialize(HideoutDocument.fromText(SHRINE));
    const broken = text.replaceAll('"layer": "default"', '"layer": "gone"');

    expect(() => project.parse(broken)).toThrow(/unknown layer/);
  });

  it("tells a project from a .hideout by what is in it", () => {
    expect(project.looksLikeProject(SHRINE)).toBe(false);
    expect(
      project.looksLikeProject(
        project.serialize(HideoutDocument.fromText(SHRINE)),
      ),
    ).toBe(true);
  });
});

describe("the doodad limit", () => {
  it("does not count doodads the game places itself", () => {
    // Stash is essential, the incense burner is not.
    const counted = project.count(HideoutDocument.fromText(SHRINE));

    expect(counted).toMatchObject({
      total: 2,
      placed: 1,
      essential: 1,
      exceeded: false,
    });
  });

  it("is exceeded by placed doodads alone", () => {
    expect(project.count(withPlaced(project.DOODAD_LIMIT)).exceeded).toBe(false);
    expect(project.count(withPlaced(project.DOODAD_LIMIT + 1)).exceeded).toBe(
      true,
    );
  });

  it("counts what the export writes, not what is hidden", () => {
    const document_ = withPlaced(project.DOODAD_LIMIT + 1);
    const spare = document_.addLayer("Spare");
    document_.assign(document_.doodads.slice(0, 2), spare.id);
    spare.visible = false;

    expect(project.count(document_)).toMatchObject({
      placed: project.DOODAD_LIMIT - 1,
      exceeded: false,
    });
  });

  it("is not exceeded by essential doodads", () => {
    const document_ = withPlaced(project.DOODAD_LIMIT);
    const stash = { hash: 3230065491, x: 0, y: 0, r: 0, fv: 0 };
    document_.doodads.push(new Doodad("Stash", stash, "default"));

    expect(project.count(document_).exceeded).toBe(false);
  });
});

function withPlaced(count) {
  const fields = { hash: 279768580, x: 0, y: 0, r: 0, fv: 0 };
  const doodads = Array.from(
    { length: count },
    () => new Doodad("Maraketh Incense Burner", fields, "default"),
  );
  return new HideoutDocument(
    { version: 1, language: "English", hideout_name: "T", hideout_hash: 1 },
    doodads,
    [new Layer({ id: "default", name: "T" })],
  );
}
