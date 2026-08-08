/**
 * The doodad palette: a panel of everything that can be placed, and the button
 * that raises it.
 *
 * It is the first thing in the editor that adds a doodad rather than moving one
 * the player already had -- see wiki/decisions/doodad-palette.md.
 *
 * **It does not block.** A modal would cover the viewport it places into, and
 * every placement would be a blind one; placing a doodad and then moving it is
 * meant to be one gesture. So this is a plain panel rather than the `<dialog>`
 * of `help.jsx`: a non-modal dialog element would be a dialog in name only --
 * no backdrop, no Escape, no focus trap -- and would still have to be dragged
 * and positioned here.
 *
 * **It lives outside the viewport container.** The editor's shortcuts are bound
 * to that container, not to the window -- wiki issue 0010 -- so typing `g` into
 * the search input here cannot align the view to the game. Keeping the panel out
 * of that element is what guarantees it, and `app.jsx` is where that is decided.
 *
 * **Loading a file closes it.** A new document may be in another language, which
 * invalidates both the table and the check below; a panel that survived a load
 * would be describing the previous document. `gui/file.jsx` puts it away.
 */

import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";

import * as state from "../state.js";
import { Palette, UNTAGGED } from "../hideout/palette.js";

/**
 * The table for the document's language, once it has been fetched and checked,
 * or `null` while there is none.
 *
 * `{ document, language, palette, check }`, where `check` is what
 * `disagreements` found against the document. It is computed once, when the
 * table arrives, rather than per render: it walks every doodad in the hideout,
 * and what it walks does not change while the panel is up -- a doodad placed
 * from the table is named by the table and cannot disagree with it.
 *
 * The document is remembered beside the language because two documents can
 * share one: the check belongs to the file it was run against.
 */
const table = signal(null);
const tableError = signal(null);

const search = signal("");
const activeTags = signal(new Set());

/**
 * Where the panel sits, once it has been dragged, or `null` while it sits where
 * the stylesheet put it. Remembered across openings: a player who moved it out
 * of the way meant it to stay out of the way.
 */
const position = signal(null);

/** Cached per language: ten files, and a player loads one or two of them. */
const FETCHED = new Map();

