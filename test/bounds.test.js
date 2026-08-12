import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { describe, expect, it } from "vitest";

import * as bounds from "../src/hideout/bounds.js";

const OUTLINES = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "../public/bounds",
);

describe("bounds", () => {
  it("finds an outline by hash, as a number or as a string", () => {
    expect(bounds.outlineFor(13526)).toBe("felled_13526.svg");
    expect(bounds.outlineFor("13526")).toBe("felled_13526.svg");
  });

  it("has no outline for a hash nobody has traced", () => {
    expect(bounds.outlineFor(1)).toBeUndefined();
  });

  it("names an outline file that exists and holds path data", () => {
    for (const hash of bounds.hashes()) {
      const file = path.join(OUTLINES, bounds.outlineFor(hash));
      expect(fs.readFileSync(file, "utf8")).toMatch(/\bd="[^"]+"/);
    }
  });

  /**
   * The other direction: an SVG nothing points at is drawn under no hideout,
   * and a traced outline that never reaches the screen is the whole of the work
   * wasted quietly.
   */
  it("points at every outline file there is", () => {
    const named = bounds.hashes().map((hash) => bounds.outlineFor(hash));
    const files = fs
      .readdirSync(OUTLINES)
      .filter((name) => name.endsWith(".svg"));

    expect(named.sort()).toEqual(files.sort());
  });
});
