/**
 * The table of everything that can be placed, in one language.
 *
 * It is built from a `public/doodads/{language}.json` file, generated from the
 * game's own data by `scripts/editor_data.py` -- see
 * wiki/decisions/doodad-palette.md. This module reads that data and answers the
 * three questions the palette asks of it: what is there, what matches what the
 * player typed, and is this table the one the document is written in.
 *
 * The table names every hash a hideout can contain, which is more than a player
 * may place: art the developers marked as not shipping, categories no Path of
 * Exile 2 hideout offers, and the doodads the game places itself. `placeable`
 * is what tells them apart, and it is a question this module asks -- naming a
 * doodad and offering it are different things, and a hash the table cannot name
 * is a doodad the editor can only show as a number.
 *
 * Fetching the file is not here, for the same reason `viewport/bounds.js`
 * fetches and `hideout/bounds.js` does not: the domain layer is framework-free
 * by rule -- wiki issue 0011.
 *
 * ### Why the language question exists at all
 *
 * A `.hideout` names every doodad in one language, and the editor has only the
 * `language` field's word for which. The game itself does not care -- it reads
 * the hashes and imports a file whose keys are empty, measured 2026-08-11 --
 * but everything on this side does: a table loaded for the wrong language shows
 * a player one word and writes another beside it, in a file that then names the
 * same doodad two ways. A name is looked up or copied and never derived.
 *
 * The document is the test, because it arrives carrying hundreds of names the
 * game wrote, and `disagreements` is that test. Three answers, and the caller
 * tells them apart by how many: a handful is a file edited by hand or exported
 * before a doodad was renamed, wholesale is the wrong table.
 */

/**
 * The synthetic tag for the doodads that carry none. Grouping is by category,
 * which is lossless, so this is a filter and not a heading -- but without it
 * those doodads are the only ones no toggle can reach.
 */
export const UNTAGGED = "Untagged";

/**
 * The two things a category or tag filter can say about a key. The third state
 * is saying nothing, which is a key the filter does not hold -- there is no
 * `UNSET` value, because an unset key is one nobody has touched.
 *
 * `INCLUDE` is what a player reaches for first -- show me these -- and reads as
 * OR, because a doodad carrying any of the wanted tags is wanted. `EXCLUDE` is
 * stronger than any include: a player who says "not NPCs" means it, whatever
 * else the doodad is tagged with.
 */
export const INCLUDE = "include";
export const EXCLUDE = "exclude";

export class Palette {
  /**
   * `data` is a parsed `public/doodads/{language}.json`.
   *
   * `entries` is every hash the table names and `placeable` is the part of it
   * the palette offers. The filters and the list are built from the second,
   * `find` and `disagreements` answer out of the first: what a doodad is called
   * is worth knowing about a doodad nobody may place.
   */
  constructor(data) {
    this.language = data.language;
    this.entries = readEntries(data);
    this.byHash = new Map(this.entries.map((entry) => [entry.hash, entry]));
    this.placeable = this.entries.filter((entry) => entry.placeable);
    distinguishShared(this.placeable);
    this.tags = readTags(data.t9nTags, this.placeable);
    this.categories = readCategories(this.placeable);
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
   * What to show, as `[{ key, category, entries }]` in category order.
   *
   * `text` matches the displayed name, because that is what a player has in
   * front of them to type. `categories` and `tags` are `Map`s of key to
   * `INCLUDE` or `EXCLUDE`; a key not in the map is `UNSET`, and a map holding
   * nothing is not a filter that excludes everything -- it is no filter at all.
   *
   * The two filters are read together: a doodad shows when its category and
   * its tags both allow it. They answer different questions -- where a doodad
   * is from, and what it is -- so a player narrowing both means both.
   *
   * Only what is placeable, and that is not a filter a player can turn off:
   * the rest is in the table to be named, not to be offered.
   */
  groups({ text = "", categories = new Map(), tags = new Map() } = {}) {
    const wanted = text.trim().toLocaleLowerCase();
    const matching = this.placeable.filter(
      (entry) =>
        matchesText(entry, wanted) &&
        allows(categories, [entry.categoryKey]) &&
        allows(tags, tagKeys(entry)),
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
 */
function readEntries(data) {
  return Object.entries(data.doodads)
    .map(([hash, doodad]) => ({
      ...doodad,
      hash,
      categoryKey: doodad.category,
      category: data.t9nCategory[doodad.category] ?? doodad.category,
    }))
    .sort(byNameThenId);
}

/**
 * A name is not unique -- three English names cover twelve doodads, seven of
 * them `Warp Rune` -- so an entry sharing its name carries a `distinguisher`,
 * the last segment of its metadata id. Only the ones that share, because a
 * metadata id on every row is noise obscuring the few places it is the answer.
 *
 * Asked of what the palette offers rather than of the whole table: two rows
 * that read alike are a choice a player cannot make, and a player is never
 * shown the rest.
 */
function distinguishShared(entries) {
  const shared = sharedNames(entries);
  for (const entry of entries) {
    if (shared.has(entry.name)) entry.distinguisher = lastSegment(entry.id);
  }
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

/**
 * The tag filters: every tag the table translates, and `Untagged` besides --
 * the last only where there is something untagged to reach with it.
 */
function readTags(t9nTags, entries) {
  const tags = Object.entries(t9nTags).map(([key, name]) => ({ key, name }));
  tags.sort(byName);
  if (entries.some((entry) => entry.tags.length === 0)) {
    tags.push({ key: UNTAGGED, name: UNTAGGED });
  }
  return tags;
}

/**
 * The category filters, read off the entries rather than off `t9nCategory`.
 *
 * The generated table translates only the categories its doodads are in, and a
 * filter for a category holding nothing is a row that can only ever empty the
 * list.
 */
function readCategories(entries) {
  const categories = new Map();
  for (const entry of entries) {
    categories.set(entry.categoryKey, entry.category);
  }
  return [...categories].map(([key, name]) => ({ key, name })).sort(byName);
}

function matchesText(entry, text) {
  if (text === "") return true;
  return entry.name.toLocaleLowerCase().includes(text);
}

/** What a tag filter matches an entry on: its tags, or being untagged. */
function tagKeys(entry) {
  if (entry.tags.length === 0) return [UNTAGGED];
  return entry.tags;
}

/**
 * Whether a tri-state filter lets an entry carrying `keys` through.
 *
 * One exclude is enough to drop it, whatever else it carries. Past that, an
 * include anywhere in the filter turns it into a list of what to show, and an
 * entry has to be on it.
 */
function allows(filter, keys) {
  if (keys.some((key) => filter.get(key) === EXCLUDE)) return false;
  if (!hasInclude(filter)) return true;
  return keys.some((key) => filter.get(key) === INCLUDE);
}

function hasInclude(filter) {
  for (const state of filter.values()) {
    if (state === INCLUDE) return true;
  }
  return false;
}

function groupByCategory(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.categoryKey)) {
      groups.set(entry.categoryKey, { category: entry.category, entries: [] });
    }
    groups.get(entry.categoryKey).entries.push(entry);
  }
  return [...groups]
    .map(([key, group]) => ({ key, ...group }))
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
