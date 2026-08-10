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
 * An array is a layer carrying a `Generator`, and its doodads are ordinary
 * doodads in that same flat array. So the viewport draws them, the count counts
 * them and the bake emits them without learning anything new; what the layer
 * does differently is that it computes its doodads instead of remembering them.
 *
 * `.hideout` cannot carry any of it, so a document that has been organised is
 * saved through `project.js` -- see wiki/discussions/project-format-and-user-layers.
 */

import * as file from "./file.js";
import * as generator from "./generator.js";

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

/**
 * The parameters one array is computed from, and the id of the layer its
 * doodads are written into. `generator.js` does the computing and documents
 * every field; this is the shape the project file holds.
 *
 * Only the fields the named `type` has are kept, and an unknown type is refused
 * rather than half-read -- the rule `project.js` already applies to its own
 * version. So a `line` never carries a `box` and a reader never has to ask
 * which of two shapes a generator meant.
 */
export class Generator {
  constructor(parameters) {
    const shape = SHAPE_FIELDS[parameters.type];
    if (!shape) {
      throw new Error(`Unknown generator type '${parameters.type}'`);
    }
    for (const field of [...GENERATOR_FIELDS, ...shape]) {
      this[field] = parameters[field];
    }
  }
}

const GENERATOR_FIELDS = [
  "layer",
  "type",
  "source",
  "resolution",
  "rotation",
  "random",
];

/** The geometry each type carries, beside the fields all of them carry. */
const SHAPE_FIELDS = {
  grid: ["box"],
  ellipse: ["box"],
  // `distribution` is "corners" or "edges", and a project written before it
  // existed carries neither -- `generator.js` reads that as "corners", which is
  // what those projects were generated with.
  polygon: ["box", "corners", "distribution"],
  line: ["ends"],
  bezier: ["ends", "controls"],
};

/**
 * Whether a type's geometry is a box, as against the two shapes that are drawn
 * end to end. Asked by the gizmo, which puts a transformer on one and handles on
 * the other, and by the sidebar, which draws the fields of one or the other.
 *
 * Derived from the table above rather than listed a second time: a new shape
 * that carries a box is then a box shape everywhere, by having said so once.
 */
export function carriesBox(type) {
  return Boolean(SHAPE_FIELDS[type]?.includes("box"));
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
    // Array placement: at most one `Generator` per layer, and a layer carrying
    // one owns its doodads -- they are computed from the parameters and not
    // authored, so nothing else may write into that layer.
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
   * A new layer holding an array: the parameters name it, and its doodads are
   * there when this returns.
   */
  addArrayLayer(name, parameters) {
    const layer = this.addLayer(name);
    return this.addGenerator({ ...parameters, layer: layer.id });
  }

  /**
   * Gives a layer that has none a generator, and places the doodads it says.
   * The parameters name their own layer, being what a `Generator` carries.
   */
  addGenerator(parameters) {
    const array = new Generator(parameters);
    this.generators = [...this.generators, array];
    this.regenerate(array.layer);
    return array;
  }

  /**
   * A copy of a layer, placed directly after it, and answered with.
   *
   * **A layer is copied by what makes it.** An ordinary layer is its doodads, so
   * they are copied one for one. An array is its parameters, so those are copied
   * and the doodads computed from them again -- copying the doodads instead
   * would give a layer that looks the same and has forgotten how it got there,
   * which is a detach nobody asked for.
   *
   * The copy is deep, because two arrays are two arrays: a shared `box` object
   * would let a handle dragged on one move the other.
   */
  duplicateLayer(id) {
    const source = this.findLayer(id);
    if (!source) throw new Error(`No layer '${id}' to duplicate`);

    const copy = this.addLayer(`${source.name} copy`);
    copy.visible = source.visible;
    copy.locked = source.locked;
    const after = this.layers.indexOf(source) + 1;
    this.moveLayer(copy.id, after - (this.layers.length - 1));

    const array = this.findGenerator(id);
    if (array) {
      this.addGenerator({ ...structuredClone(array), layer: copy.id });
      return copy;
    }

    this.doodads = [
      ...this.doodads,
      ...this.doodadsIn(id).map(
        (doodad) => new Doodad(doodad.name, doodad.toFields(), copy.id),
      ),
    ];
    return copy;
  }

  /** The generator the layer carries, or `undefined` for an ordinary layer. */
  findGenerator(id) {
    return this.generators.find((array) => array.layer === id);
  }

  /**
   * Swaps an array's parameters for a new set, and answers with them.
   *
   * They go through `Generator`, which is what makes changing a type safe: the
   * fields of the shape being left are dropped rather than lingering, so a
   * `line` cannot carry the `box` it used to be. The doodads are not touched --
   * `regenerate` is a separate step, because the caller may be about to change
   * several things.
   */
  replaceGenerator(parameters) {
    const next = new Generator(parameters);
    if (!this.findGenerator(next.layer)) {
      throw new Error(`Layer '${next.layer}' has no generator`);
    }

    this.generators = this.generators.map((array) =>
      array.layer === next.layer ? next : array,
    );
    return next;
  }

  /**
   * Replaces an array layer's doodads with what its parameters say now.
   *
   * The old ones go: they were derived, and keeping any of them is how a layer
   * ends up with two generations of the same array in it. Position in the flat
   * array does not matter, export order being layer order.
   */
  regenerate(id) {
    const parameters = this.findGenerator(id);
    if (!parameters) throw new Error(`Layer '${id}' has no generator`);

    this.doodads = [
      ...this.doodads.filter((doodad) => doodad.layer !== id),
      ...generator.generate(parameters),
    ];
  }

  /**
   * Drops a layer's generator and keeps its doodads, which makes it an ordinary
   * layer that saves its doodads and can be edited by hand.
   *
   * One way, per wiki/decisions/array-placement.md: the parameters are gone and
   * the doodads are now what the player has.
   */
  detach(id) {
    this.generators = this.generators.filter((array) => array.layer !== id);
  }

  /**
   * Removes a layer and hands its doodads to another one.
   *
   * The doodads are never dropped, and the caller names where they go, because
   * a delete that silently takes four hundred doodads with it is the one
   * mistake this feature can make that a player cannot undo.
   *
   * An array layer is the exception and is handled first, so that deleting one
   * needs no layer to hand doodads to.
   */
  removeLayer(id, keepDoodadsIn) {
    if (this.layers.length < 2) throw new Error("The last layer cannot go");
    if (this.findGenerator(id)) {
      this.removeArrayLayer(id);
      return;
    }
    if (!this.findLayer(keepDoodadsIn)) {
      throw new Error(`No layer '${keepDoodadsIn}' to keep doodads in`);
    }

    this.assign(this.doodadsIn(id), keepDoodadsIn);
    this.layers = this.layers.filter((layer) => layer.id !== id);
  }

  /**
   * An array layer takes its doodads with it. They are derived, so handing them
   * to a neighbour would hand over four hundred objects nobody placed -- see
   * wiki/decisions/array-placement.md. The caller states the number first.
   */
  removeArrayLayer(id) {
    this.doodads = this.doodads.filter((doodad) => doodad.layer !== id);
    this.detach(id);
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
