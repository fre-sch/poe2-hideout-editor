/**
 * What is selected, and the two things about it that only the sidebar can show.
 *
 * There was a Selection section before and it was deleted, as a list of names
 * the viewport already showed in the place the player was looking -- wiki issue
 * 0023. This one is not a list of names: a variation and a mirror are invisible
 * in the viewport, because every doodad draws as the same gizmo, so a row here is
 * the only place either can be read or changed. Wiki issue 0042.
 *
 * Twenty rows at most. A band across a hideout selects hundreds, and the
 * twenty-first row is not what the player is looking at; the count in the summary
 * is what says how many there really are.
 */

import { useEffect } from "preact/hooks";

import * as state from "../state.js";
import * as variation from "../hideout/variation.js";
import { table, loadTable, variationsOf } from "./table.js";

const LIMIT = 20;

export default function Selection() {
  const selected = state.selection.value;
  const document_ = state.hideoutDocument.value;

  // The variation count is the table's answer, and a player editing a selection
  // may never have opened the palette -- so the section loads it for itself. Once
  // there is something selected, and not on every load: it is a 200kB file per
  // language, and looking at a hideout is not asking about it.
  const anySelected = selected.length > 0;
  useEffect(() => {
    if (document_ && anySelected) loadTable(document_);
  }, [document_, anySelected]);

  if (selected.length === 0) return null;
  return (
    <details class="sidebar-item" open>
      <summary>Selection ({selected.length})</summary>
      <ul class="selection-list list-unstyled mb-0">
        {selected.slice(0, LIMIT).map((doodad) => (
          <Row doodad={doodad} />
        ))}
      </ul>
      {selected.length > LIMIT && (
        <p class="text-secondary mb-0">
          plus {selected.length - LIMIT} more doodads
        </p>
      )}
    </details>
  );
}

function Row({ doodad }) {
  return (
    <li class="selection-row">
      <span class="selection-name" title={doodad.name}>
        {doodad.name}
      </span>
      <VariationButton doodad={doodad} />
      <MirrorButton doodad={doodad} />
    </li>
  );
}

/**
 * The variation, counting from one, and one click on to the next of them.
 *
 * A count of one has nothing to choose and a count of none is a doodad the table
 * does not know -- an essential the game places itself. Both show the number and
 * refuse to cycle it, which is the honest answer to "what is this one": the file
 * says a variation whatever the editor knows about it.
 */
function VariationButton({ doodad }) {
  const count = variationsOf(doodad);
  return (
    <button
      type="button"
      class="btn btn-sm btn-outline-secondary"
      disabled={count < 2}
      title={variationTitle(count)}
      onClick={() => cycleVariation(doodad, count)}
    >
      {variation.ordinal(doodad.fv)}
    </button>
  );
}

function variationTitle(count) {
  if (count > 1) return `Variation, one of ${count}. Click for the next one.`;
  if (count === 1) return "This doodad has one variation.";
  if (table.value === null) return "Reading the doodad table...";
  return "The doodad table does not know this one, so its variations are unknown.";
}

function cycleVariation(doodad, count) {
  doodad.fv = variation.next(doodad.fv, count);
  state.selectionChanged();
}

/**
 * Mirrored or not, and a click to change it.
 *
 * Offered whatever the table knows, being a bit rather than an index into
 * anything. The button reads as pressed when it is on, so the state is the
 * button's own look and not a second thing to read.
 */
function MirrorButton({ doodad }) {
  const mirrored = variation.mirrored(doodad.fv);
  return (
    <button
      type="button"
      class={`btn btn-sm ${mirrored ? "btn-primary" : "btn-outline-secondary"}`}
      aria-pressed={mirrored}
      title={mirrored ? "Mirrored. Click to unmirror." : "Click to mirror."}
      onClick={() => toggleMirror(doodad)}
    >
      <i class="bi bi-symmetry-vertical"></i>
    </button>
  );
}

function toggleMirror(doodad) {
  doodad.fv = variation.mirrorToggled(doodad.fv);
  state.selectionChanged();
}
