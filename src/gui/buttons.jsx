/**
 * The small shapes more than one sidebar section draws.
 *
 * Here rather than in the section that draws most of them, because the layer
 * actions bar is filled from two files -- `layers.jsx` and `arrays.jsx` -- and
 * one importing the other for a button shape would make a cycle out of a
 * borrowed detail. The same two files name doodads, and a mark on a name has to
 * read the same in both.
 */

import { unknownHash } from "../table.js";

/** An icon button: one slot of a bar of actions. */
export function ActionButton({
  icon,
  extra = "",
  title,
  pressed,
  disabled,
  onClick,
}) {
  return (
    <button
      type="button"
      class={`btn btn-sm btn-link ${extra}`}
      title={title}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      <i class={`bi ${icon}`}></i>
    </button>
  );
}

/**
 * How many doodads a button is about to take with it. A count and not the
 * sentence: the sentence is in the button's `title`, and a label that grows by a
 * clause rewraps its row and moves every section below it -- which is the
 * sidebar shifting under the hand that made the selection.
 */
export function SelectionBadge({ count }) {
  if (count === 0) return null;
  return <span class="badge text-bg-light ms-1">{count}</span>;
}

export const UNKNOWN_HASH_TITLE =
  "No doodad table names this hash, so the name is the one the file was " +
  "written with -- in whatever language and whatever patch that was.";

/**
 * What a name that came from the file rather than from the table is marked
 * with, wherever the sidebar names a doodad -- wiki issue 0060.
 *
 * The hash, because it is the only other identity the doodad has and the one
 * thing a player can look it up or report it by; the wording is the hideout
 * type selector's, which marks the same gap in the header's one name. Muted and
 * never a warning: nothing is wrong with the doodad, and nothing about it is
 * refused.
 *
 * It does not shrink, the name beside it does. A mark cut off by an ellipsis is
 * a mark that is read as part of the name.
 */
export function UnknownHashMark({ doodad }) {
  if (!unknownHash(doodad)) return null;
  return (
    <span class="unknown-hash" title={UNKNOWN_HASH_TITLE}>
      unknown hash {doodad.hash}
    </span>
  );
}
