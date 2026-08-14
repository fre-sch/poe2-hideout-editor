/**
 * Application state, shared by the sidebar and the viewport.
 *
 * The signals are the wiring between the two, not a second copy of the
 * document: `hideoutDocument` holds the one `HideoutDocument` there is, and the
 * viewport's Konva nodes point at the doodads inside it.
 *
 * `doodadCount` is the one exception, and it earns it. Deleting a doodad
 * removes it from `document.doodads` in place, which nothing can subscribe to,
 * and replacing the document instead would rebuild every node in the viewport
 * to update a number in the sidebar. So the count is published separately, by
 * whoever changed the array.
 */

import { effect, signal } from "@preact/signals";

/** The loaded document, or `null`. Changes when a file is loaded, not edited. */
export const hideoutDocument = signal(null);
export const fileName = signal("");

/** What went wrong loading the last file. A malformed file must say so. */
export const loadError = signal(null);

/**
 * The document's `header.hideout_hash`, republished. `language`'s arrangement,
 * applied to the type -- see there.
 *
 * It is also what the viewport draws the outline from, so the outline follows
 * the type without being a second setting to keep in step.
 */
export const hideoutType = signal(null);

/**
 * The type the loaded file arrived as, `{ hash, name }`.
 *
 * The selector's list is built from this rather than from the header, so that a
 * type the game data does not name is still offered after it has been left --
 * an option that disappears when it stops being selected cannot be returned to,
 * wiki issue 0007. It is also the name restored when the player does return.
 */
export const fileType = signal(null);

/**
 * Changes the document's hideout type: the hash, and the name that follows it.
 *
 * `switchLanguage`'s arrangement, applied to a pair of fields --
 * `hideouts.headerFor` says what to write, wiki issue 0061.
 */
export function switchHideoutType(header) {
  Object.assign(hideoutDocument.value.header, header);
  hideoutType.value = header.hideout_hash;
}

/**
 * The document's `header.language`, republished.
 *
 * `doodadCount`'s reasoning, applied to a field: the header is part of the
 * document, switching the language writes it there, and nothing can subscribe
 * to a field being written. The header stays the truth -- it is what the export
 * carries -- and this is what the tables and the sidebar watch.
 */
export const language = signal(null);

/**
 * Switches the document's language: the header, and everyone reading it.
 *
 * Nothing else in the document moves. Positions, rotations, variations, layers
 * and generators are language-free, and so are the names, which a switch does
 * not touch -- what a doodad is *shown* as is looked up per language, wiki
 * issues 0053 and 0059.
 */
export function switchLanguage(chosen) {
  hideoutDocument.value.header.language = chosen;
  language.value = chosen;
}

export const doodadCount = signal(0);

/**
 * The document's layers, republished for whoever draws them.
 *
 * `doodadCount`'s reasoning, applied to a list: the layers live in the
 * document, editing them mutates that document in place, and nothing can
 * subscribe to a mutation. Every layer edit therefore goes through
 * `layersChanged`, which is also the one place the array is copied -- signals
 * compare by reference, so a mutated layer needs a new array to be noticed.
 */
export const layers = signal([]);

/** Which layer a new doodad, or a moved selection, lands in. */
export const activeLayer = signal(null);

/**
 * The group being worked on, by name, or `null`.
 *
 * The other kind of row the layer list is picked over. Exactly one of these
 * two is set: a group is not a layer doodads can land in, so while one is up
 * there is no active layer and the palette says so. See
 * wiki/decisions/layer-groups.md.
 */
export const activeGroup = signal(null);

export function workOnLayer(id) {
  activeGroup.value = null;
  activeLayer.value = id;
}

export function workOnGroup(name) {
  activeLayer.value = null;
  activeGroup.value = name;
}

/**
 * The names of the groups whose rows are folded shut.
 *
 * Not stored and not saved: it is how the list is being looked at now, not
 * something about the layout. A list rather than a `Set`, signals comparing by
 * reference -- a mutated set is a set nobody hears about.
 */
export const collapsedGroups = signal([]);

export function toggleCollapsed(name) {
  const collapsed = collapsedGroups.value;
  collapsedGroups.value = collapsed.includes(name)
    ? collapsed.filter((other) => other !== name)
    : [...collapsed, name];
}

/**
 * Which name in the layer list is open for editing, as `{ kind, key }` -- kind
 * `"layer"` with a layer id, or kind `"group"` with a group name -- or `null`
 * while every name is being read rather than written.
 *
 * One signal, so opening a second editor closes the first: a name is edited by
 * double-clicking it, and the row that was open is not necessarily near the row
 * that just opened. Not stored and not saved, the way `collapsedGroups` is not:
 * it is a gesture in progress. See wiki issue 0067.
 */
