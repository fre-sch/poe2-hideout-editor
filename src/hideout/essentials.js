/**
 * The doodads the game places itself, which the Doodad Limit does not count.
 *
 * The limit is 750 *placed* doodads. Essentials sit outside it -- measured in
 * game, not inferred: with 750 probes and 18 essentials present the game
 * refuses the next placement and names 750, see
 * wiki/discussions/bounds-by-probe-grid.md. Counting them against the limit
 * would warn a player about a file the game accepts.
 *
 * The set changes between patches, so this table is a snapshot and not a truth:
 * it is what the game injected into an empty-doodad import of Shrine Hideout on
 * 2026-08-07, which is how such a list is derived (wiki issue 0014). An
 * essential the table has forgotten is counted against the limit, so a stale
 * table warns too early rather than too late. That is the safe direction, and
 * it is why the warning states the count rather than blocking the export.
 */

const ESSENTIAL_HASHES = new Set([
  3230065491, // Stash
  139228481, // Guild Stash
  1224707366, // Waypoint
  76459657, // Ziggurat Map Device
  12969733, // Relic Locker
  3263423625, // Reforging Bench
  3734046884, // Salvage Bench
  2057229261, // Well
  2914603195, // Wardrobe Decoration
  2920892519, // Verisium Anvil
  2297799330, // Ange
  2115859440, // Alva
  1023253651, // Zelina
  2204408127, // Zolin
  3673653565, // Doryani
  1986775202, // Hilda
  204349116, // Jado
  434172762, // Farrow
]);

export function isEssential(doodad) {
  return ESSENTIAL_HASHES.has(doodad.hash);
}

/** How many of these doodads the Doodad Limit counts. */
export function countPlaced(doodads) {
  return doodads.filter((doodad) => !isEssential(doodad)).length;
}
