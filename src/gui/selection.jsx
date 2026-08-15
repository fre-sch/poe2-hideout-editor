/**
 * What is selected, and the two things about it that only the sidebar can show.
 *
 * Not a list of names, which the viewport already shows where the player is
 * looking (see issues/0023): a variation and a mirror are invisible out there,
 * every doodad drawing as the same gizmo, so a row here is the only place
 * either can be read or changed. see issues/0042.
 *
 * Twenty rows at most -- a band across a hideout selects hundreds, and the
 * count on the tab says how many there really are.
 *
 * Drawn only when something is selected, its tab disabled otherwise. see
 * `tabs.jsx`.
 */

import { useEffect } from "preact/hooks";

import * as state from "../state.js";
import * as variation from "../hideout/variation.js";
import { table, loadTable, nameOf, variationsOf } from "../table.js";
import { UnknownHashMark } from "./buttons.jsx";

const LIMIT = 20;

export default function Selection() {
  const selected = state.selection.value;
  const document_ = state.hideoutDocument.value;

  // The variation count is the table's answer, and a player editing a selection
  // may never have opened the palette -- so the section loads it for itself. Once
  // there is something selected, and not on every load: it is a 200kB file per
  // language, and looking at a hideout is not asking about it.
  // The language is a dependency because a switch is what makes the loaded
  // table the wrong one, and the document does not change with it.
  const anySelected = selected.length > 0;
  const language = state.language.value;
  useEffect(() => {
    if (document_ && anySelected) loadTable(document_);
  }, [document_, anySelected, language]);

  // The pointer can leave a row by the row being taken away -- the tab switched,
  // the selection dropped -- and `mouseleave` is not fired for that. Nothing
  // else would ever put the highlight back.
  useEffect(() => () => (state.hoveredDoodad.value = null), []);

  return (
    <>
      <ul class="selection-list list-unstyled mb-0">
        {selected.slice(0, LIMIT).map((doodad) => (
          <Row doodad={doodad} fv={doodad.fv} />
        ))}
      </ul>
      {selected.length > LIMIT && (
        <p class="selection-more">
          plus {selected.length - LIMIT} more doodads
        </p>
      )}
    </>
  );
}

/**
 * `fv` is passed as well as the doodad it came off, and it has to be.
 *
 * A component that reads a signal gets a `shouldComponentUpdate` from
 * `@preact/signals` which skips the render when no prop changed by reference and
 * none of the signals it read has changed. `VariationButton` reads the table, so
 * it is such a component -- and editing a doodad changes neither of those things:
 * the field is mutated inside an object the row already holds. Republishing the
 * selection therefore redrew the section's count and not one row of it.
 *
 * So a row is a function of the value it draws. The doodad is what the buttons
 * edit, `fv` is what they show, and the two are separate arguments because the
 * renderer can only see one of them.
 */
function Row({ doodad, fv }) {
  return (
    <li
      class="selection-row"
      onMouseEnter={() => (state.hoveredDoodad.value = doodad)}
      onMouseLeave={() => (state.hoveredDoodad.value = null)}
    >
      <Name doodad={doodad} />
      <VariationButton doodad={doodad} fv={fv} />
      <MirrorButton doodad={doodad} fv={fv} />
    </li>
  );
}

/**
 * The table's name for the doodad, or the file's until the table arrives and
 * for a hash it does not know, marked where it is the second. see issues/0059,
 * issues/0060. Its own component so both follow the table without the row's
 * buttons being redrawn with them.
 */
function Name({ doodad }) {
  const name = nameOf(doodad);
  return (
    <>
      <span class="selection-name" title={name}>
        {name}
      </span>
      <UnknownHashMark doodad={doodad} />
    </>
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
function VariationButton({ doodad, fv }) {
  const count = variationsOf(doodad);
  return (
    <button
      type="button"
      class="btn btn-sm btn-outline-secondary"
      disabled={count < 2}
      title={variationTitle(count)}
      onClick={() => cycleVariation(doodad, count)}
    >
      {variation.ordinal(fv)}
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
function MirrorButton({ doodad, fv }) {
  const mirrored = variation.mirrored(fv);
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
