/**
 * The document the editor edits: a hideout file's header, passed through
 * untouched, its doodads as one flat array, and the user layers those doodads
 * are organised into.
 *
 * Flat is the point. The 3D editor kept doodads in a scene graph that its
 * transform control re-parented them out of, and a doodad that lived in two
 * places at once is the direct cause of wiki issues 0001 and 0005. An array has
 * nowhere else to put anything.
 *
 * Layers do not change that. A layer is a name a doodad carries, not a
 * collection it lives in -- `layer` is a field on `Doodad` and `layers` is a
 * list of labels. Membership is therefore impossible to lose track of, and
 * export order is a walk over the same one array.
 *
 * `.hideout` cannot carry any of it, so a document that has been organised is
 * saved through `project.js` -- see wiki/discussions/project-format-and-user-layers.
 */

import * as file from "./file.js";

const DOODAD_FIELDS = ["hash", "x", "y", "r", "fv"];

/**
 * One placed object. `name` is its localized display name and is not unique --
 * a hideout holds hundreds of doodads under the same name, which is the whole
 * reason `file.js` exists. Identity is the object, not any field of it.
 *
 * `layer` is the id of the layer it belongs to, and is editor state: the game's
 * file has no room for it.
 */
export class Doodad {
  constructor(name, fields, layer) {
    this.name = name;
    for (const field of DOODAD_FIELDS) {
      this[field] = fields[field];
    }
    this.layer = layer;
  }

  /** The five fields, in file order. */
  toFields() {
    return Object.fromEntries(
      DOODAD_FIELDS.map((field) => [field, this[field]]),
    );
  }
}

/**
 * A user layer: a name to organise by, and two flags the viewport obeys.
 *
 * `visible` reaches the export: a hidden layer is left out of the `.hideout`,
 * which is how a player tries a layout two ways without deleting half of it.
 * `locked` reaches nothing but the mouse. Neither reaches the project file,
 * which keeps every layer whatever its flags say.
 */
export class Layer {
  constructor({ id, name, visible = true, locked = false }) {
    this.id = id;
    this.name = name;
    this.visible = visible;
    this.locked = locked;
  }
}

export class HideoutDocument {
  /**
   * `header` is whatever the file said, kept verbatim. The editor knows the
   * hideout type it is drawing bounds for, but that is a viewport concern and
   * must not reach back into the saved header: the 3D editor rewrote
   * `hideout_name` from its own table and wrote the typo "Limestone Hideoout"
   * into player files, wiki issue 0009.
   */
  constructor(header, doodads, layers, generators = []) {
    this.header = header;
    this.doodads = doodads;
    this.layers = layers;
    // Reserved for array placement. Carried and never inspected, so that the
    // slot exists before the feature does and a project saved by a later build
    // is not quietly emptied by an earlier one.
    this.generators = generators;
  }

  /**
   * A plain `.hideout` becomes a document of one layer named after the hideout.
   * No modes, no prompt -- every document has layers, and a file that carries
   * none simply arrives with one.
   */
  static fromText(text) {
    const { doodads, ...header } = file.parse(text);
    const layer = new Layer({
      id: "default",
      name: header.hideout_name || "Hideout",
    });
    return new HideoutDocument(
      header,
      doodads.map(([name, fields]) => new Doodad(name, fields, layer.id)),
      [layer],
    );
  }

  findLayer(id) {
    return this.layers.find((layer) => layer.id === id);
  }

  doodadsIn(id) {
    return this.doodads.filter((doodad) => doodad.layer === id);
  }

  /**
   * The doodads in export order: layer by layer, and within a layer in the
   * order the array already holds them.
   *
   * Order is what the game truncates by when the Doodad Limit is exceeded, so
   * moving a layer up is how a player says which doodads matter.
   */
  orderedDoodads() {
    return this.layers.flatMap((layer) => this.doodadsIn(layer.id));
  }

  /**
   * The doodads an export writes: the same walk, over the visible layers only.
   *
   * Hiding is how a player tries a layout two ways, so it reaches the export
   * and `locked` does not -- see wiki issue 0026. The document keeps the hidden
   * layers and so does the project file; one export leaves them out.
   */
  exportedDoodads() {
    return this.layers
      .filter((layer) => layer.visible)
      .flatMap((layer) => this.doodadsIn(layer.id));
  }

  /** A new empty layer, on top of the list, with an id no other layer has. */
  addLayer(name) {
    const layer = new Layer({ id: this.freeLayerId(), name });
    this.layers = [...this.layers, layer];
    return layer;
  }

  /**
   * Removes a layer and hands its doodads to another one.
   *
   * The doodads are never dropped, and the caller names where they go, because
   * a delete that silently takes four hundred doodads with it is the one
   * mistake this feature can make that a player cannot undo.
   */
  removeLayer(id, keepDoodadsIn) {
    if (this.layers.length < 2) throw new Error("The last layer cannot go");
    if (!this.findLayer(keepDoodadsIn)) {
      throw new Error(`No layer '${keepDoodadsIn}' to keep doodads in`);
    }

    this.assign(this.doodadsIn(id), keepDoodadsIn);
    this.layers = this.layers.filter((layer) => layer.id !== id);
  }

  /** Moves a layer `offset` places along the list, clamped to its ends. */
  moveLayer(id, offset) {
    const from = this.layers.findIndex((layer) => layer.id === id);
    if (from < 0) return;

    const to = clamp(from + offset, 0, this.layers.length - 1);
    const layers = [...this.layers];
    layers.splice(to, 0, ...layers.splice(from, 1));
    this.layers = layers;
  }

  assign(doodads, id) {
    for (const doodad of doodads) {
      doodad.layer = id;
    }
  }

  freeLayerId() {
    let number = this.layers.length + 1;
    while (this.findLayer(`layer-${number}`)) {
      number++;
    }
    return `layer-${number}`;
  }
}

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}
