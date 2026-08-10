/**
 * The small shapes more than one sidebar section draws.
 *
 * Here rather than in the section that draws most of them, because the layer
 * actions bar is filled from two files -- `layers.jsx` and `arrays.jsx` -- and
 * one importing the other for a button shape would make a cycle out of a
 * borrowed detail.
 */

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
