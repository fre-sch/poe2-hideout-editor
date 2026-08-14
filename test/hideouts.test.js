import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { describe, expect, it } from "vitest";

import * as gameExport from "./game-export.js";
import * as bounds from "../src/hideout/bounds.js";
import { HideoutDocument } from "../src/hideout/model.js";
import {
  Hideouts,
  UNKNOWN,
  headerFor,
  nameFor,
  optionsFor,
} from "../src/hideout/hideouts.js";

const PUBLIC = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "../public",
);

function table(language) {
  return JSON.parse(
    fs.readFileSync(path.join(PUBLIC, "hideouts", `${language}.json`), "utf8"),
  );
}

function languages() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(PUBLIC, "languages.json"), "utf8"),
  );
  return manifest.languages.map((entry) => entry.language);
}

/** Two types with an outline and one without, which is the ordinary case. */
const DATA = {
  language: "English",
  hideouts: {
    13526: "Felled Hideout",
    26805: "Shrine Hideout",
    1739: "Darkwood Hideout",
  },
};

describe("Hideouts", () => {
  it("finds a hideout whether its hash is a number or a string", () => {
    const hideouts = new Hideouts(DATA);

    expect(hideouts.find(13526).name).toBe("Felled Hideout");
    expect(hideouts.find("13526").name).toBe("Felled Hideout");
  });

  it("knows nothing of a hash the game data does not have", () => {
    expect(new Hideouts(DATA).find(99999)).toBeUndefined();
  });

  it("lists every type by name", () => {
    const names = new Hideouts(DATA).entries.map((entry) => entry.name);

    expect(names).toEqual([...names].sort());
  });

  it("joins the outline onto the type, where there is one", () => {
    const hideouts = new Hideouts(DATA);

    expect(hideouts.find(13526).file).toBe(bounds.outlineFor(13526));
    expect(hideouts.find(1739).file).toBeUndefined();
  });
});

describe("optionsFor", () => {
  it("offers every known type for a hideout the data knows", () => {
    const hideouts = new Hideouts(DATA);

    expect(optionsFor(hideouts, 26805, "Shrine Hideout")).toEqual(
      hideouts.entries,
    );
  });

  /**
   * Wiki issue 0007. The player has to be able to leave their own hideout to
   * borrow an outline and then come back to it, so the entry is keyed off the
   * file and not off what is selected -- an option that disappears when it
   * stops being selected cannot be returned to.
   */
  it("offers an unknown hideout by its own name and hash, first", () => {
    const hideouts = new Hideouts(DATA);
    const options = optionsFor(hideouts, 99999, "Hall of Ghosts");

    expect(options[0]).toEqual({
      hash: "99999",
      name: "Hall of Ghosts",
      file: undefined,
      unknown: true,
    });
    expect(options.slice(1)).toEqual(hideouts.entries);
  });

  it("names an unknown hideout that names itself nothing", () => {
    expect(optionsFor(new Hideouts(DATA), 99999, "")[0].name).toBe(UNKNOWN);
  });

  /**
   * The table is fetched, and a hideout is not unknown for being asked about
   * before it arrives -- the file's own type is offered, unmarked, with
   * whatever outline the editor has for it.
   */
  it("offers the file's own type alone while there is no table", () => {
    const options = optionsFor(null, 13526, "Felled Hideout");

    expect(options).toEqual([
      {
        hash: "13526",
        name: "Felled Hideout",
        file: bounds.outlineFor(13526),
        unknown: false,
      },
    ]);
  });
});

describe("nameFor", () => {
  it("names a hideout the way the data names it", () => {
    expect(nameFor(new Hideouts(DATA), 13526, "Felled Hideoout")).toBe(
      "Felled Hideout",
    );
  });

  it("falls back to what the file calls itself", () => {
    expect(nameFor(new Hideouts(DATA), 99999, "Hall of Ghosts")).toBe(
      "Hall of Ghosts",
    );
    expect(nameFor(null, 13526, "Felled Hideout")).toBe("Felled Hideout");
  });
});

