/**
 * Domain doodads to Konva nodes, and back.
 *
 * A node holds a reference to its domain doodad and nothing else; the array in
 * `HideoutDocument` stays the source of truth. Nothing ever re-parents a node,
 * so a doodad cannot be in two collections at once -- which is the whole of
 * wiki issues 0001 and 0005, see wiki/decisions/transform-control-reparenting.
 *
 * The drawing is a flat square with a line marking which way the doodad faces.
 * That is not a downgrade from the 3D editor: there it was one shared, textureless
 * box in one of two colours, and no doodad geometry is reachable -- see
 * wiki/decisions/2d-rendering-with-konva.md.
 */

import Konva from "konva";

import * as units from "../hideout/units.js";

// Doodad units. Large enough to hit with a mouse at a zoom that shows a whole
// hideout, small enough that adjacent placements stay distinguishable.
const SIZE = 6;
const COLOR_NORMAL = "#008080";
const COLOR_SELECTED = "#C0C000";
const OUTLINE = "#00FFFF";
const OUTLINE_SELECTED = "#FFFF00";

export function create(doodad) {
  const node = new Konva.Shape({
    sceneFunc: draw,
    // A custom `sceneFunc` tells Konva how to paint but not how big the result
    // is, and `getClientRect` -- which the rubber band hit test and the
    // transformer's box both go through -- reads `width` and `height`. The
    // offset puts the node's own origin at its centre, so a rotation turns the
    // doodad about itself.
    width: SIZE,
    height: SIZE,
    offsetX: SIZE / 2,
    offsetY: SIZE / 2,
    fill: COLOR_NORMAL,
    stroke: OUTLINE,
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
  node.doodad.r = units.fromDegrees(node.rotation());
  place(node);
}

export function place(node) {
  node.position(units.toStage(node.doodad));
  node.rotation(units.toDegrees(node.doodad.r));
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

function draw(context, shape) {
  const width = shape.width();
  const height = shape.height();
  context.beginPath();
  context.rect(0, 0, width, height);
  // The rotation indicator, from the centre out to the facing edge.
  context.moveTo(width / 2, height / 2);
  context.lineTo(width, height / 2);
  context.fillStrokeShape(shape);
}
