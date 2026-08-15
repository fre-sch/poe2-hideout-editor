/**
 * Domain doodads to Konva nodes, and back.
 *
 * A node holds a reference to its domain doodad and nothing else; the array in
 * `HideoutDocument` stays the source of truth. Nothing re-parents a node, so a
 * doodad cannot be in two collections at once. see
 * decisions/transform-control-reparenting.
 *
 * Every doodad draws as the same gizmo, `src/gizmos/doodad.svg`, turned to face
 * the way the doodad does -- no doodad geometry is reachable. see
 * decisions/2d-rendering-with-konva.
 *
 * The gizmo is drawn art rather than code, so how a doodad looks is an SVG
 * edit. Imported rather than fetched because it is source under `src/`.
 *
 * Two things the drawing decides. The middle of the page is where the doodad is
 * -- the art is placed against its own viewBox, so moving it around the page
 * chooses the anchor and a pointer's tip may hang off one side. And the way the
 * art points, turned by `GIZMO_ROTATION`, is the way a doodad at `r = 0` points.
 */

import Konva from "konva";

import gizmoSource from "../gizmos/doodad.svg?raw";
import * as colors from "../hideout/colors.js";
import * as units from "../hideout/units.js";

// Doodad units. Large enough to hit with a mouse at a zoom that shows a whole
// hideout, small enough that adjacent placements stay distinguishable.
const SIZE = 6;

/**
 * How far the drawing is turned to face the way the game faces a doodad at
 * `r = 0`. Measured against the game, the only place the answer exists.
 *
 * A fact about the drawing, so it lives here and not in `units.js`. `apply`
 * takes it back off, so a rotation the player never touched is saved as it was
 * read. Redrawing the art pointing another way changes this number alone.
 */
const GIZMO_ROTATION = -90;

/**
 * doodad gizmo svg fill and stroke are ignored, only shape is used.
 * doodad gizmos change colors when selected or highlighted
 *
 * doodad gizmos in normal state use colors from layers.
 * see `setColor`, `hideout/colors.js`.
 *
 * `*_HIGHLIGHTED` are used when user hovers selection in sidebar. also thickens
 * the outline.
 */
const COLOR_NORMAL = "#008080";
const COLOR_SELECTED = "#C0C000";
const COLOR_HIGHLIGHTED = "#FF6000";
const OUTLINE_SELECTED = "#FFFF00";
const OUTLINE_HIGHLIGHTED = "#FFFFFF";

/** Screen pixels, see `create`. */
const STROKE = 1;
const STROKE_HIGHLIGHTED = 3;

const GIZMO = readGizmo(gizmoSource);

export function create(doodad) {
  const node = new Konva.Path({
    data: GIZMO.data,
    // Scaled to `SIZE` and offset onto the middle of its page, so that a
    // rotation turns the doodad about itself rather than swinging it around a
    // corner.
    scaleX: GIZMO.scale,
    scaleY: GIZMO.scale,
    offsetX: GIZMO.offsetX,
    offsetY: GIZMO.offsetY,
    fill: COLOR_NORMAL,
    stroke: colors.outline(COLOR_NORMAL),
    // One screen pixel at any zoom. The gizmo's own stroke width is a width in
    // the drawing, and an outline that thins out as you zoom out is not what it
    // is there for.
    strokeWidth: STROKE,
    strokeScaleEnabled: false,
    // A hideout runs to hundreds of nodes and none of them casts a shadow.
    perfectDrawEnabled: false,
    shadowForStrokeEnabled: false,
  });
  node.getSelfRect = gizmoSelfRect;
  node.doodad = doodad;
  node.color = COLOR_NORMAL;
  node.outline = colors.outline(COLOR_NORMAL);
  node.selected = false;
  node.highlighted = false;
  place(node);
  return node;
}

/**
 * How far the gizmo reaches on its own page.
 *
 * `Konva.Path` walks the path data and samples every curve at a hundred points,
 * and keeps no answer -- while the box measures every selected doodad on every
 * frame of a pan and the rubber band every doodad on every frame of a sweep.
 * see issues/0041.
 *
 * Every doodad is the same drawing, so it is measured once at import and
 * `getClientRect` is left with the transform, which differs per doodad.
 */
function gizmoSelfRect() {
  return GIZMO.rect;
}

/**
 * Node back to doodad, then doodad back to node.
 *
 * The second half snaps a drag to the grid: the file's coordinates are integers
 * and its rotations 1/65536 of a turn, so writing the recorded value back is
 * both the snap and the guarantee that what is drawn is what is saved.
 */
export function apply(node) {
  const position = units.fromStage(node.position());
  node.doodad.x = position.x;
  node.doodad.y = position.y;
  node.doodad.r = units.fromDegrees(node.rotation() - GIZMO_ROTATION);
  place(node);
}

/**
 * The node drawn exactly as its doodad says, in every attribute a doodad has an
 * opinion about -- which is where, which way, and nothing else.
 *
 * The scale and the skew are here because a doodad has neither, and something
 * that puts one on a node has to be undone somewhere. `apply` is the end of it.
 */
