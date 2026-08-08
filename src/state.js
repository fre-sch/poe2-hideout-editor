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

/** `"select"`, `"translate"` or `"rotate"` -- see `viewport/transform.js`. */
export const viewportMode = signal("select");

/** The selected `Doodad` objects, for the sidebar to list. */
export const selection = signal([]);

export const labels = signal([]);
export const showLabels = signal(true);
