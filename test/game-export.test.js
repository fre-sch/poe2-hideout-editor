/**
 * The round trip is the product, so it is tested against everything the game
 * has actually written -- see wiki/goals/main.md.
 */

import { describe, expect, it } from "vitest";
import * as file from "../src/hideout/file.js";
import * as project from "../src/hideout/project.js";
import { HideoutDocument } from "../src/hideout/model.js";
import * as gameExport from "./game-export.js";

const files = gameExport.listFiles();

describe.skipIf(files.length === 0)(
  `game exports (${gameExport.skipReason})`,
  () => {
    for (const gameFile of files) {
      describe(gameFile.name, () => {
        const text = gameExport.readText(gameFile);
        const wrote = gameExport.HAND_EDITED.has(gameFile.name) ? it.skip : it;

        wrote("serializes back to the bytes the game wrote", () => {
          expect(file.serialize(file.parse(text))).toBe(text);
        });

        it("parses, serializes and parses again to the same doodads", () => {
          const first = file.parse(text);
          const second = file.parse(file.serialize(first));

          expect(second.doodads).toEqual(first.doodads);
        });

        it("keeps every doodad the file lists", () => {
          const parsed = file.parse(text);
          const asJson = JSON.parse(file.stripBom(text));

          expect(parsed.doodads.length).toBe(countDoodadEntries(text));
          expect(parsed.doodads.length).toBeGreaterThanOrEqual(
            Object.keys(asJson.doodads).length,
          );
        });

        wrote("round trips through the document model", () => {
          expect(project.bake(HideoutDocument.fromText(text))).toBe(text);
        });

        wrote("exports the same file after a project save and load", () => {
          const document_ = HideoutDocument.fromText(text);
          const saved = project.parse(project.serialize(document_));

          expect(project.bake(saved)).toBe(text);
        });
      });
    }

    it("parses Limestone to 687 doodads, not the 22 JSON.parse leaves", () => {
      const limestone = gameExport.find("Limestone_Bounds");
      if (limestone === undefined) return;
      const text = gameExport.readText(limestone);

      expect(file.parse(text).doodads).toHaveLength(687);
      expect(Object.keys(JSON.parse(file.stripBom(text)).doodads)).toHaveLength(
        22,
      );
    });
  },
);

// Independent of the parser: every doodad is one `"name": {` line, indented
// four spaces, inside `doodads`.
function countDoodadEntries(text) {
  return text.match(/^ {4}"[^"]*": \{$/gm).length;
}
