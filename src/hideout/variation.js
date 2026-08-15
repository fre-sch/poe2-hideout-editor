/**
 * A doodad's `fv` field: a variation index in the low seven bits, a mirror flag
 * in bit seven. see specifications/hideout-file-format.
 *
 * Nothing here draws. Every doodad is the same gizmo whatever its `fv` says
 * (see decisions/2d-rendering-with-konva), so a variation is a number the
 * sidebar shows and the file carries.
 */

const MIRROR = 0x80;
const INDEX = 0x7f;

/** The variation index, counting from zero, the way the file holds it. */
export function of(fv) {
  return fv & INDEX;
}

/** The variation a player reads, counting from one -- what the palette's `(12)`
 *  counts. */
export function ordinal(fv) {
  return of(fv) + 1;
}

export function mirrored(fv) {
  return (fv & MIRROR) !== 0;
}

/** The same variation, reflected or not. */
export function withMirror(fv, mirror) {
  return mirror ? of(fv) | MIRROR : of(fv);
}

export function mirrorToggled(fv) {
  return withMirror(fv, !mirrored(fv));
}

/** The same mirroring, at another variation. */
export function withIndex(fv, index) {
  return withMirror(index & INDEX, mirrored(fv));
}

/**
 * The next variation of `count`, wrapping round to the first. Wrapping is what
 * makes one button enough, and the way back as well as the way on.
 *
 * A count of one has nowhere to go; a count of none is a doodad no table knows,
 * not an error.
 */
export function next(fv, count) {
  if (!count || count < 2) return fv;
  return withIndex(fv, (of(fv) + 1) % count);
}
