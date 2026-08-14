import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { describe, expect, it } from "vitest";

import { ASSUMED, assumed, optionsFor } from "../src/hideout/languages.js";

const PUBLIC = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "../public",
);

function manifest() {
  return JSON.parse(
    fs.readFileSync(path.join(PUBLIC, "languages.json"), "utf8"),
  );
}

/** One measured spelling and one assumed, which is the whole of the field. */
const DATA = {
  languages: [
    { language: "English", spelling: "measured" },
    { language: "Japanese", spelling: ASSUMED },
  ],
};

describe("optionsFor", () => {
  it("offers what the manifest lists, in the manifest's order", () => {
    expect(optionsFor(DATA, "English")).toEqual(DATA.languages);
  });

  it("offers the document's own language first when it is not listed", () => {
    const [own, ...listed] = optionsFor(DATA, "Klingon");

    expect(own).toEqual({
      language: "Klingon",
      spelling: ASSUMED,
      unknown: true,
    });
    expect(listed).toEqual(DATA.languages);
  });

  /**
   * A language is not unheard of for being asked about before the manifest
   * arrived -- the same distinction `hideouts.optionsFor` draws for a hash.
   */
  it("offers the document's own alone, unmarked, before the manifest", () => {
    expect(optionsFor(null, "English")).toEqual([
      { language: "English", spelling: ASSUMED, unknown: false },
    ]);
  });
});

describe("assumed", () => {
  it("is what the manifest says about a language it lists", () => {
    expect(assumed(DATA, "Japanese")).toBe(true);
    expect(assumed(DATA, "English")).toBe(false);
  });

  it("says nothing about a language the manifest does not list", () => {
    expect(assumed(DATA, "Klingon")).toBe(false);
  });

  it("says nothing before the manifest has arrived", () => {
    expect(assumed(null, "Japanese")).toBe(false);
  });
});

/**
 * The manifest is the one list of languages there is -- wiki issue 0055 -- and
 * the selector is filled from it, so an entry with no tables behind it is a
 * language a player can switch to and read nothing in.
 */
describe("the generated manifest", () => {
  it("has a doodad and a hideout table for every language it lists", () => {
    for (const entry of manifest().languages) {
      const file = `${entry.language}.json`;

      expect(fs.existsSync(path.join(PUBLIC, "doodads", file))).toBe(true);
      expect(fs.existsSync(path.join(PUBLIC, "hideouts", file))).toBe(true);
    }
  });

  it("says of every language how its spelling is known", () => {
    const spellings = manifest().languages.map((entry) => entry.spelling);

    expect(new Set(spellings)).toEqual(new Set(["measured", ASSUMED]));
  });

  /**
   * The three the game itself wrote, which is the only evidence there is --
   * `hideouts/game-export` holds a file from an English, a French and a German
   * client. Anything else moving to measured means a file arrived to say so.
   */
  it("counts as measured only the spellings a game export carries", () => {
    const measured = manifest()
      .languages.filter((entry) => entry.spelling !== ASSUMED)
      .map((entry) => entry.language);

    expect(measured).toEqual(["English", "French", "German"]);
  });
});
