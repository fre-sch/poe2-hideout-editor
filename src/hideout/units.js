/**
 * Conversions between the units a `.hideout` file stores and the units a 2D
 * stage draws in.
 *
 * The file's units are the game's; the stage's are pixels and degrees. Keeping
 * both directions here, and only here, is what makes a load-edit-save round
 * trip checkable.
 */

// A full turn of the doodad `r` field. It is a 16-bit binary angle, see
// wiki/specifications/hideout-file-format.md.
export const TURN = 65536;

/**
 * The game counts `r` the other way round from the stage, so the sign is part
 * of the conversion. See "Which way a turn goes" below for how that was
 * measured; both directions carry it, which is what keeps the round trip exact.
 */
const SENSE = -1;

export function toDegrees(rotation) {
  // The `+ 0` is not idle: negating zero gives -0, which equals zero under
  // every comparison but `Object.is` and prints as "-0" wherever it surfaces.
  return (SENSE * rotation * 360) / TURN + 0;
}

/**
 * Back to the file's units, wrapped into `0..TURN-1`.
 *
 * The double modulo is not redundant: `%` in JavaScript keeps the sign of its
 * left operand, so a negative angle -- which a stage rotation reaches by simply
 * being dragged anticlockwise -- would otherwise leave the range instead of
 * wrapping into it.
 */
export function fromDegrees(degrees) {
  const rotation = Math.round((SENSE * degrees * TURN) / 360);
  return ((rotation % TURN) + TURN) % TURN;
}

/**
 * Position, file to stage: the axes swap, and nothing else happens.
 *
 * Derived rather than carried over. The game's `x` and `y` index a floor grid
 * seen from above, and `scripts/probe_grid.py` -- which draws the bounds SVGs
 * the editor loads underneath a hideout -- writes SVG `x` from doodad `y` and
 * SVG `y` from doodad `x`. SVG and Konva share the same y-down pixel space, so
 * agreeing with the SVG is what puts a bounds trace on top of its own outline.
 * Any additional flip or rotation would take it off.
 *
 * The 3D editor reached the same place by three steps that cancelled -- an axis
 * swap in `hideout.module.js`, a half turn on the hideout group, and the same
 * half turn again on the bounds group -- because it was orienting a camera.
 * There is no camera here.
 *
 * ### Which way a turn goes
 *
 * Two things decide this, and only one of them can be reasoned about.
 *
 * The swap on its own is a reflection -- the matrix taking `(x, y)` to `(y, x)`
 * has determinant -1 -- and a reflection reverses the sense of a rotation. But
 * the stage is not the plane the swap lands in: canvas y points *down*, which
 * is a second reflection. Writing the screen frame as (right, up), a doodad at
 * `(x, y)` draws at `(y, -x)`, whose determinant is +1. The two cancel, so the
 * swap contributes no sign.
 *
 * What no file can say is the game's own convention -- whether `r` counts
 * clockwise or anticlockwise seen from above. That is one bit, and it is worth
 * one minus sign. It was measured the only way it can be: turn doodads in the
 * game, export, and compare against the editor. They came back mirrored, so
 * `SENSE` is -1.
 *
 * The measurement took two passes, and the first one is the instructive part.
 * A single doodad compared at a single angle showed a quarter-turn offset and
 * nothing else, because at that angle a reversed sense and an offset look
 * exactly alike. Only doodads at other angles separate them. An offset does
 * remain, but it belongs to the drawing rather than to these units, and it is
 * `GIZMO_ROTATION` in `src/viewport/doodads.js`.
 */
export function toStage({ x, y }) {
  return { x: y, y: x };
}

// Its own inverse, by construction. Rounded because a stage position is a
// float and the file's grid is integer.
export function fromStage({ x, y }) {
  return { x: Math.round(y), y: Math.round(x) };
}
