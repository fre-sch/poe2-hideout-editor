/**
 * Domain doodads to Konva nodes, and back.
 *
 * A node holds a reference to its domain doodad and nothing else; the array in
 * `HideoutDocument` stays the source of truth. Nothing ever re-parents a node,
 * so a doodad cannot be in two collections at once -- which is the whole of
 * wiki issues 0001 and 0005, see wiki/decisions/transform-control-reparenting.
 *
 * Every doodad draws as the same gizmo, `src/gizmos/doodad.svg`, turned to face
 * the way the doodad does. That is not a downgrade from the 3D editor: there it
 * was one shared, textureless box in one of two colours, and no doodad geometry
 * is reachable -- see wiki/decisions/2d-rendering-with-konva.md.
 *
 * The gizmo is drawn art rather than code, so changing how a doodad looks means
 * editing an SVG and not this module. It is imported rather than fetched
 * because it *is* source: it lives under `src/`, and the dev server reloads on
 * a save in the drawing program.
 *
 * Two things the drawing decides, and this module obeys. **The middle of the
 * page is where the doodad is** -- the art is placed against its own viewBox,
 * not against its bounding box, so moving the art around the page is how the
 * anchor is chosen and the tip of a pointer may hang off one side. And the way
 * the art points, turned by `GIZMO_ROTATION`, is the way a doodad at `r = 0`
 * points.
 */

import Konva from "konva";

import gizmoSource from "../gizmos/doodad.svg?raw";
import * as units from "../hideout/units.js";

// Doodad units. Large enough to hit with a mouse at a zoom that shows a whole
// hideout, small enough that adjacent placements stay distinguishable.
const SIZE = 6;

/**
 * How far the drawing has to be turned to face the way the game faces a doodad
 * at `r = 0`. Measured against the game, which is the only place the answer
 * exists -- the gizmo read a quarter turn clockwise of where the game showed
 * the same doodad.
 *
 * It is a fact about the drawing, so it lives beside the drawing and not in
 * `units.js`: the file's units are unaffected, and `apply` takes it back off
 * again so that a rotation the player never touched is saved exactly as it was
 * read. Redrawing the art pointing another way changes this number and nothing
 * else.
 */
const GIZMO_ROTATION = -90;

/**
 * The gizmo's own fill and stroke are ignored: a doodad has to change colour
 * when it is selected, so the colours belong to the editor. Everything else
 * about the drawing comes from the file.
 */
const COLOR_NORMAL = "#008080";
const COLOR_SELECTED = "#C0C000";
const OUTLINE = "#00FFFF";
const OUTLINE_SELECTED = "#FFFF00";

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
    stroke: OUTLINE,
    // One screen pixel at any zoom. The gizmo's own stroke width is a width in
    // the drawing, and an outline that thins out as you zoom out is not what it
    // is there for.
    strokeWidth: 1,
    strokeScaleEnabled: false,
    // A hideout runs to hundreds of nodes and none of them casts a shadow.
    perfectDrawEnabled: false,
    shadowForStrokeEnabled: false,
  });
  node.doodad = doodad;
  place(node);
  return node;
}

/**
 * Node back to doodad, then doodad back to node.
 *
 * The second half is what snaps a drag to the grid: the file's coordinates are
 * integers and its rotations are 1/65536 of a turn, so writing the recorded
 * value back is both the snap and the guarantee that what is drawn is what will
 * be saved.
 */
export function apply(node) {
  const position = units.fromStage(node.position());
  node.doodad.x = position.x;
  node.doodad.y = position.y;
  node.doodad.r = units.fromDegrees(node.rotation() - GIZMO_ROTATION);
  place(node);
}

export function place(node) {
  node.position(units.toStage(node.doodad));
  node.rotation(units.toDegrees(node.doodad.r) + GIZMO_ROTATION);
}

export function setSelected(node, selected) {
  node.fill(selected ? COLOR_SELECTED : COLOR_NORMAL);
  node.stroke(selected ? OUTLINE_SELECTED : OUTLINE);
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
 * Several paths are joined into one rather than becoming several nodes. Path
 * data concatenates -- an `M` starts a new subpath -- and one node per doodad
 * is one node to colour, to hit test and to hand the transformer.
 *
 * Only path data and the page are read. A `transform` on a path or on the group
 * around it would be quietly left out, and the drawing would arrive somewhere
 * other than where it was drawn -- which is worth refusing to do, since a
 * drawing program will happily write one when the art is moved or turned. The
 * fix is to flatten the transform into the path, which every such program can
 * do.
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

  return {
    data: paths.join(" "),
    scale: SIZE / Math.max(width, height),
    offsetX: left + width / 2,
    offsetY: top + height / 2,
  };
}
