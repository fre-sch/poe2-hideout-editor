/**
 * The doodads the game places itself, which the Doodad Limit does not count.
 * see specifications/game-facts, "Essential doodads".
 *
 * A snapshot, not a truth: the set changes between patches, and this is what
 * the game injected into an empty-doodad import of Shrine Hideout on
 * 2026-08-07. see issues/0014.
 *
 * A forgotten essential is counted, so a stale table warns too early rather
 * than too late -- which is why the warning states the count rather than
 * blocking the export.
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
