/**
 * Between the units a `.hideout` stores and the units a 2D stage draws in:
 * game units to pixels and degrees.
 *
 * Both directions live here and only here, which is what makes a
 * load-edit-save round trip checkable.
 */

// A full turn of the doodad `r` field, a 16-bit binary angle.
// see specifications/hideout-file-format.
export const TURN = 65536;

// The game counts `r` the other way round from the stage.
// see specifications/game-facts, "Placement and geometry".
const SENSE = -1;

export function toDegrees(rotation) {
  // `+ 0` keeps -0 from surfacing
  return (SENSE * rotation * 360) / TURN + 0;
}

/** back to file units, wrapped into `0..TURN-1`. an anticlockwise drag reaches
 *  a negative angle, which the double modulo normalises. */
export function fromDegrees(degrees) {
  const rotation = Math.round((SENSE * degrees * TURN) / 360);
  return ((rotation % TURN) + TURN) % TURN;
}

/**
 * Position, file to stage: the axes swap, nothing else.
 *
 * Matches the bounds SVGs, drawn with svg `x` from doodad `y` and svg `y` from
 * doodad `x` -- the convention every tool in `scripts/` writes. SVG and Konva
 * share y-down pixel space, so a bounds trace lands on its own outline. Any
 * further flip or rotation takes it off.
 *
 * The swap carries no rotation sense: it is a reflection, and canvas y pointing
 * down is a second one, so the two cancel. `SENSE` is the game's own
 * convention, which only the game can answer.
 *
 * The offset that remains belongs to the drawing, not to these units --
 * `GIZMO_ROTATION` in `src/viewport/doodads.js`.
 */
export function toStage({ x, y }) {
  return { x: y, y: x };
}

// Its own inverse. Rounded onto the file's integer grid.
export function fromStage(point) {
  const { x, y } = fromStageExact(point);
  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * The same swap without the rounding, for geometry that is not a doodad.
 *
 * A generator's box is unrounded, and the rounding happens once where a
 * `Doodad` is created -- rounding the box too would drift an array's centre on
 * every drag step. see decisions/array-placement.
 */
export function fromStageExact({ x, y }) {
  return { x: y, y: x };
}