export const editedName = signal(null);

export function editName(kind, key) {
  editedName.value = { kind, key };
}

export function endNameEdit() {
  editedName.value = null;
}

/** Whether this is the name that is open, `key` being an id or a group name. */
export function editingName(kind, key) {
  const edited = editedName.value;
  return edited !== null && edited.kind === kind && edited.key === key;
}

/**
 * The layer being dragged in the layer list, as `{ id, group }` -- the group it
 * is leaving, or `null` for a layer in none -- and `null` while nothing is being
 * dragged.
 *
 * The list draws itself differently while a drag is on: a member offers a strip
 * at the end of the list to leave its group by. So the drag is a signal and not
 * a property of the row it started on -- the strip is elsewhere. Not stored and
 * not saved, the way `editedName` is not: it is a gesture in progress. See wiki
 * issue 0070.
 */
export const draggedLayer = signal(null);

/**
 * Where the drag is hovering, as `{ group }` -- a group's name, or `null` for
 * the strip that leaves a group -- and `null` where it is over neither.
 *
 * A signal because the drag has no hover: `:hover` is not maintained while the
 * pointer is dragging something, so the row that would take the drop has to say
 * so itself.
 */
export const dropTarget = signal(null);

export function startLayerDrag(id, group) {
  draggedLayer.value = { id, group };
}

export function endLayerDrag() {
  draggedLayer.value = null;
  dropTarget.value = null;
}

/** Whether the drag is over this drop target, `group` being a name or `null`. */
export function overDropTarget(group) {
  return dropTarget.value !== null && dropTarget.value.group === group;
}

export function layersChanged() {
  layers.value = [...hideoutDocument.value.layers];
}

/** The selected `Doodad` objects, for the sidebar to list. */
export const selection = signal([]);

/**
 * Republishes the selection after a doodad in it was edited in place.
 *
 * `layersChanged`'s reasoning, applied to the selection: editing a doodad's `fv`
 * mutates the document, which nothing can subscribe to, and signals compare by
 * reference. The viewport is not told, and needs no telling -- every doodad draws
 * as the same gizmo whatever its variation says, wiki issue 0042.
 */
export function selectionChanged() {
  selection.value = [...selection.value];
}

/**
 * The one `Doodad` the sidebar is pointing at, or `null`.
 *
 * Every doodad draws as the same gizmo, so a row of the selection list is a name
 * with nothing on the canvas to tie it to -- and the variation and mirror
 * buttons on that row are aimed at a doodad. The viewport colours whichever
 * doodad this names, which is the tie.
 *
 * A doodad and not a node: which nodes exist is the viewport's, and the sidebar
 * has the doodad in its hand already.
 */
export const hoveredDoodad = signal(null);

/**
 * A selection the sidebar asks for, as `Doodad` objects, or `null`.
 *
 * The other direction of `selection`: what is selected is the viewport's to
 * decide -- it owns the `Selection` and the nodes -- so the sidebar asks rather
 * than writes. The viewport answers by publishing `selection`, which is what
 * makes the request a request and not a second copy of the truth.
 */
export const selectionRequest = signal(null);

export function requestSelection(doodads) {
  selectionRequest.value = doodads;
}

/** Whether the doodad palette is up. Loading a file puts it away. */
export const showPalette = signal(false);

/**
 * The id of the layer whose array is being worked on, or `null`. Its handles are
 * up, which is an array's version of being selected -- an array's doodads cannot
 * be, and its box is what there is to grab.
 *
 * A layer id and not a `Generator`: the document holds the parameters and the
 * viewport can ask it for them, and an id survives a regeneration the way an
 * object reference does not.
 *
 * The settings panel is a second signal rather than this one, because making an
 * array the active layer raises the handles and nothing else: a box to drag is
 * most of what a player wants, and a dozen numbers is what they ask for
 * afterwards.
 */
export const editedArray = signal(null);

export const showArraySettings = signal(false);

/**
 * The layer ids of the arrays that move with the selection, which is how a
 * layer group carries its arrays -- their doodads cannot be selected, so there
 * is nothing else of theirs for a box to hold. See
 * wiki/decisions/layer-groups.md.
 *
 * Ids rather than generators, for `editedArray`'s reason: an id survives a
 * regeneration the way an object reference does not.
 */
export const movingArrays = signal([]);

