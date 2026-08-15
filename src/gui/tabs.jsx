/**
 * The layers and the selection, in one section, one at a time.
 *
 * Both panels answer "what am I working on", so they take turns in one place
 * rather than both asking for room. see issues/0048.
 *
 * The Selection tab is drawn whether or not there is a selection: a tab that
 * came and went would move the Layers tab. Disabled, the places stay learnable
 * and the `title` says why -- the actions bar's reasoning, in `layers.jsx`.
 *
 * The section is what the sidebar's leftover height goes to.
 */

import { effect, signal } from "@preact/signals";

import * as state from "../state.js";
import Layers from "./layers.jsx";
import Selection from "./selection.jsx";

const LAYERS = "layers";
const SELECTION = "selection";

const active = signal(LAYERS);

/**
 * An empty selection puts the layers back up: there is nothing left for the
 * other panel to show.
 *
 * An effect and not a click handler, because the selection is the viewport's --
 * it is cleared by a click on the background or an Escape, neither of which
 * knows the sidebar exists. It runs on the write, before the render, so the
 * selection panel is never drawn for a selection that is already gone.
 *
 * It forgets the tab rather than restoring it on the next selection. Coming back
 * to the layers means coming back: the next band drawn across the hideout does
 * not take the panel away from the list being clicked through.
 */
effect(() => {
  if (state.selection.value.length === 0) active.value = LAYERS;
});

export default function Tabs() {
  const selected = state.selection.value.length;
  const shown = active.value;
  return (
    <div class="sidebar-item sidebar-tabs">
      <ul class="nav nav-tabs mb-2" role="tablist">
        <Tab id={LAYERS} shown={shown} label="Layers" title="The layout" />
        <Tab
          id={SELECTION}
          shown={shown}
          label={`Selection (${selected})`}
          title={selectionTitle(selected)}
          disabled={selected === 0}
        />
      </ul>
      <div class="tab-panel" role="tabpanel">
        {shown === LAYERS ? <Layers /> : <Selection />}
      </div>
    </div>
  );
}

function selectionTitle(selected) {
  if (selected === 0) return "Nothing is selected";
  return `The ${selected} selected doodads`;
}

function Tab({ id, shown, label, title, disabled }) {
  return (
    <li class="nav-item">
      <button
        type="button"
        role="tab"
        class={`nav-link ${id === shown ? "active" : ""}`}
        aria-selected={id === shown}
        disabled={disabled}
        title={title}
        onClick={() => (active.value = id)}
      >
        {label}
      </button>
    </li>
  );
}
