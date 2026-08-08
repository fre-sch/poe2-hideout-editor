/**
 * Loading a file, and the two ways of saving one.
 *
 * The two are the cost of having a format of the editor's own: a project keeps
 * layers and, later, generators, and a `.hideout` is what the game reads and
 * can carry neither. Which file to hand the game is the one thing a player must
 * not get wrong, so the two buttons are told apart by their labels and their
 * colours, and each says what it writes. They no longer sit apart: the sidebar
 * is short and its height belongs to the layer list.
 *
 * Loading takes both, told apart by their content rather than their name. One
 * button, because a player who has picked the file has already said which one
 * it is.
 *
 * Saving serializes the document, so it neither forces a mode change nor goes
 * through a `CustomEvent` to reach the viewport -- the two halves of wiki issue
 * 0005. What is on the canvas and what is in the file are the same doodads.
 */

import * as state from "../state.js";
import * as project from "../hideout/project.js";
import { HideoutDocument } from "../hideout/model.js";

export default function File() {
  const loaded = state.hideoutDocument.value !== null;
  return (
    <details class="sidebar-item" open>
      <summary>File</summary>
      <div class="d-flex gap-1 mb-1">
        <label class="btn btn-primary btn-sm" role="button">
          <i class="bi bi-folder2-open"></i> Load
          <input type="file" accept=".hideout,.json" hidden onChange={load} />
        </label>
        <button
          type="button"
          class="btn btn-success btn-sm"
          disabled={!loaded}
          onClick={exportHideout}
          title="The file for the game. Layers are baked away."
        >
          <i class="bi bi-box-arrow-down"></i> Export .hideout
        </button>
      </div>
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        disabled={!loaded}
        onClick={saveProject}
        title="Your work, layers and all. The game cannot read it."
      >
        <i class="bi bi-hdd"></i> Save project
      </button>
      <p class="text-secondary mt-1 mb-0">
        Load takes a `.hideout` or a saved project. Export writes the game's
        file, Save project writes the editor's.
      </p>
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
    const text = await file.text();
    const hideout = project.looksLikeProject(text)
      ? project.parse(text)
      : HideoutDocument.fromText(text);

    state.hideoutDocument.value = hideout;
    state.layers.value = [...hideout.layers];
    state.activeLayer.value = hideout.layers[0].id;
    state.fileName.value = file.name;
    state.hideoutType.value = hideout.header.hideout_hash;
    state.doodadCount.value = hideout.doodads.length;
    state.loadError.value = null;
  } catch (error) {
    state.loadError.value = error;
  }
}

function saveProject() {
  const document_ = state.hideoutDocument.value;
  download(project.serialize(document_), `${baseName()}.project.json`);
}

/**
 * The limit is checked here because here is the last moment it can be. The game
 * truncates an oversized import silently, in file order, so a player who is not
 * told now finds out by missing doodads later.
 *
 * It warns rather than refuses: the count is the editor's best reading of a
 * rule measured in game, and a player who knows better must still be able to
 * write the file.
 */
function exportHideout() {
  const document_ = state.hideoutDocument.value;
  const counted = project.count(document_);
  if (counted.exceeded && !confirm(limitWarning(counted))) return;

  download(project.bake(document_), `${baseName()}.hideout`);
}

function limitWarning(counted) {
  return (
    `This exports ${counted.placed} placed doodads, over the game's limit ` +
    `of ${counted.limit}. (${counted.essential} more are placed by the game ` +
    `itself and do not count.)\n\n` +
    `The game will import the first ${counted.limit} in file order and ` +
    `discard the rest without saying so.\n\nExport anyway?`
  );
}

/** The loaded file's name, with whichever extension it arrived under taken off. */
function baseName() {
  const name = state.fileName.value || "hideout";
  return name.replace(/(\.project)?\.(hideout|json)$/i, "");
}

function download(text, name) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
