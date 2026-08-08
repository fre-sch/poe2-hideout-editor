/**
 * The table of everything that can be placed, in one language.
 *
 * It is built from a `public/doodads/{language}.json` file, generated from the
 * game's own data by `scripts/doodad_palette.py` -- see
 * wiki/decisions/doodad-palette.md. This module reads that data and answers the
 * three questions the palette asks of it: what is there, what matches what the
 * player typed, and is this table the one the document is written in.
 *
 * Fetching the file is not here, for the same reason `viewport/bounds.js`
 * fetches and `hideout/bounds.js` does not: the domain layer is framework-free
 * by rule -- wiki issue 0011.
 *
 * ### Why the language question exists at all
 *
 * A `.hideout` names every doodad, the game validates that name against the
 * file's `language`, and it rejects an import that disagrees. So a name is
 * looked up or copied and never derived, and a table loaded for the wrong
 * language is worse than no table: it writes a file the game refuses. The
 * document itself is the test -- it arrives carrying hundreds of names the game
 * wrote -- and `disagreements` is that test.
 */

/**
 * The synthetic tag for the 52 doodads that carry none. Grouping is by
 * category, which is lossless, so this is a filter and not a heading -- but
 * without it those 52 are the only ones no toggle can reach.
 */
export const UNTAGGED = "Untagged";

export class Palette {
  /** `data` is a parsed `public/doodads/{language}.json`. */
  constructor(data) {
    this.language = data.language;
    this.entries = readEntries(data);
    this.byHash = new Map(this.entries.map((entry) => [entry.hash, entry]));
    this.tags = readTags(data.t9nTags);
  }

  /**
   * The entry for a doodad `hash`, or `undefined`.
   *
   * Keyed by string because a hash arrives as a number from a parsed file and
   * as a string from the generated table, the same as `bounds.find`.
   */
  find(hash) {
    return this.byHash.get(`${hash}`);
  }

  /**
   * What to show, as `[{ category, entries }]` in category order.
   *
   * `text` matches the displayed name, because that is what a player has in
   * front of them to type. `tags` is a set of tag keys, and an empty one is
   * not a filter that excludes everything -- it is no filter at all.
   */
  groups({ text = "", tags = new Set() } = {}) {
    const wanted = text.trim().toLocaleLowerCase();
    const matching = this.entries.filter(
      (entry) => matchesText(entry, wanted) && matchesTags(entry, tags),
    );
    return groupByCategory(matching);
  }

  /**
   * The document's doodads that this table calls something else.
   *
   * One report per hash, because a hideout holds the same doodad dozens of
   * times and a list saying so dozens of times says nothing more. `checked` is
   * how many doodads the table recognised at all: a doodad the table does not
   * know -- an essential the game places itself, say -- is no evidence either
   * way.
   *
   * Nothing to check is not the same as disagreement, and the caller is left to
   * say which it has. A hideout with nothing placed in it yet is exactly where
   * placing matters most, and refusing it for lack of samples would be refusing
   * the empty hideout in particular.
   */
  disagreements(doodads) {
    const reports = new Map();
    let checked = 0;

    for (const doodad of doodads) {
      const entry = this.find(doodad.hash);
      if (!entry) continue;

      checked++;
      if (entry.name === doodad.name) continue;
      reports.set(entry.hash, {
        hash: entry.hash,
        name: doodad.name,
        expected: entry.name,
      });
    }
    return { checked, reports: [...reports.values()] };
  }
}

/**
 * The entries, with the category translated and the tags left as keys: a
 * category is read by the player and a tag is matched against a toggle.
 *
 * A name is not unique -- 34 English names cover 74 doodads, seven of them
 * `Warp Rune` -- so an entry sharing its name carries a `distinguisher`, the
 * last segment of its metadata id. Only the ones that share, because 1730 rows
 * of metadata id is noise obscuring the 34 places it is the answer.
 */
function readEntries(data) {
  const entries = Object.entries(data.doodads).map(([hash, doodad]) => ({
    ...doodad,
    hash,
    category: data.t9nCategory[doodad.category] ?? doodad.category,
  }));

  const shared = sharedNames(entries);
  for (const entry of entries) {
    if (shared.has(entry.name)) entry.distinguisher = lastSegment(entry.id);
  }
  return entries.sort(byNameThenId);
}

function sharedNames(entries) {
  const seen = new Set();
  const shared = new Set();
  for (const entry of entries) {
    if (seen.has(entry.name)) shared.add(entry.name);
    seen.add(entry.name);
  }
  return shared;
}

function lastSegment(id) {
  return id.slice(id.lastIndexOf("/") + 1);
}

/** The tag toggles: every tag the table translates, and `Untagged` besides. */
function readTags(t9nTags) {
  const tags = Object.entries(t9nTags).map(([key, name]) => ({ key, name }));
  return [...tags.sort(byName), { key: UNTAGGED, name: UNTAGGED }];
}

function matchesText(entry, text) {
  if (text === "") return true;
  return entry.name.toLocaleLowerCase().includes(text);
}

function matchesTags(entry, tags) {
  if (tags.size === 0) return true;
  if (entry.tags.length === 0) return tags.has(UNTAGGED);
  return entry.tags.some((tag) => tags.has(tag));
}

function groupByCategory(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.category)) groups.set(entry.category, []);
    groups.get(entry.category).push(entry);
  }
  return [...groups]
    .map(([category, grouped]) => ({ category, entries: grouped }))
    .sort((one, other) => one.category.localeCompare(other.category));
}

function byName(one, other) {
  return one.name.localeCompare(other.name);
}

/**
 * By name, and by metadata id where two share one. The id is what tells those
 * apart on screen, so it is what orders them -- the seven `Warp Rune` rows then
 * read blue, green, orange, rather than in the order a table happened to be
 * written in.
 */
function byNameThenId(one, other) {
  return byName(one, other) || one.id.localeCompare(other.id);
}
