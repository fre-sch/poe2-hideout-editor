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

export function toDegrees(rotation) {
  return (rotation * 360) / TURN;
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
  const rotation = Math.round((degrees * TURN) / 360);
  return ((rotation % TURN) + TURN) % TURN;
}

/**
 * Position, file to stage: the axes swap, and nothing else happens.
 *
 * Derived rather than carried over. The game's `x` and `y` index a floor grid
 * seen from above, and `scripts/converter.py` -- which draws the bounds SVGs
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
 * ### Why `toDegrees` is not negated
 *
 * The swap on its own is a reflection -- the matrix taking `(x, y)` to `(y, x)`
 * has determinant -1 -- and a reflection reverses the sense of a rotation. But
 * the stage is not the plane the swap lands in: canvas y points *down*, which
 * is a second reflection. Writing the screen frame as (right, up), a doodad at
 * `(x, y)` draws at `(y, -x)`, whose determinant is +1.
 *
 * The two reflections cancel. A turn that increases `r` therefore appears on
 * the stage in the same sense it has in the file, and `toDegrees` maps straight
 * onto Konva's clockwise-positive degrees with no sign to apply.
 *
 * What this does *not* settle is which way that looks in the game, because the
 * game's own convention -- whether `r` counts clockwise or anticlockwise seen
 * from above -- is not derivable from a file. It is one bit, it costs a minus
 * sign here if it is wrong, and it is checked the only way it can be: rotate a
 * recognisable doodad in the game, export, and compare against the editor.
 *
 * That check has been run once, and it found the editor a quarter turn out --
 * an offset, not a mirror. A reversed sense shows up as a doodad turning the
 * wrong way rather than as a constant, so this is evidence the sense agrees,
 * and it is conclusive if the same quarter turn held at more than one angle.
 * The offset itself is a fact about the drawing rather than about the units,
 * and it is corrected by `GIZMO_ROTATION` in `src/viewport/doodads.js`.
 */
export function toStage({ x, y }) {
  return { x: y, y: x };
}

// Its own inverse, by construction. Rounded because a stage position is a
// float and the file's grid is integer.
export function fromStage({ x, y }) {
  return { x: Math.round(y), y: Math.round(x) };
}
