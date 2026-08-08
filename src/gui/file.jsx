/**
 * Loading and saving a `.hideout` file.
 *
 * Saving serializes the document, so it neither forces a mode change nor goes
 * through a `CustomEvent` to reach the viewport -- the two halves of wiki issue
 * 0005. What is on the canvas and what is in the file are the same doodads.
 */

import * as state from "../state.js";
import { HideoutDocument } from "../hideout/model.js";

export default function File() {
  return (
    <details class="sidebar-item" open>
      <summary>File</summary>
      <label class="btn btn-primary btn-sm me-2" role="button">
        Load
        <input type="file" accept=".hideout" hidden onChange={load} />
      </label>
      <button
        type="button"
        class="btn btn-primary btn-sm"
        disabled={state.hideoutDocument.value === null}
        onClick={save}
      >
        Save
      </button>
      <LoadError />
    </details>
  );
}

/**
 * A file the parser rejects says so, and says where. Silence was the rest of
 * wiki issue 0002: the parser stopped hanging the tab, but nothing told the
 * player why nothing had loaded.
 */
function LoadError() {
  if (state.loadError.value === null) return null;
  return (
    <p class="text-danger mt-2 mb-0">{`${state.loadError.value.message}`}</p>
  );
}

async function load(event) {
  const [file] = event.target.files;
  // The same file twice in a row is a real thing to want, and without this the
  // input reports no change the second time.
  event.target.value = "";
  if (!file) return;

  try {
    const hideout = HideoutDocument.fromText(await file.text());
    state.hideoutDocument.value = hideout;
    state.fileName.value = file.name;
    state.hideoutType.value = hideout.header.hideout_hash;
    state.doodadCount.value = hideout.doodads.length;
    state.loadError.value = null;
  } catch (error) {
    state.loadError.value = error;
  }
}

function save() {
  const hideout = state.hideoutDocument.value;
  const blob = new Blob([hideout.toText()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = state.fileName.value || "export.hideout";
  anchor.click();
  URL.revokeObjectURL(url);
}
