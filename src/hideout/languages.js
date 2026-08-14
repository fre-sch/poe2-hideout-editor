/**
 * The languages the editor has tables for, and how each one is spelled.
 *
 * Built from `public/languages.json`, written by `scripts/editor_data.py` from
 * the one list of languages there is -- see wiki issue 0055. A hardcoded list
 * here would be a second copy of what files are on disk, and would go stale
 * exactly when a language is added.
 *
 * ### What `spelling` says, and why it is worth saying
 *
 * A `.hideout` header carries a `language` word, and until there was a selector
 * the editor only ever copied the word the game had written. Choosing one makes
 * the editor originate it, and only three of the ten spellings are measured --
 * English, French and German, from files this account exported. The other seven
 * are the data exporter's column headers, which need not be the client's own
 * word, and the game data holds no table of language names to check them
 * against.
 *
 * The game does not read the field at all -- wiki issue 0057 -- so a wrong word
 * costs no import. What it costs is the editor's own instruction to itself:
 * reloading such a file fetches no table, and the palette has nothing to offer.
 * So the difference is shown rather than hidden, and a player who exports from
 * that client and loads the file is the only thing that moves a language from
 * assumed to measured.
 */

/** How a header spelling is known. `measured` is the other, and needs no name. */
export const ASSUMED = "assumed";

/**
 * Every language offerable for a document written in `language`: the ones the
 * manifest lists, and the document's own first when it is not among them.
 *
 * `manifest` is the parsed file or `null` -- it is fetched, and until it arrives
 * the document's own language is the only one there is to offer.
 *
 * The reasoning is `hideouts.optionsFor`'s, and so is the shape: a document
 * naming a language no table covers must still show what it says it is, and
 * must be able to come back to it. An entry that existed only while it was
 * selected would be a one-way door.
 *
 * The manifest's order is kept rather than sorted, because it is not
 * arbitrary: the measured spellings come first.
 */
export function optionsFor(manifest, language) {
  if (!manifest) return [own(language, false)];
  const listed = manifest.languages;
  if (listed.some((entry) => entry.language === language)) return listed;
  return [own(language, true), ...listed];
}

/**
 * The document's own language, as an entry. `unknown` is what the manifest said
 * about it and not what the document left out, so it is false while there is no
 * manifest to have asked.
 */
function own(language, unknown) {
  return { language, spelling: ASSUMED, unknown };
}

/**
 * Whether the header spelling for a language is assumed rather than measured.
 *
 * What the manifest said, so a language it does not list is not assumed but
 * unheard of -- and neither is anything assumed while there is no manifest to
 * have asked, which is `own`'s reasoning once more.
 */
export function assumed(manifest, language) {
  const entry = manifest?.languages.find(
    (listed) => listed.language === language,
  );
  return entry?.spelling === ASSUMED;
}
