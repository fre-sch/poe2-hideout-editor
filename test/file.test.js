import { describe, expect, it } from "vitest";
import * as file from "../src/hideout/file.js";

const BOM = "﻿";

// A hideout with the format's defining property: a repeated doodad name.
const TWO_BURNERS = `${BOM}{
  "version": 1,
  "language": "English",
  "hideout_name": "Shrine Hideout",
  "hideout_hash": 26805,
  "doodads": {
    "Maraketh Incense Burner": {
      "hash": 279768580,
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

describe("parse", () => {
  it("keeps doodads that repeat a display name", () => {
    const data = file.parse(TWO_BURNERS);

    expect(data.doodads).toHaveLength(2);
    expect(data.doodads.map(([name]) => name)).toEqual([
      "Maraketh Incense Burner",
      "Maraketh Incense Burner",
    ]);
    expect(data.doodads.map(([, fields]) => fields.x)).toEqual([392, 393]);
  });

  it("loses them through JSON.parse, which is why the parser exists", () => {
    expect(Object.keys(JSON.parse(file.stripBom(TWO_BURNERS)).doodads)).toEqual(
      ["Maraketh Incense Burner"],
    );
  });

  it("reads the header", () => {
    const data = file.parse(TWO_BURNERS);

    expect(data.version).toBe(1);
    expect(data.language).toBe("English");
    expect(data.hideout_name).toBe("Shrine Hideout");
    expect(data.hideout_hash).toBe(26805);
  });

  it("reads a file without a byte order mark", () => {
    expect(file.parse(file.stripBom(TWO_BURNERS)).doodads).toHaveLength(2);
  });
});

describe("parse rejects malformed input", () => {
  // Each of these hung the browser or passed silently before, wiki issue 0002.
  const truncations = {
    "mid string": '{ "hideout_name": "Shrine Hid',
    "mid object": '{ "hideout_name": "Shrine Hideout",',
    "mid array": '{ "doodads": [1, 2',
    "before any value": "  ",
  };

  for (const [where, text] of Object.entries(truncations)) {
    it(`truncated ${where}`, () => {
      expect(() => file.parse(text)).toThrow(SyntaxError);
    });
  }

  it("reports the offset where parsing failed", () => {
    expect(() => file.parse('{ "name": "abc')).toThrow(/offset 10/);
  });

  it("rejects escape sequences rather than mangling them", () => {
    expect(() => file.parse('{ "name": "a\\"b" }')).toThrow(/Escape sequences/);
  });

  it("rejects trailing content after the document", () => {
    expect(() => file.parse("{} garbage")).toThrow(/Expected end of input/);
  });

  it("rejects a bare word", () => {
    expect(() => file.parse('{ "name": nope }')).toThrow(SyntaxError);
  });
});

describe("serialize", () => {
  it("writes back what was read, byte for byte", () => {
    expect(file.serialize(file.parse(TWO_BURNERS))).toBe(TWO_BURNERS);
  });

  it("emits the byte order mark the game writes", () => {
    expect(file.serialize(file.parse(TWO_BURNERS)).startsWith(BOM)).toBe(true);
  });
});
