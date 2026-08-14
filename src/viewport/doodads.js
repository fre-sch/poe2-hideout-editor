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
import * as colors from "../hideout/colors.js";
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
 *
 * **A doodad at rest wears its layer's colour**, which is what makes the layers
 * readable off the canvas -- `setColor`, and `hideout/colors.js` for where the
 * colours come from. The other two states are the editor's own and are the same
 * whatever layer they happen in: they say what the player is doing right now,
 * and a state that a layer colour could out-shout is a state that cannot be
 * seen. `COLOR_NORMAL` is what a node wears until it is told, which is the
 * moment between being built and being put in its group.
 *
 * The highlighted colours are for the one doodad the sidebar is pointing at, and
 * they are the loudest of the three. It is looked for in a field of selected
 * doodads that all draw as the same gizmo, so the difference has to carry across
 * a whole hideout at a glance -- which is also why it is the one state that
 * thickens the outline.
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
 * `Konva.Path` works this out by walking the path data and sampling every curve
 * at a hundred points, and it does not keep the answer. Everything that measures
 * a node asks for it: the box measures every selected doodad on every frame of a
 * pan, and the rubber band measures every doodad in the hideout on every frame
 * of a sweep -- see wiki issue 0041.
 *
 * Every doodad is the same drawing, so there is one answer and it is measured
 * once, at import. What is left for `getClientRect` to do is the transform,
 * which is the part that differs per doodad.
 */
function gizmoSelfRect() {
  return GIZMO.rect;
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
 * `Konva.Transformer` writes a resize onto a node by decomposing a matrix, and
 * a matrix that scales a turned node unevenly is a shear -- so `decompose`
 * hands back `skewX` and `setAttrs` puts it on. A doodad has no shear any more
 * than it has a scale, and left on, it compounds: the next step decomposes a
 * matrix that already carries it.
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
 * Stretching a selection is a way of moving doodads apart and nothing else --
 * wiki issue 0038 -- so the scale and the shear come off and the rotation goes
 * back to the doodad's. The rotation is in here because the same decomposition
 * that produces the shear also turns the node a little to fit what is left;
 * turning is the rotate handle's job and not a side effect of spacing.
 */
export function unscale(node) {
  undistort(node);
  node.rotation(facing(node.doodad));
}

/**
 * The colour a node wears at rest, which is its layer's -- see `scene.js`, which
 * reads it off the document.
 *
 * The outline is worked out here and kept, rather than at every paint: a paint
 * happens per node on every selection change, and the colour changes when a
 * player moves a slider.
 *
 * A node already wearing the colour is left alone, so telling every node its
 * layer's colour after any layer edit costs nothing for the layers that did not
 * change.
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
 * A node is in one of three states and the two flags are kept on it, rather than
 * each setter writing the colour it knows about: they overlap -- every
 * highlighted doodad is a selected one -- and two setters writing the same
 * attribute means whichever ran last wins, which is not a rule anybody can read
 * off the code.
 *
 * Highlighted wins, because a highlight that lost would never be seen.
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
