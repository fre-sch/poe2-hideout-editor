/**
 * The doodad palette: everything that can be placed, and the button that opens
 * it.
 *
 * It is the first thing in the editor that adds a doodad rather than moving one
 * the player already had -- see wiki/decisions/doodad-palette.md.
 *
 * **It is a sidebar on the right, not a floating panel.** It was a draggable
 * panel first, and dragging it was the part nobody wanted: a panel is in the
 * way or it is somewhere else, and either way the player is moving it instead
 * of placing doodads. A column beside the viewport is never in the way, and the
 * viewport it places into is the space that is left.
 *
 * **It lives outside the viewport container.** The editor's shortcuts are bound
 * to that container, not to the window -- wiki issue 0010 -- so typing `g` into
 * the search input here cannot align the view to the game. Keeping the palette
 * out of that element is what guarantees it, and `app.jsx` is where that is
 * decided.
 *
 * **Loading a file closes it.** A new document may be in another language, which
 * invalidates the table it was loaded with; a palette that survived a load would
 * be describing the previous document. `gui/file.jsx` puts it away.
 *
 * **With an array as the active layer it sets that array's doodad instead of
 * placing one.** An array's doodads are computed, so there is nothing to place
 * into it -- but "which doodad" is exactly the question this list answers, and
 * answering it twice, once here and once from a selection, was two ways to say
 * one thing. So the palette is where a doodad is chosen, whoever is asking.
 *
 * The table itself is `table.js`, which the Selection section reads too.
 */

import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";

import * as state from "../state.js";
import { INCLUDE, EXCLUDE } from "../hideout/palette.js";
import { sourceDoodad } from "./arrays.jsx";
import { table, tableError, loadTable } from "../table.js";

/**
 * What the player is looking for. Kept across openings, because closing the
 * palette to look at the viewport is not the same as giving up on a search.
 *
 * The two filters are `Map`s of key to `INCLUDE` or `EXCLUDE` -- see
 * `hideout/palette.js`. A key not in the map is unset, so an empty map is no
 * filter rather than a filter matching nothing.
 */
const search = signal("");
const categoryFilter = signal(new Map());
const tagFilter = signal(new Map());

/**
 * The button, and the palette's name. Both follow the active layer: an array
 * takes a doodad rather than being given one, and a list that says "add" while
 * it sets is a list a player double-clicks once and then wonders about.
 */
const ADD = { title: "Add doodad", icon: "bi-plus-lg" };
const SET = { title: "Set doodad(s)", icon: "bi-pencil-square" };

function purpose() {
  return activeArray() === null ? ADD : SET;
}

/**
 * The first slot of the layer actions bar. Where a doodad lands is the active
 * layer's business, and the layer being worked on is the list right above --
 * with an array active this button sets that array's doodad, which is the same
 * reading, and is why the bar is built of slots whose meaning follows the layer.
 */
export function AddDoodadButton() {
  const { title, icon } = purpose();
  return (
    <button
      type="button"
      class="btn btn-secondary btn-sm text-nowrap"
      disabled={state.hideoutDocument.value === null}
      onClick={() => {
        state.showPalette.value = !state.showPalette.value;
      }}
    >
      <i class={`bi ${icon}`}></i> {title}
    </button>
  );
}

export function DoodadPalette() {
  const shown = state.showPalette.value;
  const document_ = state.hideoutDocument.value;

  useEffect(() => {
    if (shown && document_) loadTable(document_);
  }, [shown, document_]);

  if (!shown) return null;
  return (
    <div id="doodad-sidebar">
      <div class="d-flex justify-content-between align-items-center">
        <h2>{purpose().title}</h2>
        <button
          type="button"
          class="btn-close btn-close-white"
          aria-label="Close the doodad palette"
          onClick={() => {
            state.showPalette.value = false;
          }}
        ></button>
      </div>
      <hr />
      <Search />
      <Refusal />
      <Filters
        title="Categories"
        items={table.value?.palette.categories}
        filter={categoryFilter}
      />
      <Filters
        title="Tags"
        items={table.value?.palette.tags}
        filter={tagFilter}
      />
      <List />
      <Instructions />
    </div>
  );
}