export function place(node) {
  node.position(units.toStage(node.doodad));
  node.rotation(facing(node.doodad));
  undistort(node);
}

/**
 * The scale and the shear off a node, keeping where it is and which way it
 * faces.
 *
 * `Konva.Transformer` writes a resize by decomposing a matrix, and a matrix
 * that scales a turned node unevenly is a shear, so `decompose` hands back
 * `skewX`. A doodad has no shear, and left on it compounds -- the next step
 * decomposes a matrix already carrying it.
 */
export function undistort(node) {
  node.scale({ x: GIZMO.scale, y: GIZMO.scale });
  node.skew({ x: 0, y: 0 });
}

/** The way the gizmo has to be turned to face the way the doodad faces. */
function facing(doodad) {
  return units.toDegrees(doodad.r) + GIZMO_ROTATION;
}

/**
 * Everything a resize did to a node except where it put it.
 *
 * Stretching a selection moves doodads apart and nothing else (see
 * issues/0038), so the scale and shear come off and the rotation goes back to
 * the doodad's. The rotation is in here because the decomposition producing the
 * shear also turns the node a little; turning is the rotate handle's job.
 */
export function unscale(node) {
  undistort(node);
  node.rotation(facing(node.doodad));
}

/**
 * The colour a node wears at rest, which is its layer's -- see `scene.js`, which
 * reads it off the document.
 *
 * The outline is worked out here and kept rather than at every paint: a paint
 * happens per node on every selection change.
 *
 * A node already wearing the colour is left alone, so telling every node its
 * layer's colour costs nothing for the layers that did not change.
 */
export function setColor(node, color) {
  if (node.color === color) return;

  node.color = color;
  node.outline = colors.outline(color);
  paint(node);
}

export function setSelected(node, selected) {
  node.selected = selected;
  paint(node);
}

/** The one doodad the sidebar is pointing at. See `state.hoveredDoodad`. */
export function setHighlighted(node, highlighted) {
  node.highlighted = highlighted;
  paint(node);
}

/**
 * A node is in one of three states, and the two flags are kept on it rather
 * than each setter writing the colour it knows about: the states overlap, and
 * two setters writing one attribute means whichever ran last wins.
 *
 * Highlighted wins, a highlight that lost never being seen.
 */
function paint(node) {
  if (node.highlighted) {
    node.fill(COLOR_HIGHLIGHTED);
    node.stroke(OUTLINE_HIGHLIGHTED);
    node.strokeWidth(STROKE_HIGHLIGHTED);
    return;
  }

  node.fill(node.selected ? COLOR_SELECTED : node.color);
  node.stroke(node.selected ? OUTLINE_SELECTED : node.outline);
  node.strokeWidth(STROKE);
}

/**
 * The rectangle every node of a collection fits in, in doodad units.
 *
 * Taken from the centres, so a rotated doodad reaches a little past it. Its
 * callers frame the view; none of them measures anything.
 */
export function boundingRectangle(nodes) {
  if (nodes.length === 0) return null;

  const half = SIZE / 2;
  const positions = nodes.map((node) => node.position());
  const left = Math.min(...positions.map((position) => position.x)) - half;
  const top = Math.min(...positions.map((position) => position.y)) - half;
  return {
    x: left,
    y: top,
    width: Math.max(...positions.map((position) => position.x)) + half - left,
    height: Math.max(...positions.map((position) => position.y)) + half - top,
  };
}

/**
 * The gizmo as Konva needs it: one path, the scale that takes its page to
 * `SIZE` doodad units, and the offset that puts the middle of that page on the
 * node's origin.
 *
 * Several paths are joined into one rather than becoming several nodes: path
 * data concatenates, and one node per doodad is one node to colour, hit test
 * and hand the transformer.
 *
 * Only path data and the page are read, so a `transform` is refused rather than
 * quietly dropped -- a drawing program writes one whenever the art is moved.
 * Flatten it into the path.
 */
function readGizmo(source) {
  const viewBox = source.match(/\bviewBox="([^"]+)"/);
  if (!viewBox) throw new Error("gizmo has no viewBox");
  if (/\btransform="/.test(source)) {
    throw new Error(
      "gizmo has a transform, which is not applied; flatten it into the path",
    );
  }

  const [left, top, width, height] = viewBox[1].trim().split(/\s+/).map(Number);
  const paths = [...source.matchAll(/\bd="([^"]+)"/g)].map((match) => match[1]);
  if (paths.length === 0) throw new Error("gizmo has no path");

  const data = paths.join(" ");
  return {
    data,
    // The one measurement of the drawing every node then shares, see
    // `gizmoSelfRect`. A throwaway node because parsing path data is what
    // `Konva.Path` is for.
    rect: new Konva.Path({ data }).getSelfRect(),
    scale: SIZE / Math.max(width, height),
    offsetX: left + width / 2,
    offsetY: top + height / 2,
  };
}
