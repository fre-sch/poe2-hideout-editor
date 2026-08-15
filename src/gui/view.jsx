/**
 * What the viewport draws besides the doodads.
 *
 * Two toggles. There is nothing to switch between, the selection always
 * carrying its box and handles. see issues/0038.
 */

import * as state from "../state.js";

export default function View() {
  return (
    <details class="sidebar-item view-flags" open>
      <summary>View</summary>
      <Flag id="show-labels" flag={state.showLabels} label="Show labels" />
      <Flag id="show-grid" flag={state.showGrid} label="Show grid" />
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
