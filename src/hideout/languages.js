/**
 * The languages the editor has tables for, and how each one is spelled.
 *
 * Built from `public/languages.json`, written by `scripts/editor_data.py`. see
 * issues/0055. A hardcoded list would be a second copy of what is on disk.
 *
 * Three of the ten spellings are measured, the other seven are the data
 * exporter's column headers. see specifications/game-facts, "Names and
 * language". The game does not read the field, so a wrong word costs no import
 * -- it costs the editor its own table on reload, which is why the difference
 * is shown rather than hidden.
 */

/** How a header spelling is known. `measured` is the other, and needs no name. */
export const ASSUMED = "assumed";

/**
 * Every language offerable for a document written in `language`: the ones the
 * manifest lists, and the document's own first when it is not among them.
 *
 * `manifest` is the parsed file or `null` -- until the fetch arrives the
 * document's own language is the only one to offer.
 *
 * The reasoning and the shape are `hideouts.optionsFor`'s. The manifest's order
 * is kept rather than sorted: the measured spellings come first.
 */
export function optionsFor(manifest, language) {
  if (!manifest) return [own(language, false)];
  const listed = manifest.languages;
  if (listed.some((entry) => entry.language === language)) return listed;
  return [own(language, true), ...listed];
}

/**
 * The document's own language, as an entry. `unknown` is what the manifest said
 * about it, so it is false while there is no manifest to have asked.
 */
function own(language, unknown) {
  return { language, spelling: ASSUMED, unknown };
}

/**
 * Whether the header spelling for a language is assumed rather than measured.
 *
 * What the manifest said: a language it does not list is not assumed but
 * unheard of, and nothing is assumed while there is no manifest -- `own`'s
 * reasoning again.
 */
export function assumed(manifest, language) {
  const entry = manifest?.languages.find(
    (listed) => listed.language === language,
  );
  return entry?.spelling === ASSUMED;
}
