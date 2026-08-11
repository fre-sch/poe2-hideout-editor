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
 *
 * And the two kinds of row the table names without offering -- one the
 * blacklist marked, one the game places itself and no `HideoutDoodads` row
 * describes. Both are named, neither is placeable.
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
      placeable: true,
    },
    10: {
      id: "Metadata/Items/Hideout/HideoutRedWarpRune",
      name: "Warp Rune",
      category: "Teleporter",
      tags: [],
      variations: 1,
      hideout: null,
      placeable: true,
    },
    20: {
      id: "Metadata/Items/Hideout/HideoutBlueWarpRune",
      name: "Warp Rune",
      category: "Teleporter",
      tags: ["Furniture"],
      variations: 1,
      hideout: null,
      placeable: true,
    },
    40: {
      id: "Metadata/Items/Hideout/HideoutKaruiTotem",
      name: "[DNT] Karui Totem",
      category: "Karui",
      tags: ["Furniture"],
      variations: 2,
      hideout: null,
      placeable: false,
    },
    50: {
      id: "Metadata/Items/Hideout/HideoutRecombinator",
      name: "Recombinator",
      category: null,
      tags: [],
      variations: 0,
      hideout: null,
      placeable: false,
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

  it("names what it does not offer, and offers none of it", () => {
    const palette = new Palette(DATA);

    expect(palette.find(50).name).toBe("Recombinator");
    expect(palette.entries).toHaveLength(5);
    expect(palette.placeable).toHaveLength(3);
    expect(names(palette)).not.toContain("Recombinator");
    expect(names(palette, { text: "Karui" })).toEqual([]);
  });

  it("builds its filters out of what it offers", () => {
    const palette = new Palette(DATA);

    // The blacklisted doodad's category, and no doodad left is in it.
    expect(palette.categories.map((category) => category.key)).not.toContain(
      "Karui",
    );
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
    // An essential the game places itself, which no MTX table lists.
    const found = new Palette(DATA).disagreements(doodads(["Waypoint", 7]));

    expect(found).toEqual({ checked: 0, reports: [] });
  });

  /**
   * The reason the table names what it does not offer. Every game export holds
   * a Recombinator, and a check that skipped it was checking less than the
   * document could tell it.
   */
  it("judges a doodad it names but does not offer", () => {
    const found = new Palette(DATA).disagreements(
      doodads(["Rekombinator", 50]),
    );

    expect(found.checked).toBe(1);
    expect(found.reports).toEqual([
      { hash: "50", name: "Rekombinator", expected: "Recombinator" },
    ]);
  });
});

/**
 * Counts are not asserted here. What the tables offer is the blacklist's to
 * decide -- see `scripts/editor_data.py` -- and a suite that goes red
 * because a category was dropped on purpose is a suite that has to be edited
 * to say yes. What is asserted is what must hold whatever the blacklist says.
 * The measurements live in wiki/issues/0030-scripts-doodad-palette-data.md and
 * wiki/issues/0054-scripts-doodad-table-names-every-hash.md.
 */
