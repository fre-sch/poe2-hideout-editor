/**
 * What the loaded file says about itself, and which outline to draw under it.
 *
 * The hideout type is a viewport setting. Changing it changes the outline and
 * nothing else -- `hideout_name` and `hideout_hash` are saved exactly as they
 * were read, which is what wiki issue 0009 is about.
 */

import * as bounds from "../hideout/bounds.js";
import * as state from "../state.js";

export default function Hideout() {
  if (state.hideoutDocument.value === null) return null;

  const header = state.hideoutDocument.value.header;
  return (
    <details class="sidebar-item" open>
      <summary>Hideout</summary>
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
        <div>{state.doodadCount.value}</div>
      </div>
    </details>
  );
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
