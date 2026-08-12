/**
 * The generated tables for the document's language: fetched once each, and
 * shared by everything that asks the data a question.
 *
 * Two of them, and they are loaded separately because they are wanted at
 * different moments. The doodad table is 400 kilobytes and is read by the
 * palette, the selection and the arrays, so it waits until one of those is
 * open; the hideout table is three, and the sidebar names the loaded file from
 * it the moment the file arrives.
 *
 * It began inside `gui/palette.jsx`, which is still its main reader. What moved
 * it out is the Selection section: how many variations a doodad has is the
 * table's answer, and a player editing a selection may never have opened the
 * palette at all -- wiki issue 0042. Two readers is what a module is for.
 *
 * The generated files are static assets rather than source, the same as the
 * bounds outlines, so they are fetched and not imported -- one file per
 * language, and a player opens one of them. Fetching is why this is not in
 * `hideout/`, which is framework-free by rule, wiki issue 0011.
 *
 * ### Why the language check is part of loading
 *
 * A `.hideout` names every doodad, the game validates those names against the
 * file's `language`, and it rejects an import that disagrees. So the table is
 * only usable once it has agreed with the hundreds of names the game itself
 * wrote into the document, and `check` is that agreement. English is never a
 * fallback: it is precisely the wrong answer.
 */

import { signal } from "@preact/signals";

import { Hideouts } from "../hideout/hideouts.js";
import { Palette } from "../hideout/palette.js";

/**
 * `{ document, language, palette, check }` once loaded, or `null`.
 *
 * The document is remembered beside the language because two documents can share
 * one: the check belongs to the file it was run against. It is computed when the
 * table arrives rather than per render -- it walks every doodad in the hideout.
 */
export const table = signal(null);
export const tableError = signal(null);

/**
 * The `Hideouts` for the loaded document's language, or `null`, and what went
 * wrong fetching it. No check against the document: the header names one
 * hideout, and one name is not evidence of a language the way hundreds are.
 */
export const hideouts = signal(null);
export const hideoutsError = signal(null);

/** Cached per directory and language: twenty files, a player loads a few. */
const FETCHED = new Map();

export async function loadTable(document_) {
  if (table.value?.document === document_) return;

  const language = document_.header.language;
  table.value = null;
  tableError.value = null;
  try {
    const palette = new Palette(await fetchLanguage("doodads", language));
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

/**
 * The table's entry for a doodad, or `undefined` -- for an essential the game
 * places itself, or before the table has arrived.
 */
export function entryOf(doodad) {
  return table.value?.palette.find(doodad.hash);
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
