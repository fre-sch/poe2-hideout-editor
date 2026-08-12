/**
 * What the loaded file says about itself, and which outline to draw under it.
 *
 * The name shown is the game data's name for the file's `hideout_hash`, in the
 * document's language -- wiki issue 0021. The file's own `hideout_name` is what
 * is shown when no table names the hash, and it is what is saved either way:
 * the header is passed through verbatim, which is wiki issue 0009.
 *
 * The hideout type is a viewport setting. Changing it changes the outline and
 * nothing else.
 */

import { useEffect } from "preact/hooks";

import * as hideouts from "../hideout/hideouts.js";
import * as project from "../hideout/project.js";
import * as state from "../state.js";
import * as table from "./table.js";

/**
 * Where the count stops being green and stops being yellow, as fractions of the
 * Doodad Limit -- 525 and 675 of 750. Fractions rather than the numbers
 * themselves, so that a limit corrected in one place stays corrected here.
 */
const CAUTION = 0.7;
const DANGER = 0.9;

export default function Hideout() {
  const document_ = state.hideoutDocument.value;

  useEffect(() => {
    if (document_) table.loadHideouts(document_);
  }, [document_]);

  if (document_ === null) return null;

  const header = document_.header;
  return (
    <details class="sidebar-item">
      <summary>
        Hideout
        <span class="details-summary-extra">
          &nbsp;
          <span class="text-body">{displayName(header)}</span>
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
        <div>{displayName(header)}</div>
        <div class="text-secondary">Outline:</div>
        <div>
          <TypeSelect />
        </div>
        <div class="text-secondary">Doodads:</div>
        <div>
          <DoodadCount />
        </div>
      </div>
      <TableError />
    </details>
  );
}

/** The table's name for the file's type, or the file's own until it arrives. */
function displayName(header) {
  return hideouts.nameFor(
    table.hideouts.value,
    header.hideout_hash,
    header.hideout_name,
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
 * Every hideout type the game has, and the file's own first where the data
 * knows nothing about its hash -- wiki issue 0007. The list comes from the
 * file's type and stays put while the player looks at other outlines, so
 * returning to the hideout they actually own is the same gesture as leaving it.
 */
function TypeSelect() {
  const header = state.hideoutDocument.value.header;
  const options = hideouts.optionsFor(
    table.hideouts.value,
    header.hideout_hash,
    header.hideout_name,
  );
  return (
    <select
      class="form-select form-select-sm"
      value={state.hideoutType.value}
      onChange={select}
    >
      {options.map((option) => (
        <option value={option.hash}>{label(option)}</option>
      ))}
    </select>
  );
}

/**
 * The three things an entry can be, which the player has to be able to tell
 * apart: a type with an outline, a type nobody has traced yet -- 76 of the 83 --
 * and a hash no table names at all, which is named by the file and by nothing
 * else. The last says which hash, since that is all there is to report with.
 */
function label(option) {
  if (option.unknown) return `${option.name} (unknown hash ${option.hash})`;
  if (option.file) return option.name;
  return `${option.name} (no outline)`;
}

/**
 * A missing hideout table leaves the dropdown holding one entry, which is a
 * gap worth a sentence rather than a silence.
 */
function TableError() {
  if (table.hideoutsError.value === null) return null;
  return (
    <p class="text-danger mt-2 mb-0">{`${table.hideoutsError.value.message}`}</p>
  );
}

function select(event) {
  state.hideoutType.value = event.currentTarget.value;
  event.currentTarget.blur();
}
