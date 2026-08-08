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

import { signal } from "@preact/signals";

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

/** `"select"`, `"translate"` or `"rotate"` -- see `viewport/transform.js`. */
export const viewportMode = signal("select");

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

/**
 * The rubber band while it is down, in pixels inside the viewport, or `null`.
 *
 * It is a DOM element rather than a `Konva.Rect` because the view is turned --
 * see `viewport/stage.js` -- and a band drawn inside the stage would be turned
 * with it, arriving on screen as a diamond.
 */
export const band = signal(null);

export const labels = signal([]);
export const showLabels = signal(true);

/**
 * Whether the help modal is up, and whether it comes up by itself.
 *
 * They live here rather than in `gui/help.jsx` so that the viewport can raise
 * the modal from the `H` shortcut without importing the sidebar.
 *
 * The stored preference has three states, one more than the checkbox: absent is
 * a first visit, which is greeted. So a player who reads the modal once and
 * closes it is not greeted again, and a player who wants the reminder ticks the
 * box for it.
 */
const HELP_KEY = "poe2-hideout-editor.show-help-on-load";
const storedHelp = readHelpPreference();

export const showHelp = signal(storedHelp !== "false");
export const showHelpOnLoad = signal(storedHelp === "true");

export function rememberHelpPreference() {
  try {
    localStorage.setItem(HELP_KEY, String(showHelpOnLoad.value));
  } catch (error) {
    // Explicitly silenced: storage is blocked, and a preference that cannot be
    // kept is worth less than the editor it would otherwise take down.
  }
}

function readHelpPreference() {
  try {
    return localStorage.getItem(HELP_KEY);
  } catch (error) {
    return null;
  }
}
