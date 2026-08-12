/**
 * The placeable-area outline, drawn under a hideout.
 *
 * The outlines are SVG in doodad coordinates -- SVG x from doodad y, SVG y from
 * doodad x, which is exactly what `units.toStage` does. So the path data goes
 * onto the stage unscaled and untranslated, and a hideout that lands on its own
 * outline is the proof that the coordinate mapping is right.
 *
 * The ones in `public/bounds/` were traced by hand, walking each perimeter in
 * game placing one doodad at a time. `scripts/probe_grid.py` derives them from
 * the game instead and writes the same convention; its outlines agree with the
 * hand traces to within a few units, but have not replaced them.
 *
 * The 3D editor took the same files through an SVG loader, a shape geometry, an
 * edge geometry and line segments, and then rotated the result onto the XZ
 * plane, to draw an outline that started life as a 2D path. `Konva.Path` eats
 * the path data directly.
 */

import Konva from "konva";

import * as bounds from "../hideout/bounds.js";

const COLOR = "#FF8888";
const CACHE = new Map();

/**
 * The outline for a `hideout_hash` as a `Konva.Group`, or `null` for a hideout
 * type nobody has traced -- 76 of the game's 83, wiki issue 0021.
 *
 * Asynchronous because the outlines are static assets rather than source: they
 * come from the game by way of `scripts/`, and no edit to them belongs here.
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
 * Read with a regular expression rather than `DOMParser` because these files
 * are written by one script in one shape, and every one of their paths is
 * wanted. A parser would be answering a question nobody asked.
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
