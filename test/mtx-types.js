/**
 * `MtxTypes`, the data-mined table the doodad tables are generated from, as a
 * test fixture -- read for the one thing the generated tables deliberately do
 * not carry: which hashes are pets.
 *
 * It lives in the workspace and not in this repository, the way the game
 * exports beside it do: `packages/dat-export.repoe-fork.github.com` is a
 * read-only sibling package, so a clone of this package alone has none of it.
 * The suite that needs it skips with a message rather than fails.
 *
 * **Why a test reads it at all.** A pet is not named by the editor and never
 * will be -- wiki/decisions/pets-are-not-doodads.md -- so a pet hash in a game
 * export is expected to be unnamed. Saying that with a list of hashes is saying
 * the consequences of a rule and having to edit them in as the game produces
 * more; asking the data which rows are pets says the rule. Wiki issue 0080.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const CSV = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "../../dat-export.repoe-fork.github.com/current/poe2/heuristics/csv/MtxTypes.csv",
);

/** What a pet's metadata `Id` begins with -- `editor_data.py`'s line, too. */
const PET_METADATA = "Metadata/Items/Pets/";

/**
 * A row's first three columns: `rownum`, the quoted `Id`, and `HASH32`. The
 * rest of the row is 200-odd columns of translations and flags, none of which
 * this is asking about.
 *
 * Anchored per line, which the file allows: 8203 rows on 8203 lines, no value
 * carrying a newline. A CSV parser for three columns of a 14 MB file is a
 * dependency and a pass over the whole of it.
 */
const PET_ROW = /^\d+,"Metadata\/Items\/Pets\/[^"]*",(\d+),/gm;

let hashes = null;

export function available() {
  return fs.existsSync(CSV);
}

export const skipReason = `no data export at ${CSV}`;

/**
 * The hashes of every pet the game knows, read once. 504 of them as measured
 * 2026-08-14, and 503 of them absent from the editor's tables.
 *
 * The 504th is `BurdenbackBillyGoatPetHideout`, which has a `HideoutDoodads`
 * row -- the game calling it decoration -- so the generator takes it by the
 * join and the tables name it. It is in this set and never reaches the caller's
 * filter, which runs only over hashes the tables could not name. Were it ever
 * to drop out of the tables, this set would excuse it; that is one hash of
 * slack, taken knowingly, against a rule that needs no editing.
 *
 * `PET_METADATA` is named for the reader; the pattern carries the same prefix
 * because a `RegExp` built by hand out of a string is a thing to escape.
 */
export function petHashes() {
  if (hashes === null) hashes = readPetHashes();
  return hashes;
}

function readPetHashes() {
  const text = fs.readFileSync(CSV, "utf8");
  const found = new Set(
    [...text.matchAll(PET_ROW)].map(([, hash]) => Number(hash)),
  );
  if (found.size === 0) {
    throw new Error(`no ${PET_METADATA} rows in ${CSV}, which cannot be right`);
  }
  return found;
}
