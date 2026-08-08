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
  it("finds a type by hash, as a number or as a string", () => {
    expect(bounds.find(13526).name).toBe("Felled Hideout");
    expect(bounds.find("13526").name).toBe("Felled Hideout");
  });

  it("has no type for a hash it does not know", () => {
    expect(bounds.find(1)).toBeUndefined();
  });

  // The 3D editor rewrote `hideout_name` from this table, so its typo reached
  // saved files as "Limestone Hideoout" -- wiki issue 0009.
  it("spells Limestone Hideout correctly", () => {
    expect(bounds.find(12394).name).toBe("Limestone Hideout");
  });

  it("lists every type by name", () => {
    const names = bounds.definitions().map((definition) => definition.name);
    expect(names).toEqual([...names].sort());
  });

  it("names an outline file that exists and holds path data", () => {
    for (const definition of bounds.definitions()) {
      const text = fs.readFileSync(path.join(OUTLINES, definition.file), "utf8");
      expect(text).toMatch(/\bd="[^"]+"/);
    }
  });
});
