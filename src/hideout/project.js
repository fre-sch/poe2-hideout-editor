/**
 * The editor's own save format, and the bake that turns it into `.hideout`.
 *
 * `.hideout` holds five fields per doodad and the game parses it, so an extra
 * key is a gamble with a player's hideout. Layers and generators are remembered
 * here instead, and `.hideout` becomes an export target produced from it. see
 * discussions/project-format-and-user-layers.
 *
 * The consequence a player meets is two save actions. see `gui/file.jsx`.
 */

import * as essentials from "./essentials.js";
import * as file from "./file.js";
import { Doodad, Generator, HideoutDocument, Layer } from "./model.js";

const FORMAT = "poe2-hideout-editor-project";

/**
 * The format this build reads and writes. A file carrying anything else is
 * refused rather than partially read: a project half-read is a layout
 * half-lost, and the file still loads whole in the build that matches.
 *
 * An added field does not move it. Constructors name their fields, so this
 * build fills in what an older file leaves out and an older build drops what it
 * does not read. The version is for a change that would be misread.
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
  const document_ = new HideoutDocument(
    readHeader(data.hideout),
    readDoodads(data.doodads, layers),
    layers,
    readGenerators(data.generators ?? [], layers),
  );
  return expand(document_);
}

/**
 * The document as project text.
 *
 * `generators` carries the parameters of every array; an array's doodads are
 * not written, being computed from those parameters on load. Writing both would
 * write a claim that can disagree with them. see decisions/array-placement.
 */
export function serialize(document_) {
  return JSON.stringify(
    {
      format: FORMAT,
      format_version: FORMAT_VERSION,
      hideout: pick(document_.header, HEADER_FIELDS),
      layers: document_.layers.map((layer) => ({ ...layer })),
      doodads: authoredDoodads(document_).map(toEntry),
      generators: document_.generators.map((array) => ({ ...array })),
    },
    null,
    2,
  );
}

/**
 * The document as `.hideout` text: visible layers walked in order, doodads
 * within a layer in the order they are held, emitted as `[name, fields]` pairs.
 *
 * A hidden layer is left out and keeps its place in the project file, see
 * issues/0026. `locked` is not consulted at all.
 */
export function bake(document_) {
  return file.serialize({
    ...document_.header,
    doodads: document_
      .exportedDoodads()
      .map((doodad) => [doodad.name, doodad.toFields()]),
  });
}

/**
 * What the bake would cost against the Doodad Limit.
 *
 * Counted here and nowhere else: generators mean the number is not known until
 * the project is baked, and the game truncates silently in file order, so the
 * moment before the download is the only place to catch it.
 *
 * Counts what the bake writes, hidden layers excluded, so the warning is about
 * the file the player is about to hand the game.
 */
export function count(document_) {
  const doodads = document_.exportedDoodads();
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
 * reader cannot resolve, so it says so. Guessing would hide a broken file until
 * the player wondered where their organisation went.
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

/**
 * One generator per layer, naming a layer the project lists. Two generators
 * over one layer is two answers to what its doodads are.
 *
 * An unknown `type` is refused by `Generator` itself. Nothing is loaded in any
 * of these cases: the document is built and returned in one expression.
 */
function readGenerators(generators, layers) {
  if (!Array.isArray(generators)) {
    throw new Error("Project's generators are not a list");
  }

  const known = new Set(layers.map((layer) => layer.id));
  const taken = new Set();
  return generators.map((entry) => {
    if (!known.has(entry.layer)) {
      throw new Error(`Generator is in unknown layer '${entry.layer}'`);
    }
    if (taken.has(entry.layer)) {
      throw new Error(`Layer '${entry.layer}' has more than one generator`);
    }
    taken.add(entry.layer);
    return new Generator(entry);
  });
}

/** The generated doodads, which the file does not carry. */
function expand(document_) {
  for (const array of document_.generators) {
    document_.regenerate(array.layer);
  }
  return document_;
}

/**
 * The doodads the project file writes: those of the layers carrying no
 * generator. An array layer's are computed on load, so writing them would write
 * the same doodads twice and let the two copies drift apart.
 */
function authoredDoodads(document_) {
  const generated = new Set(document_.generators.map((array) => array.layer));
  return document_
    .orderedDoodads()
    .filter((doodad) => !generated.has(doodad.layer));
}

function toEntry(doodad) {
  return { name: doodad.name, ...doodad.toFields(), layer: doodad.layer };
}

function pick(object_, fields) {
  return Object.fromEntries(fields.map((field) => [field, object_[field]]));
}