/** Wiki issue 0061. What a chosen type writes into the header. */
describe("headerFor", () => {
  const OWN = { hash: 99999, name: "Hall of Ghosts" };

  it("names the chosen type as the table does, and numbers the hash", () => {
    expect(headerFor(new Hideouts(DATA), "26805", OWN)).toEqual({
      hideout_hash: 26805,
      hideout_name: "Shrine Hideout",
    });
  });

  /** Leaving the file's own type has to be reversible -- wiki issue 0007. */
  it("restores the file's own name coming back to a hash no table names", () => {
    expect(headerFor(new Hideouts(DATA), "99999", OWN)).toEqual({
      hideout_hash: 99999,
      hideout_name: "Hall of Ghosts",
    });
  });

  it("writes the file's own name while there is no table", () => {
    expect(headerFor(null, "99999", OWN).hideout_name).toBe("Hall of Ghosts");
  });
});

/**
 * The generated tables, `public/hideouts/{language}.json`. The measurements are
 * in wiki/issues/0021-bounds-hideout-names-per-language.md; what is asserted
 * here is what must hold whatever a later patch adds.
 */
describe("the generated tables", () => {
  it("has a table for every language the manifest lists", () => {
    for (const language of languages()) {
      expect(table(language).language).toBe(language);
    }
  });

  it("holds the same hashes in every language", () => {
    const english = Object.keys(table("English").hideouts);

    expect(english.length).toBeGreaterThan(80);
    for (const language of languages()) {
      expect(Object.keys(table(language).hideouts)).toEqual(english);
    }
  });

  /**
   * The seven `MapHideout*_Claimable` areas carry the display name of a free
   * hideout under a hash of their own -- Felled is 13526 as a hideout and 59076
   * as the map that claims it. Carrying them would name each free hideout
   * twice, and would let a lookup succeed on a hash no header can hold.
   */
  it("names no hideout twice, and holds no claimable area", () => {
    for (const language of languages()) {
      const hideouts = new Hideouts(table(language));
      const names = hideouts.entries.map((entry) => entry.name);

      expect(hideouts.find(59076), "the claimable Felled map").toBeUndefined();
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("names every type the editor has an outline for", () => {
    const hideouts = new Hideouts(table("English"));

    for (const hash of bounds.hashes()) {
      expect(hideouts.find(hash)?.name).toBeTruthy();
    }
  });

  /** Written from memory, this was "Alpine Hideout" -- wiki issue 0021. */
  it("names a hideout the way the data does, in every language", () => {
    expect(new Hideouts(table("English")).find(60854).name).toBe(
      "Alpine Plateau Hideout",
    );
    expect(new Hideouts(table("German")).find(60854).name).toBe(
      "Verstecktes Alpenplateau",
    );
  });

  /**
   * Two Traditional Chinese cells begin with a space. A name the game did not
   * write is a name a player cannot act on, so `localized` strips and this is
   * the check that it did.
   */
  it("publishes no name padded with whitespace", () => {
    for (const language of languages()) {
      const names = new Hideouts(table(language)).entries.map(
        (entry) => entry.name,
      );

      expect(names.filter((name) => name !== name.trim())).toEqual([]);
    }
  });
});

/**
 * The measurement the header name rests on: the table's name for a hash is the
 * name the game itself wrote into a file of that type and that language.
 */
describe.skipIf(gameExport.listFiles().length === 0)(
  "the tables against the game's own exports",
  () => {
    for (const file of gameExport.listFiles()) {
      it.skipIf(gameExport.HAND_EDITED.has(file.name))(
        `names the hideout of ${file.name} the way the file does`,
        () => {
          const header = HideoutDocument.fromText(
            gameExport.readText(file),
          ).header;
          const hideouts = new Hideouts(table(header.language));

          expect(hideouts.find(header.hideout_hash)?.name).toBe(
            header.hideout_name,
          );
        },
      );
    }
  },
);

/**
 * The header name under a switch of language -- wiki issue 0053. The `felled_*`
 * exports are one hideout from three clients, so what the German table must
 * call the English file's hash is not a guess: it is the German file's own
 * `hideout_name`.
 */
const FELLED = ["english", "french", "german"];

const header = (language) =>
  HideoutDocument.fromText(
    gameExport.readText(gameExport.find(`felled_${language}`)),
  ).header;

describe.skipIf(
  FELLED.some((language) => !gameExport.find(`felled_${language}`)),
)("the same hideout in three languages", () => {
  const [english, ...others] = FELLED.map(header);

  for (const other of others) {
    it(`names the English file's hideout as the ${other.language} file does`, () => {
      const hideouts = new Hideouts(table(other.language));

      expect(english.hideout_hash).toBe(other.hideout_hash);
      expect(
        nameFor(hideouts, english.hideout_hash, english.hideout_name),
      ).toBe(other.hideout_name);
    });
  }
});
