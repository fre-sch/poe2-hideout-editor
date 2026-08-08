/**
 * The domain layer is framework-free by rule, not by habit. Importing Preact,
 * Konva or the DOM into it is what made the previous editor untestable --
 * wiki issue 0011 -- and nothing in a parser or a unit conversion needs them.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { describe, expect, it } from "vitest";

const DIRECTORY = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "../src/hideout",
);

describe("src/hideout", () => {
  for (const name of fs.readdirSync(DIRECTORY)) {
    it(`${name} imports only from src/hideout and node built-ins`, () => {
      const source = fs.readFileSync(path.join(DIRECTORY, name), "utf8");
      const specifiers = [...source.matchAll(/^import .* from "(.*)";$/gm)].map(
        (match) => match[1],
      );

      for (const specifier of specifiers) {
        expect(specifier).toMatch(/^(\.\/[^/]+\.js|node:.+)$/);
      }
    });
  }
});
