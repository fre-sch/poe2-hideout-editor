/**
 * Edit mode, and whether labels show.
 *
 * The mode signal is the only thing that decides the mode. The 3D editor also
 * set it from the save path, which is how saving could leave the sidebar
 * showing one mode and the viewport in another -- wiki issue 0005.
 */

import * as state from "../state.js";

const MODES = [
  { mode: "select", title: "Select", icon: "bi-cursor-fill", key: "1" },
  { mode: "translate", title: "Move", icon: "bi-arrows-move", key: "2" },
  { mode: "rotate", title: "Rotate", icon: "bi-arrow-repeat", key: "3" },
];

export default function Mode() {
  return (
    <details class="sidebar-item" open>
      <summary>Edit mode</summary>
      <div class="btn-group">
        {MODES.map((entry) => (
          <button
            type="button"
            class={`btn btn-primary ${active(entry.mode)}`}
            title={`${entry.title} (${entry.key})`}
            onClick={() => {
              state.viewportMode.value = entry.mode;
            }}
          >
            <i class={`bi ${entry.icon}`}></i>
          </button>
        ))}
      </div>
      <div class="form-check mt-2">
        <input
          id="show-labels"
          class="form-check-input"
          type="checkbox"
          checked={state.showLabels.value}
          onChange={(event) => {
            state.showLabels.value = event.currentTarget.checked;
          }}
        />
        <label class="form-check-label" for="show-labels">
          Show labels
        </label>
      </div>
    </details>
  );
}

function active(mode) {
  return state.viewportMode.value === mode ? "active" : "";
}
