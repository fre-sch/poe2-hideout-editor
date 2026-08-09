import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { describe, expect, it } from "vitest";

import * as gameExport from "./game-export.js";
import { HideoutDocument } from "../src/hideout/model.js";
import {
  Palette,
  UNTAGGED,
  INCLUDE,
  EXCLUDE,
} from "../src/hideout/palette.js";

const TABLES = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "../public/doodads",
);

function table(language) {
  return JSON.parse(
    fs.readFileSync(path.join(TABLES, `${language}.json`), "utf8"),
  );
}

/**
 * Three doodads with everything the panel reads off them: two sharing a name,
 * one tagged, one untagged, one tied to a hideout.
 */
const DATA = {
  language: "English",
  t9nCategory: { Teleporter: "Teleporter", Coastal: "Coast" },
  t9nTags: { Plants: "Plants", Furniture: "Furniture" },
  doodads: {
    30: {
      id: "Metadata/Items/Hideout/HideoutNikauPalm",
      name: "Nikau Palm",
      category: "Coastal",
      tags: ["Plants"],
      variations: 3,
      hideout: "Canal Hideout",
    },
    10: {
      id: "Metadata/Items/Hideout/HideoutRedWarpRune",
      name: "Warp Rune",
      category: "Teleporter",
      tags: [],
      variations: 1,
      hideout: null,
    },
    20: {
      id: "Metadata/Items/Hideout/HideoutBlueWarpRune",
      name: "Warp Rune",
      category: "Teleporter",
      tags: ["Furniture"],
      variations: 1,
      hideout: null,
    },
  },
};

describe("Palette", () => {
  it("groups by category, translated, in category order", () => {
    const palette = new Palette(DATA);

    expect(palette.groups().map((group) => group.category)).toEqual([
      "Coast",
      "Teleporter",
    ]);
  });

  it("finds a doodad whether its hash is a number or a string", () => {
    const palette = new Palette(DATA);

    expect(palette.find(30).name).toBe("Nikau Palm");
    expect(palette.find("30").name).toBe("Nikau Palm");
  });

  it("distinguishes shared names, and only those", () => {
    const palette = new Palette(DATA);
    const [coast, teleporter] = palette.groups();

    expect(coast.entries[0].distinguisher).toBeUndefined();
    expect(teleporter.entries.map((entry) => entry.distinguisher)).toEqual([
      "HideoutBlueWarpRune",
      "HideoutRedWarpRune",
    ]);
  });

  it("matches a search against the name, whatever its case", () => {
    const palette = new Palette(DATA);
    const found = new Palette(DATA).groups({ text: "  nIkAu  " });

    expect(found.flatMap((group) => group.entries)).toHaveLength(1);
    expect(palette.groups({ text: "nothing here" })).toEqual([]);
  });

  it("shows everything when nothing is filtered", () => {
    const palette = new Palette(DATA);

    expect(palette.groups({ tags: new Map(), categories: new Map() })).toEqual(
      palette.groups(),
    );
  });

  it("filters by tag, and Untagged is one of them", () => {
    const palette = new Palette(DATA);
    const tagged = names(palette, { tags: filter({ Plants: INCLUDE }) });
    const untagged = names(palette, { tags: filter({ [UNTAGGED]: INCLUDE }) });

    expect(tagged).toEqual(["Nikau Palm"]);
    expect(untagged).toEqual(["Warp Rune"]);
  });

  it("offers Untagged besides every tag the table translates", () => {
    const palette = new Palette(DATA);

    expect(palette.tags.map((tag) => tag.key)).toEqual([
      "Furniture",
      "Plants",
      UNTAGGED,
    ]);
  });

  it("offers the categories its doodads are in, by their translation", () => {
    const palette = new Palette(DATA);

    expect(palette.categories).toEqual([
      { key: "Coastal", name: "Coast" },
      { key: "Teleporter", name: "Teleporter" },
    ]);
  });

  it("includes as OR", () => {
    const palette = new Palette(DATA);
    const found = names(palette, {
      tags: filter({ Plants: INCLUDE, Furniture: INCLUDE }),
    });

    expect(found).toEqual(["Nikau Palm", "Warp Rune"]);
  });

  it("excludes over any include", () => {
    const palette = new Palette(DATA);
    const found = names(palette, {
      tags: filter({ Plants: INCLUDE, Furniture: INCLUDE }),
      categories: filter({ Coastal: EXCLUDE }),
    });

    expect(found).toEqual(["Warp Rune"]);
  });

  it("excludes a doodad whose other tag is included", () => {
    const palette = new Palette(DATA);
    const found = names(palette, {
      tags: filter({ Plants: INCLUDE, Furniture: EXCLUDE }),
    });

    expect(found).toEqual(["Nikau Palm"]);
  });

  it("reads the two filters together", () => {
    const palette = new Palette(DATA);
    const found = names(palette, {
      categories: filter({ Teleporter: INCLUDE }),
      tags: filter({ Furniture: INCLUDE }),
    });

    expect(found).toEqual(["Warp Rune"]);
    expect(names(palette, { categories: filter({ Teleporter: INCLUDE }) }))
      .toHaveLength(2);
  });
});

