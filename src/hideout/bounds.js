/**
 * The hideout types the editor knows, and the outline file for each.
 *
 * A hideout type is identified by the `hideout_hash` a `.hideout` file carries.
 * The outline is the placeable area, derived from the game by
 * `scripts/probe_grid.py` and written as an SVG in doodad coordinates -- see
 * `units.toStage` for why that is the same space the stage draws in.
 *
 * This table decides what the editor *draws*, and nothing else. It used to
 * decide what the editor *saved* as well, which is how the typo below reached
 * player files as "Limestone Hideoout" -- wiki issue 0009. The header is now
 * passed through verbatim by `model.js`, so a name here is a label in a
 * dropdown and the typo is simply fixed.
 *
 * Four of the game's seven hideout types are known, wiki issue 0007. An unknown
 * type loads, edits and saves; it just has no outline to draw under it.
 */

const DEFINITIONS = [
  { hash: 13526, name: "Felled Hideout", file: "felled_13526.svg" },
  { hash: 26805, name: "Shrine Hideout", file: "shrine_26805.svg" },
  { hash: 60415, name: "Canal Hideout", file: "canal_60415.svg" },
  { hash: 12394, name: "Limestone Hideout", file: "limestone_12394.svg" },
];

/** Every known type, by display name, for a dropdown. */
export function definitions() {
  return [...DEFINITIONS].sort((one, other) =>
    one.name.localeCompare(other.name, "en", { sensitivity: "base" }),
  );
}

/**
 * The definition for a `hideout_hash`, or `undefined`.
 *
 * Compared as strings because a hash arrives as a number from a parsed file and
 * as a string from a `<select>`, and the editor has no business caring which.
 */
export function find(hash) {
  return DEFINITIONS.find((definition) => `${definition.hash}` === `${hash}`);
}

/**
 * Every type offerable for a file of type `hash` named `name`: the known ones,
 * and the file's own first when it is not among them.
 *
 * The arguments are the file's, not the current selection's, and that is the
 * whole point. A player whose hideout the editor does not know may still want
 * to borrow an outline to work against, and must be able to put it back; an
 * entry that exists only while it is selected is a one-way door -- wiki issue
 * 0007.
 *
 * The file's own entry names no outline file, because there is none to draw.
 * That absence is how a caller tells the two kinds apart.
 */
export function optionsFor(hash, name) {
  if (find(hash)) return definitions();
  return [{ hash, name: name || "Unknown hideout" }, ...definitions()];
}