/**
 * Raises an array's handles, or puts them away. The settings go with them: they
 * are one array's, so there is nothing for them to describe once no array is
 * being worked on.
 *
 * Taking one array up puts a group down. Two boxes over the same array is two
 * answers to what a drag would move, and the one being asked for is the one just
 * named -- the granular half of working on an array, which is what the settings
 * are. The group comes back when the layer is activated again.
 */
export function editArray(layer) {
  editedArray.value = layer;
  if (layer === null) {
    showArraySettings.value = false;
    return;
  }
  movingArrays.value = [];
}

/**
 * The arrays the sidebar has just rewritten, as `{ layers }`, or `null`.
 *
 * `selectionRequest`'s reasoning, applied to parameters: the sidebar edits the
 * document in place, which nothing can subscribe to, and what has to happen
 * next -- regenerate the doodads, move the nodes drawing them -- is the
 * viewport's. A fresh object per edit, so two edits that say the same thing are
 * two edits.
 *
 * It names the layers rather than being read off `editedArray`, so that an edit
 * reaches the doodads it is about however the panels have moved on since. A list
 * and not one layer, because aligning a group rewrites several arrays at once
 * and a signal set twice in a tick is read once.
 */
export const arrayEdit = signal(null);

export function arrayEdited(layer) {
  arraysEdited([layer]);
}

export function arraysEdited(layers) {
  arrayEdit.value = { layers };
}

/**
 * Bumped whenever a gesture in the viewport rewrites an array's geometry.
 *
 * The other direction, and it carries nothing: the sidebar is showing the
 * parameters a handle has just moved, and needs only to be told to read them
 * again. It cannot be the same signal as `arrayEdit` -- that one asks the
 * viewport to redraw the gizmo, which mid-drag would take the outline out from
 * under the hand dragging it.
 */
export const arrayMoved = signal(0);

/**
 * A doodad the palette asks for, as `{ hash, name }`, or `null`.
 *
 * `selectionRequest`'s reasoning, applied to placing: where the middle of the
 * view is, and what a Konva node for a new doodad looks like, are the
 * viewport's to know. The palette knows what to place and asks for it.
 *
 * Every request is a fresh object, so asking twice for the same doodad places
 * twice -- which is what double-clicking the same row twice means.
 */
export const placementRequest = signal(null);

export function requestPlacement(hash, name) {
  placementRequest.value = { hash, name };
}

/**
 * The rubber band while it is down, in pixels inside the viewport, or `null`.
 *
 * It is a DOM element rather than a `Konva.Rect` because the view is turned --
 * see `viewport/stage.js` -- and a band drawn inside the stage would be turned
 * with it, arriving on screen as a diamond.
 */
export const band = signal(null);

export const labels = signal([]);

// -- stored preferences -----------------------------------------------------
//
// Declared before what uses them: a `const` cannot be read above its own line,
// however freely a function may be called there.

/**
 * Preferences outlive a refresh, and reaching storage is the whole of it.
 *
 * Both directions are explicitly silenced. A browser with site data blocked
 * throws on the very first read, and a preference is worth less than the editor
 * it would otherwise take down; what a player loses instead is the memory of a
 * checkbox.
 */
const PREFIX = "poe2-hideout-editor.";

function readStored(key) {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch (error) {
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch (error) {
    // See above.
  }
}

/** A boolean signal that writes itself back whenever it is set. */
function storedFlag(key, fallback) {
  const stored = readStored(key);
  const flag = signal(stored === null ? fallback : stored === "true");
  effect(() => writeStored(key, String(flag.value)));
  return flag;
}

/** What the viewport draws besides the doodads. Both are remembered. */
export const showLabels = storedFlag("show-labels", true);
export const showGrid = storedFlag("show-grid", true);

/**
 * Whether the help modal is up, and whether it comes up by itself.
 *
 * They live here rather than in `gui/help.jsx` so that the viewport can raise
 * the modal from the `H` shortcut without importing the sidebar.
 *
 * Not a `storedFlag`, because the stored value has three states where a flag
 * has two: absent is a first visit, which is greeted. So a player who reads the
 * modal once and closes it is not greeted again, and a player who wants the
 * reminder ticks the box for it. A flag that wrote itself back on load would
 * spend that third state before the player had answered.
 */
const HELP_KEY = "show-help-on-load";
const storedHelp = readStored(HELP_KEY);

export const showHelp = signal(storedHelp !== "false");
export const showHelpOnLoad = signal(storedHelp === "true");

export function rememberHelpPreference() {
  writeStored(HELP_KEY, String(showHelpOnLoad.value));
}