describe("the generated tables", () => {
  it("holds every placeable doodad under a category header", () => {
    const palette = new Palette(table("English"));
    const grouped = palette.groups().flatMap((group) => group.entries);

    expect(palette.placeable.length).toBeGreaterThan(1000);
    expect(grouped).toHaveLength(palette.placeable.length);
    expect(palette.groups()).toHaveLength(palette.categories.length);
  });

  /**
   * The whole point of the table naming more than it offers: a hideout holds
   * doodads a player cannot place -- the ones the game placed itself, and the
   * ones GGG marked as not for use -- and every one of them has to be nameable
   * or the file cannot be rewritten into another language.
   */
  it("names more doodads than it offers", () => {
    const palette = new Palette(table("English"));

    expect(palette.entries.length).toBeGreaterThan(palette.placeable.length);
    expect(palette.find(4243958141).name, "the Recombinator").toBe(
      "Recombinator",
    );
  });

  it("leaves no doodad unreachable by the tag filters", () => {
    const palette = new Palette(table("English"));
    const keys = palette.tags.map((tag) => tag.key);
    const reachable = names(palette, {
      tags: new Map(keys.map((key) => [key, INCLUDE])),
    });

    expect(keys).toContain(UNTAGGED);
    expect(reachable).toHaveLength(palette.placeable.length);
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

  /**
   * A name the game did not write is a name the load-time check reports and a
   * player cannot act on, so the published text is the text the game uses --
   * ten of the cells the export holds carry a trailing space.
   */
  it("publishes no name, category or tag padded with whitespace", () => {
    for (const language of ["English", "French", "Traditional Chinese"]) {
      const palette = new Palette(table(language));
      const texts = [
        ...palette.entries.flatMap((entry) => [entry.name, entry.hideout]),
        ...palette.categories.map((category) => category.name),
        ...palette.tags.map((tag) => tag.name),
      ];

      expect(texts.filter((text) => text && text !== text.trim())).toEqual([]);
    }
  });

  /**
   * What the palette row and the Selection section's variation button both read.
   * Every doodad has at least one variation -- being drawn at all takes one art
   * file -- and the ones with a choice to make are a minority, which is why the
   * row shows the count only where it is above one.
   */
  it("counts the variations of every doodad, and more than one for some", () => {
    const palette = new Palette(table("English"));
    const counts = palette.placeable.map((entry) => entry.variations);

    expect(counts.every((count) => count >= 1)).toBe(true);
    expect(counts.filter((count) => count > 1).length).toBeGreaterThan(0);
    expect(
      palette.find(3521191973).variations,
      "Maraketh Chest, the sample the fv split was measured from",
    ).toBe(12);
  });

  /**
   * An entry no `HideoutDoodads` row describes has no variation list to count,
   * and `0` is how the table says it cannot tell -- `gui/table.js` reads it as
   * that already, which is why those rows need no shape of their own.
   */
  it("reports no variations for the doodads it only names", () => {
    const palette = new Palette(table("English"));
    const silent = palette.entries.filter((entry) => entry.variations === 0);

    expect(silent.length).toBeGreaterThan(0);
    expect(silent.every((entry) => entry.placeable === false)).toBe(true);
    expect(palette.find(4243958141).variations, "the Recombinator").toBe(0);
  });

  /** The blacklist of `scripts/editor_data.py`, seen from this end. */
  it("offers nothing the game marks as not for use, and still names it", () => {
    const palette = new Palette(table("English"));
    const marked = (entries) =>
      entries.filter((entry) => /\[DNT\]|\[DO NOT USE\]/.test(entry.name));

    expect(marked(palette.placeable)).toEqual([]);
    expect(marked(palette.entries).length).toBeGreaterThan(0);
  });
});

/**
 * The measurement the whole feature rests on: the table's names are the names
 * the game itself wrote into a file of that language. Hundreds of samples per
 * file, which is what makes the load-time check a test rather than a hope.
 *
 * Every doodad, not merely every doodad the table happens to know: a hash the
 * table cannot name is a hideout that cannot be rewritten into another
 * language, and the Recombinator every export carries was exactly that until
 * the table began naming what it does not offer.
 *
 * What is left over is `UNNAMED`, and it is listed rather than counted so that
 * a new gap is a red suite naming the hash.
 */

/**
 * The hashes the exports hold that the generated tables do not name, measured
 * 2026-08-11 -- see wiki/issues/0056-scripts-the-hashes-the-table-cannot-name.md.
 *
 * Four pets, which the data names under `Metadata/Items/Pets` and the table
 * does not carry; `The Hooded One`, which no row of `MtxTypes` holds at all;
 * and the two NPC decorations the data names wrongly, left out rather than
 * published as a name the game rejects.
 */
const UNNAMED = new Set([
  1700354733, 181403298, 583221441, 2312204769, // pets
  4210047056, // The Hooded One
  1023253651, 2204408127, // Atalui and Ketzuli
]);
describe.skipIf(gameExport.listFiles().length === 0)(
  "the tables against the game's own exports",
  () => {
    for (const file of gameExport.listFiles()) {
      it(`agrees with every name in ${file.name}`, () => {
        const document_ = HideoutDocument.fromText(gameExport.readText(file));
        const palette = new Palette(table(document_.header.language));
        const found = palette.disagreements(document_.doodads);
        const unnamed = document_.doodads
          .filter((doodad) => palette.find(doodad.hash) === undefined)
          .filter((doodad) => !UNNAMED.has(doodad.hash));

        expect(found.reports).toEqual([]);
        expect(unnamed.map((doodad) => [doodad.hash, doodad.name])).toEqual([]);
        expect(found.checked).toBeGreaterThan(0);
      });
    }
  },
);