export function AddDoodadButton() {
  return (
    <div class="sidebar-item">
      <button
        type="button"
        class="btn btn-primary btn-sm"
        disabled={state.hideoutDocument.value === null}
        onClick={() => {
          state.showPalette.value = true;
        }}
      >
        <i class="bi bi-plus-square"></i> Add doodad
      </button>
    </div>
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
    <div
      class="palette-panel"
      role="dialog"
      aria-label="Doodad palette"
      style={position.value}
    >
      <div class="palette-title" onMouseDown={startDrag}>
        Doodad palette
      </div>
      <div class="palette-body">
        <Search />
        <Tags />
        <Refusal />
        <List />
      </div>
      <div class="palette-footer">
        <p class="text-secondary mb-0">
          Double-click a doodad to place it in the view. Place several and they
          step away from each other; move the view to start again.
        </p>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          onClick={() => {
            state.showPalette.value = false;
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function Search() {
  return (
    <input
      type="search"
      class="form-control form-control-sm mb-1"
      placeholder="Search names"
      value={search.value}
      onInput={(event) => {
        search.value = event.currentTarget.value;
      }}
    />
  );
}

/**
 * The tag toggles, as Bootstrap badges on buttons -- a badge is a class rather
 * than an element, so it costs nothing in focus or keyboard behaviour.
 *
 * No toggle set shows everything, which is why `Untagged` has to be one of them:
 * without it the 52 doodads carrying no tag are the only ones a filtered list
 * can never reach.
 */
function Tags() {
  const palette = table.value?.palette;
  if (!palette) return null;

  return (
    <div class="palette-tags mb-1">
      {palette.tags.map((tag) => (
        <button
          type="button"
          class={`badge border-0 ${badgeOf(tag)}`}
          onClick={() => toggleTag(tag.key)}
        >
          {tag.name}
        </button>
      ))}
    </div>
  );
}

function badgeOf(tag) {
  return activeTags.value.has(tag.key)
    ? "text-bg-primary"
    : "text-bg-secondary";
}

function toggleTag(key) {
  const tags = new Set(activeTags.value);
  if (!tags.delete(key)) tags.add(key);
  activeTags.value = tags;
}

function List() {
  if (tableError.value) {
    return <p class="text-danger">{`${tableError.value.message}`}</p>;
  }
  if (!table.value) return <p class="text-secondary">Loading doodads...</p>;

  const found = table.value.palette.groups({
    text: search.value,
    tags: activeTags.value,
  });
  if (found.length === 0) {
    return <p class="text-secondary">Nothing matches.</p>;
  }

  // Said once for the whole list rather than per row: it is one answer, and
  // there are 1730 rows to ask it of.
  const refused = refusal() === null ? "" : "palette-refused";
  return (
    <div class="palette-scroll">
      <div class={`palette-list ${refused}`}>
        {found.map((group) => (
          <Category group={group} />
        ))}
      </div>
    </div>
  );
}

/**
 * Grouped by category and not by tag. Every doodad has exactly one category, so
 * headers are lossless; a tag heading would strand the untagged and repeat the
 * 437 doodads carrying several.
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
 * whose name is shared -- seven doodads are called `Warp Rune`, and seven
 * identical rows are a choice a player cannot make.
 *
 * The hideout mark is the only thing the data supports saying about what a
 * player owns: no table names an MTX pack. 1516 doodads carry no mark, and no
 * empty space where one would be.
 */
function Entry({ entry }) {
  return (
    <li class="palette-row" title={entry.id} onDblClick={() => place(entry)}>
      {entry.name}
      {entry.distinguisher && (
        <span class="palette-mark"> {entry.distinguisher}</span>
      )}
      {entry.hideout && <span class="palette-mark"> [{entry.hideout}]</span>}
    </li>
  );
}

/**
 * Why nothing can be placed right now, or `null`.
 *
 * The language check is the important one. A `.hideout` names every doodad, and
 * the game rejects an import whose names disagree with its `language`, so a
 * table that disagrees with the document is a table that would write a file the
 * game refuses. English is never a fallback: it is precisely the wrong answer.
 *
 * The layer check is the mundane one, and it is here rather than at the
 * placement because a doodad placed into a hidden layer appears nowhere.
 */
function refusal() {
  const loaded = table.value;
  if (!loaded) return null;

  if (loaded.check.reports.length > 0) {
    const [first] = loaded.check.reports;
    return (
      `This file's doodad names do not match the ${loaded.language} table, so ` +
      `placing one would write a name the game rejects. It calls doodad ` +
      `${first.hash} '${first.name}', where the table says '${first.expected}'.`
    );
  }

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

function place(entry) {
  if (refusal() !== null) return;
  state.requestPlacement(entry.hash, entry.name);
}

// -- the table ---------------------------------------------------------------

/**
 * Fetches the table for a language and checks it against the document.
 *
 * The generated files are static assets rather than source, the same as the
 * bounds outlines, so they are fetched and not imported -- one file of 1730
 * doodads per language, and a player opens one of them.
 *
 * The check is the point of doing it here: the table is only usable once it has
 * agreed with the hundreds of names the game itself wrote into the document.
 */
async function loadTable(document_) {
  if (table.value?.document === document_) return;

  const language = document_.header.language;
  table.value = null;
  tableError.value = null;
  try {
    const palette = new Palette(await fetchLanguage(language));
    table.value = {
      document: document_,
      language,
      palette,
      check: palette.disagreements(document_.doodads),
    };
  } catch (error) {
    tableError.value = error;
  }
}

async function fetchLanguage(language) {
  if (!language) throw new Error("This file names no language.");
  if (!FETCHED.has(language)) {
    FETCHED.set(language, fetchJson(language));
  }
  return FETCHED.get(language);
}

async function fetchJson(language) {
  const url = `${import.meta.env.BASE_URL}doodads/${encodeURIComponent(language)}.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `No doodad names for the language '${language}': ` +
        `${response.status} ${response.statusText}.`,
    );
  }
  return response.json();
}

// -- dragging ----------------------------------------------------------------

/**
 * The title bar is the handle, which is where a player reaches for it and the
 * only part of the panel that is not something else already.
 *
 * On the window rather than the panel, as every other drag in the editor is, so
 * that a pointer leaving the panel keeps dragging and -- above all -- still
 * lets go. Clamped to the window: a panel dragged past the edge is a panel with
 * no title bar left to drag back.
 */
function startDrag(event) {
  const panel = event.currentTarget.parentElement;
  const box = panel.getBoundingClientRect();
  const grab = { x: event.clientX - box.left, y: event.clientY - box.top };

  const move = (moved) => {
    position.value = {
      left: `${clamp(moved.clientX - grab.x, window.innerWidth - box.width)}px`,
      top: `${clamp(moved.clientY - grab.y, window.innerHeight - box.height)}px`,
    };
  };
  const end = () => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", end);
  };

  event.preventDefault();
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
}

function clamp(value, high) {
  return Math.max(0, Math.min(value, high));
}
