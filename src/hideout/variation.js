/**
 * The two things a doodad's `fv` field says: which of its art files it is drawn
 * as, and whether it is reflected.
 *
 * A variation index in the low seven bits, a mirror flag in bit seven -- see
 * wiki/specifications/hideout-file-format.md, which is also where the evidence
 * for that split is. `maraketh_chest_variations_and_flips.hideout` places all
 * twelve of one doodad's variations, unmirrored and mirrored, and reads
 * `0..11` and `128..139`.
 *
 * A module of its own beside `units.js`, and for its reasons: it is arithmetic
 * the file format decides, it is asked in more than one place, and there is no
 * browser in it.
 *
 * Nothing here draws. Every doodad is the same gizmo whatever its `fv` says --
 * wiki/decisions/2d-rendering-with-konva.md -- so a variation is a number the
 * sidebar shows and the file carries, and the viewport never hears about it.
 */

const MIRROR = 0x80;
const INDEX = 0x7f;

/** The variation index, counting from zero, the way the file holds it. */
export function of(fv) {
  return fv & INDEX;
}

/**
 * The variation a player reads, counting from one.
 *
 * Twelve variations read 1 to 12, which is what the palette's `(12)` counts, and
 * the one place the two ways of counting meet.
 */
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
 * The next variation of `count`, wrapping round to the first.
 *
 * Wrapping is what makes one button enough, and it is the way back as well as
 * the way on: there is no undo in the editor, and a player who cycled past what
 * they wanted keeps clicking. A count of one has nowhere to go, and a count of
 * none -- a doodad no table knows -- is that, not an error.
 */
export function next(fv, count) {
  if (!count || count < 2) return fv;
  return withIndex(fv, (of(fv) + 1) % count);
}