/**
 * What a double-click does, which is not the same question in the two cases.
 * Shift adds, as it does to a selection, so an array made of two doodads in turn
 * is two double-clicks.
 */
function Instructions() {
  if (activeArray() !== null) {
    return (
      <p class="text-secondary mt-1 mb-0">
        Double-click a doodad to make this array out of it. Hold{" "}
        <span class="shortcut">Shift</span> to add it to the ones the array
        already uses, which it then places in turn.
      </p>
    );
  }
  return (
    <p class="text-secondary mt-1 mb-0">
      Double-click a doodad to place it in the view. Place several and they step
      away from each other; move the view to start again.
    </p>
  );
}

function Search() {
  return (
    <div class="sidebar-item d-flex gap-1">
      <input
        type="search"
        class="form-control form-control-sm"
        placeholder="Search names"
        value={search.value}
        onInput={(event) => {
          search.value = event.currentTarget.value;
        }}
      />
      <button
        type="button"
        class="btn btn-secondary btn-sm text-nowrap"
        disabled={!narrowed()}
        onClick={clearSearch}
        title="Clear the search and every category and tag filter."
      >
        Clear
      </button>
    </div>
  );
}

function narrowed() {
  return (
    search.value !== "" ||
    categoryFilter.value.size > 0 ||
    tagFilter.value.size > 0
  );
}

function clearSearch() {
  search.value = "";
  categoryFilter.value = new Map();
  tagFilter.value = new Map();
}

/**
 * One filter section: a list of keys, each cycling unset -> include -> exclude.
 *
 * Include reads as OR and exclude beats every include, which is what makes two
 * lists of 98 and 38 usable at all: "the Karui and Vaal ones, but no NPCs" is
 * three clicks, where an include-only filter cannot say it.
 *
 * Both sections are `<details>`, closed until asked for. 136 rows above the
 * doodads would leave no doodads on screen, and the search input answers most
 * of what a filter would.
 */
function Filters({ title, items, filter }) {
  if (!items) return null;
  return (
    <details class="sidebar-item">
      <summary>
        {title} <FilterCount filter={filter} />
      </summary>
      <div class="filter-list">
        {items.map((item) => (
          <FilterRow item={item} filter={filter} />
        ))}
      </div>
    </details>
  );
}

/** What the section is doing while it is closed, which is when it matters. */
function FilterCount({ filter }) {
  if (filter.value.size === 0) return null;
  const excluded = [...filter.value.values()].filter(
    (state_) => state_ === EXCLUDE,
  ).length;
  return (
    <span class="text-info">
      {filter.value.size - excluded} in, {excluded} out
    </span>
  );
}

function FilterRow({ item, filter }) {
  const state_ = filter.value.get(item.key);
  return (
    <button
      type="button"
      class={`filter-row ${filterColour(state_)}`}
      onClick={() => cycleFilter(filter, item.key)}
    >
      <i class={`bi ${filterIcon(state_)}`}></i> {item.name}
    </button>
  );
}

function filterIcon(state_) {
  if (state_ === INCLUDE) return "bi-plus-circle-fill";
  if (state_ === EXCLUDE) return "bi-dash-circle-fill";
  return "bi-circle";
}

function filterColour(state_) {
  if (state_ === INCLUDE) return "text-info";
  if (state_ === EXCLUDE) return "text-danger";
  return "text-secondary";
}

function cycleFilter(filter, key) {
  const next = new Map(filter.value);
  const state_ = next.get(key);
  if (state_ === undefined) next.set(key, INCLUDE);
  else if (state_ === INCLUDE) next.set(key, EXCLUDE);
  else next.delete(key);
  filter.value = next;
}

function List() {
  if (tableError.value) {
    return <p class="text-danger">{`${tableError.value.message}`}</p>;
  }
  if (!table.value) return <p class="text-secondary">Loading doodads...</p>;

  const found = table.value.palette.groups({
    text: search.value,
    categories: categoryFilter.value,
    tags: tagFilter.value,
  });
  if (found.length === 0) {
    return <p class="text-secondary">Nothing matches.</p>;
  }

  // Said once for the whole list rather than per row: it is one answer, and
  // there are a thousand rows to ask it of.
  const refused = refusal() === null ? "" : "palette-refused";
  return (
    <div class={`palette-list ${refused}`}>
      {found.map((group) => (
        <Category group={group} />
      ))}
    </div>
  );
}

