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
 * One of those loads and saves like any other, so the dropdown names the type
 * it cannot draw rather than silently showing someone else's outline.
 */
function TypeSelect() {
  const hash = state.hideoutType.value;
  const known = bounds.find(hash) !== undefined;
  return (
    <select class="form-select form-select-sm" value={hash} onChange={select}>
      {!known && <option value={hash}>No outline (hash {hash})</option>}
      {bounds.definitions().map((definition) => (
        <option value={definition.hash}>{definition.name}</option>
      ))}
    </select>
  );
}

function select(event) {
  state.hideoutType.value = event.currentTarget.value;
  event.currentTarget.blur();
}
