/**
 * The generated tables for the document's language: fetched once each, and
 * shared by everything that asks the data a question.
 *
 * Two of them, and they are loaded separately because they are wanted at
 * different moments. The doodad table is 400 kilobytes and is asked for by
 * whoever needs it -- the labels, the palette, the selection, an array -- so a
 * player who wants none of them fetches nothing; the hideout table is three, and
 * the sidebar names the loaded file from it the moment the file arrives.
 *
 * It began inside `gui/palette.jsx`, which is still its main reader. What moved
 * it out is the Selection section: how many variations a doodad has is the
 * table's answer, and a player editing a selection may never have opened the
 * palette at all -- wiki issue 0042. Two readers is what a module is for.
 *
 * It sits beside `state.js` and no longer in `gui/` for the same reason applied
 * once more: the labels over the canvas name doodads too, and the viewport is
 * not a part of the sidebar -- wiki issue 0059.
 *
 * The generated files are static assets rather than source, the same as the
 * bounds outlines, so they are fetched and not imported -- one file per
 * language, and a player opens one of them. Fetching is why this is not in
 * `hideout/`, which is framework-free by rule, wiki issue 0011.
 *
 * A table that has not arrived is not an error and stops nothing: every reader
 * has an answer without it -- the file's own names, and a variation count of
 * none. Wiki issue 0059.
 */

import { signal } from "@preact/signals";

import { Hideouts } from "./hideout/hideouts.js";
import * as palette from "./hideout/palette.js";

/** `{ language, palette }` once loaded, or `null`. */
export const table = signal(null);
export const tableError = signal(null);

/**
 * The `Hideouts` for the loaded document's language, or `null`, and what went
 * wrong fetching it. No check against the document: the header names one
 * hideout, and one name is not evidence of a language the way hundreds are.
 */
export const hideouts = signal(null);
export const hideoutsError = signal(null);

/**
 * The manifest of languages there are tables for, or `null`, and what went
 * wrong fetching it. It is the selector's list -- wiki issue 0053 -- and it is
 * one file for the whole session rather than one per document.
 */
export const languages = signal(null);
export const languagesError = signal(null);

/** Cached per directory and language: twenty files, a player loads a few. */
const FETCHED = new Map();

/**
 * Both loaders are keyed by language and not by document: a table is the
 * language's, so two documents in one language share it and one document
 * switched to another needs the other one. The switch is why -- it changes what
 * a loaded document wants without changing the document a caller passes.
 */
export async function loadTable(document_) {
  const language = document_.header.language;
  if (table.value?.language === language) return;

  table.value = null;
  tableError.value = null;
  try {
    const data = await fetchLanguage("doodads", language);
    table.value = { language, palette: new palette.Palette(data) };
  } catch (error) {
    tableError.value = error;
  }
}

export async function loadHideouts(document_) {
  const language = document_.header.language;
  if (hideouts.value?.language === language) return;

  hideouts.value = null;
  hideoutsError.value = null;
  try {
    hideouts.value = new Hideouts(await fetchLanguage("hideouts", language));
  } catch (error) {
    hideoutsError.value = error;
  }
}

/** The manifest, fetched once. Which languages exist does not change. */
export async function loadLanguages() {
  if (languages.value) return;

  languagesError.value = null;
  try {
    languages.value = await fetchJson(
      `${import.meta.env.BASE_URL}languages.json`,
      "No list of the languages there are tables for",
    );
  } catch (error) {
    languagesError.value = error;
  }
}

/**
 * The table's entry for a doodad, or `undefined` -- for an essential the game
 * places itself, or before the table has arrived.
 */
export function entryOf(doodad) {
  return table.value?.palette.find(doodad.hash);
}

/**
 * What to call a doodad, wherever one is named: the sidebar's selection rows,
 * an array's source list, the labels over the canvas. Reading the signal is
 * what puts the table's word in place of the file's when the table arrives, and
 * what follows a switch of language -- wiki issues 0059 and 0053.
 */
export function nameOf(doodad) {
  return palette.nameFor(table.value?.palette, doodad);
}

/**
 * Whether that name came from the file for want of a table entry, which is what
 * the mark beside it says -- wiki issue 0060. It follows the table and not the
 * document: a hash named by a regenerated table loses its mark and changes
 * nothing else.
 */
export function unknownHash(doodad) {
  return palette.unknownHash(table.value?.palette, doodad);
}

/**
 * How many art files a doodad can be drawn as, or `0` where the table cannot
 * say. Zero rather than one: "the table does not know" and "there is one" are
 * different answers, and only one of them is worth showing a player.
 */
export function variationsOf(doodad) {
  return entryOf(doodad)?.variations ?? 0;
}

/** What a directory of tables holds, for the message a player is shown. */
const HOLDS = {
  doodads: "doodad names",
  hideouts: "hideout names",
};

async function fetchLanguage(directory, language) {
  if (!language) throw new Error("This file names no language.");
  const url = `${import.meta.env.BASE_URL}${directory}/${encodeURIComponent(language)}.json`;
  if (!FETCHED.has(url)) {
    FETCHED.set(
      url,
      fetchJson(url, `No ${HOLDS[directory]} for the language '${language}'`),
    );
  }
  return FETCHED.get(url);
}

async function fetchJson(url, complaint) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${complaint}: ${response.status} ${response.statusText}.`);
  }
  return response.json();
}