/**
 * Grouped by category and not by tag. Every doodad has exactly one category, so
 * headers are lossless; a tag heading would strand the untagged and repeat the
 * doodads carrying several.
 */
function Category({ group }) {
  return (
    <div class="palette-category">
      <h3 class="palette-heading">{group.category}</h3>
      <ul class="list-unstyled mb-2">
        {group.entries.map((entry) => (
          <Entry entry={entry} />
        ))}
      </ul>
    </div>
  );
}

/**
 * One row. The metadata id is the title of every row and is shown on the rows
 * whose name is shared -- several doodads are called `Warp Rune`, and identical
 * rows are a choice a player cannot make.
 *
 * The hideout is the only thing the data supports saying about what a player
 * owns: no table names an MTX pack. It reads under the name, where a row that
 * has none simply has one line.
 *
 * The variation count is shown where there is a choice to make and nowhere else,
 * so `(12)` means "this one varies" rather than "this row has a number on it".
 * Most doodads have exactly one, and a thousand rows reading `(1)` would say
 * only that the editor can count. Which variation is chosen is the Selection
 * section's business -- a placed doodad arrives as the first one.
 */
function Entry({ entry }) {
  return (
    <li
      class="palette-row"
      title={entry.id}
      onDblClick={(event) => chose(entry, event.shiftKey)}
    >
      <span>
        {entry.name}
        {entry.distinguisher && (
          <span class="palette-mark"> {entry.distinguisher}</span>
        )}
      </span>
      {entry.variations > 1 && (
        <span class="palette-mark">{entry.variations} variants</span>
      )}
      {entry.hideout && <span class="palette-hideout">{entry.hideout}</span>}
    </li>
  );
}

/**
 * Why nothing can be chosen right now, or `null`.
 *
 * Two layer checks and nothing else. A third stood here and refused the whole
 * palette when the document's names disagreed with the table, on the reading
 * that placing one would write a name the game rejects -- it rejects nothing,
 * wiki issues 0057 and 0059, and a German player reading an English file is
 * exactly the case it used to shut down.
 *
 * The layer checks are here rather than at the placement because a doodad
 * placed into a hidden layer appears nowhere. They do not apply to an array,
 * which is being told what it is made of rather than handed a doodad -- and a
 * hidden array is a fair thing to work on.
 */
function refusal() {
  if (activeArray() !== null) return null;

  const layer = activeLayer();
  // Said in plain terms rather than asked of `viewport/groups.js`, which would
  // bring Konva into the sidebar to answer a question about two booleans --
  // the same trade `gui/layers.jsx` makes.
  if (layer && !layer.visible) return hiddenOrLocked(layer, "hidden");
  if (layer && layer.locked) return hiddenOrLocked(layer, "locked");
  return null;
}

function hiddenOrLocked(layer, flag) {
  return (
    `New doodads land in the layer '${layer.name}', which is ${flag}. ` +
    `Make it the way you want it, or make another layer the active one.`
  );
}

function Refusal() {
  const reason = refusal();
  if (reason === null) return null;
  return <p class="text-danger mb-1">{reason}</p>;
}

function activeLayer() {
  return state.layers.value.find(
    (layer) => layer.id === state.activeLayer.value,
  );
}

/**
 * The id of the active layer's array, or `null` where it has none.
 *
 * `editedArray` would answer the same question -- working on an array is what
 * makes it the active layer, and the other way round -- but the palette's
 * question is about the layer it would otherwise be placing into, so it is the
 * active layer that is asked.
 */
function activeArray() {
  // Reading the layer list subscribes a caller that renders: a detach drops a
  // generator, which is a mutation nothing else here would hear about.
  state.layers.value;
  const layer = state.activeLayer.value;
  const array = state.hideoutDocument.value?.findGenerator(layer);
  return array ? layer : null;
}

/**
 * A doodad chosen: placed in the view, or made the active array's, which are the
 * same answer to the same question put by two different layers.
 */
function chose(entry, adding) {
  if (refusal() !== null) return;

  const array = activeArray();
  if (array === null) {
    state.requestPlacement(entry.hash, entry.name);
    return;
  }
  sourceDoodad(array, entry, adding);
}
