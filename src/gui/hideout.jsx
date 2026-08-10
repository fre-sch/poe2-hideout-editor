/**
 * What the loaded file says about itself, and which outline to draw under it.
 *
 * The hideout type is a viewport setting. Changing it changes the outline and
 * nothing else -- `hideout_name` and `hideout_hash` are saved exactly as they
 * were read, which is what wiki issue 0009 is about.
 */

import * as bounds from "../hideout/bounds.js";
import * as project from "../hideout/project.js";
import * as state from "../state.js";

/**
 * Where the count stops being green and stops being yellow, as fractions of the
 * Doodad Limit -- 525 and 675 of 750. Fractions rather than the numbers
 * themselves, so that a limit corrected in one place stays corrected here.
 */
const CAUTION = 0.7;
const DANGER = 0.9;

export default function Hideout() {
  if (state.hideoutDocument.value === null) return null;

  const header = state.hideoutDocument.value.header;
  return (
    <details class="sidebar-item">
      <summary>
        Hideout
        <span class="details-summary-extra">
          &nbsp;
          <span class="text-body">{header.hideout_name}</span>
          &nbsp;
          <DoodadCount />
        </span>
      </summary>
      <div class="grid-2">
        <div class="text-secondary">File:</div>
        <div style="line-break: anywhere">{state.fileName.value}</div>
        <div class="text-secondary">Version:</div>
        <div>{header.version}</div>
        <div class="text-secondary">Language:</div>
        <div>{header.language}</div>
        <div class="text-secondary">Name:</div>
        <div>{header.hideout_name}</div>
        <div class="text-secondary">Outline:</div>
        <div>
          <TypeSelect />
        </div>
        <div class="text-secondary">Doodads:</div>
        <div>
          <DoodadCount />
        </div>
      </div>
    </details>
  );
}

/**
 * The count, coloured by how much room is left under the Doodad Limit. The game
 * truncates an oversized import silently, and a number that only speaks up at
 * the export speaks up after the work is done.
 *
 * It is the document's total, so it counts the essential doodads the game
 * places itself and the limit ignores. The colour therefore turns early rather
 * than late, which is the right way round for a warning; `project.count` does
 * the exact arithmetic at the bake, where exactness is what is wanted.
 */
function DoodadCount() {
  const count = state.doodadCount.value;
  return <span class={warningOf(count)}>{count}</span>;
}

function warningOf(count) {
  if (count > project.DOODAD_LIMIT * DANGER) return "text-danger";
  if (count >= project.DOODAD_LIMIT * CAUTION) return "text-warning";
  return "text-success";
}

/**
 * Three of the game's seven hideout types have no outline yet, wiki issue 0007.
 * A file of such a type loads and saves like any other, so the dropdown carries
 * it by its own name and hash rather than silently showing someone else's
 * outline. The list comes from the file's type and stays put while the player
 * looks at other outlines, so returning to the hideout they actually own is the
 * same gesture as leaving it.
 */
function TypeSelect() {
  const header = state.hideoutDocument.value.header;
  const options = bounds.optionsFor(header.hideout_hash, header.hideout_name);
  return (
    <select
      class="form-select form-select-sm"
      value={state.hideoutType.value}
      onChange={select}
    >
      {options.map((definition) => (
        <option value={definition.hash}>{label(definition)}</option>
      ))}
    </select>
  );
}

/**
 * A type with no outline file says so, and says by which hash: its name is the
 * file's own, and may name nothing the editor has ever heard of.
 */
function label(definition) {
  if (definition.file) return definition.name;
  return `${definition.name} (no outline, hash ${definition.hash})`;
}

function select(event) {
  state.hideoutType.value = event.currentTarget.value;
  event.currentTarget.blur();
}
