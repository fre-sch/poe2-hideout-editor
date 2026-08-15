/**
 * The outline file for a hideout type, keyed by `hideout_hash`.
 *
 * An outline is the placeable area, measured in game and written as an SVG in
 * doodad coordinates. see `units.toStage`, `src/viewport/bounds.js`.
 *
 * Which hideouts exist and what they are called is game data, and is
 * `hideouts.js`. This table is only which of them somebody has measured, and
 * only that belongs in source. see issues/0021.
 *
 * A hideout type without an outline is the ordinary case: it loads, edits and
 * saves, and draws nothing underneath.
 */

const OUTLINES = {
  6697: "HideoutColossalTitan_6697.svg",
  12394: "limestone_12394.svg",
  13526: "felled_13526.svg",
  26805: "shrine_26805.svg",
  30315: "HideoutDreadnought_30315.svg",
  60415: "HideoutCanal_60415.svg",
  60854: "HideoutBlankMountain_60854.svg",
  4638: "HideoutShoreline_4638.svg",
  31541: "HideoutVerdant_31541.svg",
  23536: "HideoutArcaneIsle_23536.svg",
};

/**
 * The outline file for a `hideout_hash`, or `undefined`.
 *
 * Keyed as a string: a hash arrives as a number from a parsed file and as a
 * string from a `<select>`.
 */
export function outlineFor(hash) {
  return OUTLINES[`${hash}`];
}

/** Every hash there is an outline for. */
export function hashes() {
  return Object.keys(OUTLINES);
}
