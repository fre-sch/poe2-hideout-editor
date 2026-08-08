/**
 * The editor's own save format, and the bake that turns it into `.hideout`.
 *
 * `.hideout` holds five fields per doodad and nothing else, and the game parses
 * it, so an extra key is a gamble that costs a player their hideout. Anything
 * the editor wants to remember beyond position and rotation -- layers now,
 * generators later -- is remembered here instead, and `.hideout` becomes an
 * export target produced from it. See
 * wiki/discussions/project-format-and-user-layers.md.
 *
 * The consequence a player meets is two save actions, and `gui/file.jsx` is
 * where that is made hard to get wrong.
 */

import * as essentials from "./essentials.js";
import * as file from "./file.js";
import { Doodad, HideoutDocument, Layer } from "./model.js";

const FORMAT = "poe2-hideout-editor-project";

/**
 * The format this build reads and writes. An integer, and a file carrying
 * anything else is refused rather than partially read: a project half-read is a
 * layout half-lost, and the player still has the file that would have loaded
 * whole in a later build.
 */
const FORMAT_VERSION = 1;

/** The game's limit on *placed* doodads. Essentials do not count, see there. */
export const DOODAD_LIMIT = 750;

const HEADER_FIELDS = ["version", "language", "hideout_name", "hideout_hash"];

/** Whether text is a project file rather than a `.hideout`, without parsing it. */
export function looksLikeProject(text) {
  return /"format"\s*:\s*"poe2-hideout-editor-project"/.test(
    file.stripBom(text),
  );
}

export function parse(text) {
  const data = JSON.parse(file.stripBom(text));
  if (data.format !== FORMAT) {
    throw new Error(`Not a hideout editor project: '${data.format}'`);
  }
  if (data.format_version !== FORMAT_VERSION) {
    throw new Error(
      `Project format version ${data.format_version} is not version ` +
        `${FORMAT_VERSION}, which this editor reads. Nothing was loaded.`,
    );
  }

  const layers = readLayers(data.layers);
  return new HideoutDocument(
    readHeader(data.hideout),
    readDoodads(data.doodads, layers),
    layers,
    data.generators ?? [],
  );
}

/**
 * The document as project text.
 *
 * `generators` is written empty and read back untouched. It is the slot the
 * array placement feature plugs into, and a slot that disappears on the first
 * save is not a slot -- see wiki/discussions/project-format-and-user-layers.
 */
export function serialize(document_) {
  return JSON.stringify(
    {
      format: FORMAT,
      format_version: FORMAT_VERSION,
      hideout: pick(document_.header, HEADER_FIELDS),
      layers: document_.layers.map((layer) => ({ ...layer })),
      doodads: document_.orderedDoodads().map(toEntry),
      generators: document_.generators,
    },
    null,
    2,
  );
}

/**
 * The document as `.hideout` text: layers walked in order, doodads within a
 * layer in the order they are held, emitted as `[name, fields]` pairs.
 *
 * Visibility and lock are not consulted. A hidden layer is hidden, not deleted.
 */
export function bake(document_) {
  return file.serialize({
    ...document_.header,
    doodads: document_
      .orderedDoodads()
      .map((doodad) => [doodad.name, doodad.toFields()]),
  });
}

/**
 * What the bake would cost against the Doodad Limit.
 *
 * Counted here and nowhere else, because generators mean the number is not
 * known until the project is baked. The game truncates silently in file order,
 * so the moment before the download is the only place a player can catch it.
 */
export function count(document_) {
  const doodads = document_.orderedDoodads();
  const placed = essentials.countPlaced(doodads);
  return {
    total: doodads.length,
    placed,
    essential: doodads.length - placed,
    limit: DOODAD_LIMIT,
    exceeded: placed > DOODAD_LIMIT,
  };
}

function readHeader(hideout) {
  if (!hideout) throw new Error("Project has no hideout header");
  return pick(hideout, HEADER_FIELDS);
}

function readLayers(layers) {
  if (!Array.isArray(layers) || layers.length === 0) {
    throw new Error("Project has no layers");
  }
  return layers.map((layer) => new Layer(layer));
}

/**
 * A doodad naming a layer the project does not list is a contradiction the
 * reader cannot resolve, so it says so. Guessing a layer for it would hide a
 * broken file until the player wondered where their organisation went.
 */
function readDoodads(doodads, layers) {
  if (!Array.isArray(doodads)) throw new Error("Project has no doodads");

  const known = new Set(layers.map((layer) => layer.id));
  return doodads.map((entry) => {
    if (!known.has(entry.layer)) {
      throw new Error(
        `Doodad '${entry.name}' is in unknown layer '${entry.layer}'`,
      );
    }
    return new Doodad(entry.name, entry, entry.layer);
  });
}

function toEntry(doodad) {
  return { name: doodad.name, ...doodad.toFields(), layer: doodad.layer };
}

function pick(object_, fields) {
  return Object.fromEntries(fields.map((field) => [field, object_[field]]));
}
