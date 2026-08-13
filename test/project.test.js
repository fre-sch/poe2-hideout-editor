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

  /**
   * What a switch of language costs the file -- wiki issue 0053. The header
   * word is the whole of it: the names are the document's and are copied, never
   * derived, so a file can hold names in two languages and the game reads
   * neither. Switching back is therefore the file it started as.
   */
  it("writes the switched language and nothing else", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    document_.header.language = "German";

    const switched = project.bake(document_);
    document_.header.language = "English";

    expect(switched).toBe(SHRINE.replace('"English"', '"German"'));
    expect(project.bake(document_)).toBe(SHRINE);
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

  it("loads a project that has no generators", () => {
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

/**
 * The file holds the parameters and the `.hideout` holds the result, so a
 * project's array layer has doodads only after they are computed. Everything
 * here is about the two not being able to disagree.
 */
describe("arrays in a project file", () => {
  const ELLIPSE = {
    type: "ellipse",
    source: [{ hash: 279768580, name: "Maraketh Incense Burner", fv: 128 }],
    box: { center: { x: 500, y: 400 }, width: 300, height: 100, rotation: 20 },
    resolution: 7,
    rotation: { base: 5, increment: 0, align: true },
    random: {
      seed: 4242,
      jitter: { x: 2, y: 2, rotation: 3 },
      variation: [1, 2],
    },
  };

  function withArray() {
    const document_ = HideoutDocument.fromText(SHRINE);
    document_.addArrayLayer("Burners", ELLIPSE);
    return document_;
  }

  it("round trips the doodads through the parameters alone", () => {
    const document_ = withArray();
    const loaded = project.parse(project.serialize(document_));

    expect(loaded.generators).toEqual(document_.generators);
    expect(loaded.doodads.map((doodad) => doodad.toFields())).toEqual(
      document_.doodads.map((doodad) => doodad.toFields()),
    );
  });

  it("writes no doodads for an array layer", () => {
    const written = JSON.parse(project.serialize(withArray()));

    expect(written.doodads).toHaveLength(2);
    expect(written.doodads.map((entry) => entry.layer)).toEqual([
      "default",
      "default",
    ]);
  });

  it("exports and counts an array's doodads like any others", () => {
    const document_ = withArray();

    expect(project.count(document_)).toMatchObject({ total: 9, placed: 8 });
    expect(
      project.bake(document_).match(/"Maraketh Incense Burner"/g),
    ).toHaveLength(8);
  });

  it("writes a detached layer's doodads out", () => {
    const document_ = withArray();
    const array = document_.generators[0];
    document_.detach(array.layer);

    const written = JSON.parse(project.serialize(document_));

    expect(written.generators).toEqual([]);
    expect(written.doodads).toHaveLength(9);
  });

  it("refuses two generators over one layer, naming it", () => {
    const document_ = withArray();
    const array = document_.generators[0];
    document_.generators = [array, { ...array }];

    expect(() => project.parse(project.serialize(document_))).toThrow(
      new RegExp(`'${array.layer}' has more than one generator`),
    );
  });

  it("refuses a generator in a layer the file does not list", () => {
    const text = project.serialize(withArray());
    const broken = text.replace(/"layer": "layer-2"/, '"layer": "gone"');

    expect(() => project.parse(broken)).toThrow(/unknown layer 'gone'/);
  });

  it("refuses a type it does not know, and loads nothing", () => {
    const text = project.serialize(withArray());
    const broken = text.replace('"type": "ellipse"', '"type": "spiral"');

    expect(() => project.parse(broken)).toThrow(/spiral/);
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
