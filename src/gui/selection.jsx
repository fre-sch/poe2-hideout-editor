/**
 * What is selected, by name.
 *
 * The list is capped. A rubber band across a hideout selects hundreds of
 * doodads, and several hundred list items say nothing the count does not.
 */

import * as state from "../state.js";

const LIMIT = 50;

export default function Selection() {
  const selected = state.selection.value;
  return (
    <details
      class="sidebar-item"
      style="max-height: 12rem; overflow: auto"
      open
    >
      <summary>Selection ({selected.length})</summary>
      <ul>
        {selected.slice(0, LIMIT).map((doodad) => (
          <li>{doodad.name}</li>
        ))}
      </ul>
      {selected.length > LIMIT && (
        <p class="text-secondary mb-0">and {selected.length - LIMIT} more</p>
      )}
    </details>
  );
}