const filter = (states) => new Map(Object.entries(states));

const names = (palette, wanted) =>
  palette
    .groups(wanted)
    .flatMap((group) => group.entries.map((entry) => entry.name));

/**
 * The check that decides whether the editor may write a name at all. A table
 * that disagrees with the document would write a file the game rejects, so
 * disagreement has to be found before a placement rather than after an import.
 */
describe("Palette.disagreements", () => {
  const doodads = (...names) =>
    names.map(([name, hash]) => ({ name, hash, x: 0, y: 0, r: 0, fv: 0 }));

  it("counts what it recognised and reports what disagreed", () => {
    const found = new Palette(DATA).disagreements(
      doodads(["Warp Rune", 10], ["Portail runique", 20]),
    );

    expect(found.checked).toBe(2);
    expect(found.reports).toEqual([
      { hash: "20", name: "Portail runique", expected: "Warp Rune" },
    ]);
  });

  it("reports a hash once, however often the hideout holds it", () => {
    const found = new Palette(DATA).disagreements(
      doodads(["Palmier", 30], ["Palmier", 30], ["Palmier", 30]),
    );

    expect(found.reports).toHaveLength(1);
  });

  it("takes a doodad it does not know as no evidence either way", () => {
    // The game places essentials itself and no MTX table lists them.
    const found = new Palette(DATA).disagreements(doodads(["Recombinator", 7]));

    expect(found).toEqual({ checked: 0, reports: [] });
  });
});

/**
 * Counts are not asserted here. What the tables hold is the blacklist's to
 * decide -- see `scripts/doodad_palette.py` -- and a suite that goes red
 * because a category was dropped on purpose is a suite that has to be edited
 * to say yes. What is asserted is what must hold whatever the blacklist says.
 * The measurements live in wiki/issues/0030-scripts-doodad-palette-data.md.
 */
describe("the generated tables", () => {
  it("holds every doodad under a category header", () => {
    const palette = new Palette(table("English"));
    const grouped = palette.groups().flatMap((group) => group.entries);

    expect(palette.entries.length).toBeGreaterThan(1000);
    expect(grouped).toHaveLength(palette.entries.length);
    expect(palette.groups()).toHaveLength(palette.categories.length);
  });

  it("leaves no doodad unreachable by the tag filters", () => {
    const palette = new Palette(table("English"));
    const keys = palette.tags.map((tag) => tag.key);
    const reachable = names(palette, {
      tags: new Map(keys.map((key) => [key, INCLUDE])),
    });

    expect(keys).toContain(UNTAGGED);
    expect(reachable).toHaveLength(palette.entries.length);
  });

  it("offers a filter for every category, and no empty ones", () => {
    const palette = new Palette(table("English"));

    for (const category of palette.categories) {
      expect(
        names(palette, { categories: filter({ [category.key]: INCLUDE }) })
          .length,
      ).toBeGreaterThan(0);
    }
  });

  it("names the hideout of the doodads a hideout grants, and no others", () => {
    const palette = new Palette(table("English"));
    const marked = palette.entries.filter((entry) => entry.hideout);

    expect(marked.length).toBeGreaterThan(0);
    expect(marked.length).toBeLessThan(palette.entries.length);
  });

  /** The blacklist of `scripts/doodad_palette.py`, seen from this end. */
  it("offers nothing the game marks as not for use", () => {
    const palette = new Palette(table("English"));
    const marked = palette.entries.filter((entry) =>
      /\[DNT\]|\[DO NOT USE\]/.test(entry.name),
    );

    expect(marked).toEqual([]);
  });
});

/**
 * The measurement the whole feature rests on: the table's names are the names
 * the game itself wrote into a file of that language. Hundreds of samples per
 * file, which is what makes the load-time check a test rather than a hope.
 */
describe.skipIf(gameExport.listFiles().length === 0)(
  "the tables against the game's own exports",
  () => {
    for (const file of gameExport.listFiles()) {
      it(`agrees with every name in ${file.name}`, () => {
        const document_ = HideoutDocument.fromText(gameExport.readText(file));
        const palette = new Palette(table(document_.header.language));
        const found = palette.disagreements(document_.doodads);

        expect(found.reports).toEqual([]);
        expect(found.checked).toBeGreaterThan(0);
      });
    }
  },
);
