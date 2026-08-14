/**
 * What the loaded file says about itself, and what of that the player may
 * change.
 *
 * The name shown is the game data's name for the file's `hideout_hash`, in the
 * document's language -- wiki issue 0021. The file's own `hideout_name` is what
 * is shown when no table names the hash.
 *
 * The hideout type is the document's: choosing one writes `hideout_hash` and
 * the name that follows it, and the outline the viewport draws follows the hash
 * -- wiki issue 0061. Passing the header through verbatim, wiki issue 0009, is
 * what a load and a save do; it never promised the type cannot be changed.
 *
 * The language is the document's too: it is exported, and switching it is how a
 * player reads a hideout somebody else exported in their own words --
 * wiki issue 0053. What it changes is which tables are read; the names in the
 * document are left exactly as they arrived.
 */

import { useEffect } from "preact/hooks";

import * as hideouts from "../hideout/hideouts.js";
import * as languages from "../hideout/languages.js";
import * as project from "../hideout/project.js";
import * as state from "../state.js";
import * as table from "../table.js";

/**
 * Where the count stops being green and stops being yellow, as fractions of the
 * Doodad Limit -- 525 and 675 of 750. Fractions rather than the numbers
 * themselves, so that a limit corrected in one place stays corrected here.
 */
const CAUTION = 0.7;
const DANGER = 0.9;

export default function Hideout() {
  const document_ = state.hideoutDocument.value;
  const language = state.language.value;

  // The hideout table is the language's, so a switch asks for another one.
  useEffect(() => {
    if (document_) table.loadHideouts(document_);
  }, [document_, language]);
  // The manifest is the selector's list, and one file for the whole session.
  useEffect(() => {
    if (document_) table.loadLanguages();
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
        <div>
          <LanguageSelect />
        </div>
        <div class="text-secondary">Name:</div>
        <div>{displayName(header)}</div>
        <div class="text-secondary">Type:</div>
        <div>
          <TypeSelect />
        </div>
        <div class="text-secondary">Doodads:</div>
        <div>
          <DoodadCount />
        </div>
      </div>
      <LanguageNote />
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
 * knows nothing about its hash -- wiki issue 0007. The list comes from the type
 * the file arrived as and stays put whatever is chosen, so returning to the
 * hideout they actually own is the same gesture as leaving it.
 */
function TypeSelect() {
  const fileType = state.fileType.value;
  const options = hideouts.optionsFor(
    table.hideouts.value,
    fileType.hash,
    fileType.name,
  );
  return (
    <select
      class="form-select form-select-sm"
      value={state.hideoutType.value}
      onChange={selectType}
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
 * Every language there are tables for, and the document's own first where the
 * manifest does not list it -- `TypeSelect`'s reasoning, applied to a word
 * instead of a hash: a file naming a language the editor has never heard of
 * must still show what it says it is, and must be able to come back to it.
 */
function LanguageSelect() {
  const options = languages.optionsFor(
    table.languages.value,
    state.language.value,
  );
  return (
    <select
      class="form-select form-select-sm"
      value={state.language.value}
      onChange={switchLanguage}
    >
      {options.map((option) => (
        <option value={option.language}>{languageLabel(option)}</option>
      ))}
    </select>
  );
}

/**
 * A language with tables behind it reads as itself. The two that do not are
 * the document's own where the manifest does not list it -- no tables at all,
 * so nothing can be named -- and the seven whose header spelling nobody has
 * seen a client write.
 */
function languageLabel(option) {
  if (option.unknown) return `${option.language} (no tables)`;
  if (option.spelling === languages.ASSUMED) {
    return `${option.language} (spelling assumed)`;
  }
  return option.language;
}

/**
 * What "assumed" costs, said where a player has just chosen one. Not a warning:
 * the game ignores the field, and reading a hideout in Japanese is exactly what
 * this selector is for. What it costs is the file's next reader -- this editor
 * among them -- picking its tables by a word no client may write.
 */
function LanguageNote() {
  const chosen = state.language.value;
  if (!languages.assumed(table.languages.value, chosen)) return null;
  return (
    <p class="text-secondary mt-2 mb-0">
      No file this editor has measured spells its language '{chosen}', so the
      word saved is the game data exporter's. The game ignores it; an editor
      reading the file back picks its tables by it.
    </p>
  );
}

/**
 * A missing table leaves a dropdown holding one entry, which is a gap worth a
 * sentence rather than a silence. Two dropdowns, two files, and a player who
 * has lost both is told so twice -- they are separate fetches and one can fail
 * without the other.
 */
function TableError() {
  return (
    <>
      <Complaint error={table.hideoutsError.value} />
      <Complaint error={table.languagesError.value} />
    </>
  );
}

function Complaint({ error }) {
  if (error === null) return null;
  return <p class="text-danger mt-2 mb-0">{`${error.message}`}</p>;
}

function selectType(event) {
  state.switchHideoutType(
    hideouts.headerFor(
      table.hideouts.value,
      event.currentTarget.value,
      state.fileType.value,
    ),
  );
  event.currentTarget.blur();
}

function switchLanguage(event) {
  state.switchLanguage(event.currentTarget.value);
  event.currentTarget.blur();
}
