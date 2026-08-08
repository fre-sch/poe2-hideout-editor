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
