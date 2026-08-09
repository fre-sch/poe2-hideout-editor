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

/** `hideout_hash` of the outline to draw. Never written back to the file. */
export const hideoutType = signal(null);

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

export function layersChanged() {
  layers.value = [...hideoutDocument.value.layers];
}

/** The selected `Doodad` objects, for the sidebar to list. */
export const selection = signal([]);

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
