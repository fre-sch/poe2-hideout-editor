/**
 * The hideout types the game has, named in one language.
 *
 * Built from a `public/hideouts/{language}.json` file, generated from the
 * game's own data by `scripts/editor_data.py` -- 83 types, keyed by the
 * `hideout_hash` a `.hideout` header carries, named the way the game names them
 * in the document's language. Fetching it is `table.js`'s, for the reason
 * `palette.js` gives: the domain layer is framework-free by rule, wiki issue
 * 0011.
 *
 * What the table cannot say is what a hideout looks like. That is traced in
 * game, one SVG per type in `public/bounds/`, and seven of the 83 have one --
 * see `bounds.js`. So the two are composed here, and a type with a name and no
 * outline is the ordinary case rather than a gap: it loads, edits, saves and
 * draws nothing.
 *
 * A hash in neither table is a third thing again -- a hideout the game data
 * does not know, from a newer patch or a hand-edited file -- and telling it
 * apart from a type merely lacking an outline is what wiki issue 0021 was for.
 */

import * as bounds from "./bounds.js";

/** What to call a hideout that neither the table nor the file names. */
export const UNKNOWN = "Unknown hideout";

export class Hideouts {
  /** `data` is a parsed `public/hideouts/{language}.json`. */
  constructor(data) {
    this.language = data.language;
    this.entries = Object.entries(data.hideouts)
      .map(([hash, name]) => ({ hash, name, file: bounds.outlineFor(hash) }))
      .sort((one, other) => one.name.localeCompare(other.name));
    this.byHash = new Map(this.entries.map((entry) => [entry.hash, entry]));
  }

  /**
   * The entry for a `hideout_hash`, or `undefined`.
   *
   * Keyed by string, the same as `Palette.find`: a hash arrives as a number
   * from a parsed file and as a string from a `<select>`.
   */
  find(hash) {
    return this.byHash.get(`${hash}`);
  }
}

/**
 * Every type offerable for a file of type `hash` named `name`: the ones the
 * table knows, and the file's own first when it is not among them.
 *
 * `hideouts` is the table or `null` -- it is fetched, and until it arrives the
 * file's own type is the only one there is to offer.
 *
 * The arguments are the file's, not the current selection's, and that is the
 * whole point. A player whose hideout the editor does not know may still want
 * to borrow an outline to work against, and must be able to put it back; an
 * entry that exists only while it is selected is a one-way door -- wiki issue
 * 0007.
 */
export function optionsFor(hideouts, hash, name) {
  if (!hideouts) return [own(hash, name, false)];
  if (hideouts.find(hash)) return hideouts.entries;
  return [own(hash, name, true), ...hideouts.entries];
}

/**
 * The file's own type, as an entry. `unknown` is what the table said about the
 * hash and not what the file left out, so it is false while there is no table
 * to have asked -- a hideout is not unknown for being asked about too early.
 */
function own(hash, name, unknown) {
  return {
    hash: `${hash}`,
    name: name || UNKNOWN,
    file: bounds.outlineFor(hash),
    unknown,
  };
}

/**
 * What to call the hideout of a file: what the game data calls that hash in the
 * document's language, or failing that what the file calls itself.
 *
 * The table's name is the current one and the file's is whatever the client
 * that wrote it used, which is why the table is asked first. Neither is written
 * back -- `hideout_name` is saved exactly as it was read, wiki issue 0009.
 */
export function nameFor(hideouts, hash, name) {
  return hideouts?.find(hash)?.name ?? name;
}
