import { describe, expect, it } from "vitest";
import { Generator, HideoutDocument, Layer } from "../src/hideout/model.js";

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
    expect(
      document_.doodads.every((doodad) => doodad.layer === "default"),
    ).toBe(true);
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

  it("gives every new layer a colour no other layer carries", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    document_.addLayer("Garden");
    document_.addLayer("Walls");

    const used = document_.layers.map((layer) => layer.color);
    expect(new Set(used).size).toBe(3);
  });

  it("colours a layer that arrives without one", () => {
    // A project written before layers carried colours.
    const document_ = new HideoutDocument({}, [], [new Layer({ id: "one" })]);

    expect(document_.findLayer("one").color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("keeps the colour a layer arrives with", () => {
    const document_ = new HideoutDocument(
      {},
      [],
      [new Layer({ id: "one", color: "#123456" })],
    );

    expect(document_.findLayer("one").color).toBe("#123456");
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

  /**
   * Wiki issue 0051: variations were one list for the whole array. A project
   * written then must generate what it generated, which is those indices for
   * every doodad of the source -- and there must be one place they come from
   * afterwards.
   */
  describe("a project written before variations were per doodad", () => {
    const shared = {
      ...GRID,
      source: [
        { hash: 1, name: "Torch", fv: 0 },
        { hash: 2, name: "Brazier", fv: 128 },
      ],
      random: {
        seed: 7,
        jitter: { x: 0, y: 0, rotation: 0 },
        variation: [1, 2],
      },
    };

    it("hands the shared list to every source doodad", () => {
      const array = new Generator(shared);

      expect(array.source.map((entry) => entry.variation)).toEqual([
        [1, 2],
        [1, 2],
      ]);
    });

    it("leaves no second place for a variation to come from", () => {
      expect("variation" in new Generator(shared).random).toBe(false);
    });

    it("leaves a doodad that has its own list alone", () => {
      const array = new Generator({
        ...shared,
        source: [{ hash: 1, name: "Torch", fv: 0, variation: [4] }],
      });

      expect(array.source[0].variation).toEqual([4]);
    });
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

/**
 * A group is a name its layers carry and nothing besides, so what is worth
 * testing is that it is read back that way -- and that a layer that has gone
 * takes its membership with it, which is the whole reason there is no list of
 * members. See wiki/decisions/layer-groups.md.
 */
describe("layer groups", () => {
  function grouped() {
    const document_ = HideoutDocument.fromText(SHRINE);
    const garden = document_.addLayer("Garden");
    const fence = document_.addLayer("Fence");
    garden.group = "Yard";
    fence.group = "Yard";
    return { document_, garden, fence };
  }

  it("gives a layer no group until it is put in one", () => {
    const document_ = HideoutDocument.fromText(SHRINE);

    expect(document_.findLayer("default").group).toBe(null);
    expect(document_.groupNames()).toEqual([]);
  });

  it("answers a grouped layer with every layer sharing the name", () => {
    const { document_, garden, fence } = grouped();

    expect(document_.groupOf(garden.id).map((layer) => layer.id)).toEqual([
      garden.id,
      fence.id,
    ]);
  });

  it("answers an ungrouped layer with itself, a group of one", () => {
    const { document_ } = grouped();

    expect(document_.groupOf("default").map((layer) => layer.id)).toEqual([
      "default",
    ]);
  });

  it("names every group once, in layer order", () => {
    const { document_ } = grouped();
    document_.findLayer("default").group = "Floor";

    expect(document_.groupNames()).toEqual(["Floor", "Yard"]);
  });

  it("loses a member with the layer, there being no list to dangle", () => {
    const { document_, garden, fence } = grouped();
    document_.removeLayer(fence.id, garden.id);

    expect(document_.groupOf(garden.id).map((layer) => layer.id)).toEqual([
      garden.id,
    ]);
  });

  it("answers nothing for a layer that is not there", () => {
    const { document_ } = grouped();

    expect(document_.groupOf("nowhere")).toEqual([]);
  });
});

describe("duplicateLayer", () => {
  it("copies an ordinary layer's doodads as doodads of their own", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    const copy = document_.duplicateLayer("default");

    const copied = document_.doodadsIn(copy.id);
    expect(names(copied)).toEqual(["Stash", "Maraketh Incense Burner"]);
    expect(copied[0].x).toBe(392);

    copied[0].x = 100;
    expect(document_.doodadsIn("default")[0].x).toBe(392);
  });

  it("copies an array's parameters and generates from them", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    const array = document_.addArrayLayer("Braziers", GRID);
    const copy = document_.duplicateLayer(array.layer);

    const copied = document_.findGenerator(copy.id);
    expect(copied.type).toBe("grid");
    expect(copied.box).toEqual(array.box);
    expect(document_.doodadsIn(copy.id)).toHaveLength(6);
  });

  it("gives the copy of an array parameters of its own, all the way down", () => {
    // A shared `box` would let a handle dragged on one array move the other.
    const document_ = HideoutDocument.fromText(SHRINE);
    const array = document_.addArrayLayer("Braziers", GRID);
    const copy = document_.duplicateLayer(array.layer);

    const copied = document_.findGenerator(copy.id);
    copied.box.center.x = 900;
    copied.source[0].name = "Something else";

    expect(array.box.center.x).toBe(400);
    expect(array.source[0].name).toBe("Stash");
  });

  it("places the copy directly after the layer it copied", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    const garden = document_.addLayer("Garden");
    const copy = document_.duplicateLayer("default");

    expect(document_.layers.map((layer) => layer.id)).toEqual([
      "default",
      copy.id,
      garden.id,
    ]);
  });

  it("copies the group, so the copy moves with what the original moves with", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    document_.findLayer("default").group = "Yard";
    const copy = document_.duplicateLayer("default");

    expect(copy.group).toBe("Yard");
  });

  it("copies the flags, a hidden layer's copy being hidden too", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    document_.findLayer("default").visible = false;
    document_.findLayer("default").locked = true;
    const copy = document_.duplicateLayer("default");

    expect(copy.visible).toBe(false);
    expect(copy.locked).toBe(true);
  });

  it("gives the copy a colour of its own, it landing on the original", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    const copy = document_.duplicateLayer("default");

    expect(copy.color).not.toBe(document_.findLayer("default").color);
  });

  it("refuses a layer that does not exist", () => {
    const document_ = HideoutDocument.fromText(SHRINE);

    expect(() => document_.duplicateLayer("nowhere")).toThrow(/nowhere/);
  });
});

describe("replaceGenerator", () => {
  it("swaps the parameters, keeping the layer and its place", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    const array = document_.addArrayLayer("Braziers", GRID);
    const replaced = document_.replaceGenerator({
      ...array,
      resolution: { x: 2, y: 2 },
    });

    expect(document_.generators).toEqual([replaced]);
    expect(document_.findGenerator(array.layer)).toBe(replaced);
    expect(replaced).not.toBe(array);
  });

  /**
   * The reason it goes through `Generator` at all: a shape that has been
   * changed must not carry the geometry of the shape it was, or a project file
   * saves two answers to where the doodads are.
   */
  it("drops the geometry of the type it no longer is", () => {
    const document_ = HideoutDocument.fromText(SHRINE);
    const array = document_.addArrayLayer("Braziers", GRID);
    const line = document_.replaceGenerator({
      ...array,
      type: "line",
      ends: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
      resolution: 4,
    });

    expect("box" in line).toBe(false);
  });

  it("refuses a layer that carries no generator", () => {
    const document_ = HideoutDocument.fromText(SHRINE);

    expect(() =>
      document_.replaceGenerator({ ...GRID, layer: "default" }),
    ).toThrow(/no generator/);
  });
});

function names(doodads) {
  return doodads.map((doodad) => doodad.name);
}
