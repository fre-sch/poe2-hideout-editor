/**
 * The game exports in `hideouts/game-export`, as test fixtures.
 *
 * They live in the workspace, not in this repository: `.gitignore` excludes
 * `*.hideout`, so a clone of the package alone has none of them. The suites
 * that need them skip with a message rather than fail, and every property that
 * can be pinned without them is pinned by a literal fixture instead.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const DIRECTORY = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "../../../hideouts/game-export",
);

/**
 * The files in that directory the game did not write.
 *
 * `AlpineTest` was mangled by hand and imported, to measure what the game
 * checks: the names are empty strings, `hideout_name` is the French name of a
 * different hideout, and `language` says German. The game accepted it, which is
 * the measurement -- wiki issue 0057.
 *
 * So it is a fixture for what a reader must survive, not for what a writer must
 * reproduce. Byte identity is a promise about the game's own output, and this
 * file carries a trailing newline no export has; the name check has nothing to
 * check. Both suites skip it by this set and say so.
 */
export const HAND_EDITED = new Set(["AlpineTest.hideout"]);

export function listFiles() {
  if (!fs.existsSync(DIRECTORY)) return [];
  return fs
    .readdirSync(DIRECTORY)
    .filter((name) => name.endsWith(".hideout"))
    .map((name) => ({ name, path: path.join(DIRECTORY, name) }));
}

export function readText(file) {
  return fs.readFileSync(file.path, "utf8");
}

export function find(namePrefix) {
  return listFiles().find((file) => file.name.startsWith(namePrefix));
}

export const skipReason = `no game exports in ${DIRECTORY}`;
