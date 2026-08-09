/**
 * The doodad table for the document's language: fetched once, checked against
 * the document, and shared by everything that asks the data a question.
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

/** Cached per language: ten files, and a player loads one or two of them. */
const FETCHED = new Map();

export async function loadTable(document_) {
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
