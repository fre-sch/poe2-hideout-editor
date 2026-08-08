/**
 * Edit mode, and what the viewport draws besides the doodads.
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
      {/* Side by side: three icon buttons and two short labels fit the
          sidebar's width, and the height belongs to the layer list. */}
      <div class="d-flex gap-2 align-items-start">
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
        <div>
          <Flag id="show-labels" flag={state.showLabels} label="Show labels" />
          <Flag id="show-grid" flag={state.showGrid} label="Show grid" />
        </div>
      </div>
    </details>
  );
}

/**
 * A checkbox over a signal. The signals here remember themselves, so a toggle
 * is the whole of it -- see `state.js`.
 */
function Flag({ id, flag, label }) {
  return (
    <div class="form-check">
      <input
        id={id}
        class="form-check-input"
        type="checkbox"
        checked={flag.value}
        onChange={(event) => {
          flag.value = event.currentTarget.checked;
        }}
      />
      <label class="form-check-label" for={id}>
        {label}
      </label>
    </div>
  );
}

function active(mode) {
  return state.viewportMode.value === mode ? "active" : "";
}
