/**
 * The outline file for a hideout type, where somebody has traced one.
 *
 * A hideout type is identified by the `hideout_hash` a `.hideout` file carries.
 * The outline is the placeable area, measured in game and written as an SVG in
 * doodad coordinates -- see `units.toStage` for why that is the same space the
 * stage draws in, and `src/viewport/bounds.js` for where the files come from.
 *
 * This table decides what the editor *draws*, and nothing else. It carried
 * display names too until wiki issue 0021, and that was two tables in one:
 * which hideouts exist and what they are called is game data in ten languages,
 * generated into `public/hideouts/{language}.json` and read by `hideouts.js`;
 * which of them somebody has measured is this, and only this belongs in source.
 *
 * Seven of the game's 83 hideout types have an outline. The rest load, edit and
 * save like any other; they just have nothing to draw underneath.
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
 * Keyed as a string because a hash arrives as a number from a parsed file and
 * as a string from a `<select>`, and the editor has no business caring which.
 */
export function outlineFor(hash) {
  return OUTLINES[`${hash}`];
}

/** Every hash there is an outline for. */
export function hashes() {
  return Object.keys(OUTLINES);
}
