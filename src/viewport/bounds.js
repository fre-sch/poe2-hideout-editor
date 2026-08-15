/**
 * The placeable-area outline, drawn under a hideout.
 *
 * The outlines are SVG in doodad coordinates, which is what `units.toStage`
 * does, so the path data goes onto the stage unscaled and untranslated. A
 * hideout landing on its own outline is the proof the mapping is right.
 *
 * The ones in `public/bounds/` were traced by hand in game.
 * `scripts/probe_grid.py` derives them instead and writes the same convention;
 * it agrees to within a few units and has not replaced them. see
 * discussions/bounds-by-probe-grid.
 */

import Konva from "konva";

import * as bounds from "../hideout/bounds.js";

const COLOR = "#FF8888";
const CACHE = new Map();

/**
 * The outline for a `hideout_hash` as a `Konva.Group`, or `null` for a hideout
 * type nobody has traced. see issues/0021.
 *
 * Asynchronous because the outlines are static assets rather than source.
 */
export async function load(hash) {
  const file = bounds.outlineFor(hash);
  if (!file) return null;

  const group = new Konva.Group({ listening: false });
  for (const data of await pathData(file)) {
    group.add(
      new Konva.Path({
        data,
        stroke: COLOR,
        strokeWidth: 1,
        strokeScaleEnabled: false,
        listening: false,
      }),
    );
  }
  return group;
}

async function pathData(file) {
  if (!CACHE.has(file)) {
    CACHE.set(file, fetchPathData(file));
  }
  return CACHE.get(file);
}

/**
 * The `d` attributes of an outline file.
 *
 * Read with a regular expression rather than `DOMParser`: these files are
 * written by one script in one shape, and every path is wanted.
 */
async function fetchPathData(file) {
  const url = `${import.meta.env.BASE_URL}bounds/${file}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  return [...text.matchAll(/\bd="([^"]+)"/g)].map((match) => match[1]);
}
