/**
 * The document the editor edits: a hideout file's header, passed through
 * untouched, its doodads as one flat array, and the user layers those doodads
 * are organised into.
 *
 * Flat is the point: an array has nowhere else to put a doodad. see
 * decisions/transform-control-reparenting.
 *
 * A layer is a name a doodad carries, not a collection it lives in -- `layer`
 * is a field on `Doodad` and `layers` is a list of labels. So membership cannot
 * be lost track of, and export order is a walk over the one array.
 *
 * An array is a layer carrying a `Generator`, its doodads ordinary doodads in
 * that same array. Drawing, counting and baking learn nothing new; the layer
 * computes its doodads instead of remembering them.
 *
 * `.hideout` carries none of it, so an organised document is saved through
 * `project.js`. see discussions/project-format-and-user-layers.
 */

import * as colors from "./colors.js";
import * as file from "./file.js";
import * as generator from "./generator.js";

const DOODAD_FIELDS = ["hash", "x", "y", "r", "fv"];

/**
 * One placed object. `name` is its localized display name and is not unique, so
 * identity is the object rather than any field of it.
 *
 * `layer` is the id of the layer it belongs to, and is editor state.
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
 * A user layer: a name to organise by, a colour its doodads are drawn in, and
 * two flags the viewport obeys.
 *
 * `visible` reaches the export -- a hidden layer is left out of the `.hideout`.
 * `locked` reaches nothing but the mouse. Neither reaches the project file.
 *
 * `color` arrives from the document rather than defaulting here: a useful
 * colour is one no other layer carries, and a layer knows of no other layer.
 * see `HideoutDocument.colorLayers`.
 *
 * `group` is the name of the layer group this layer moves with, or `null` --
 * the same arrangement one level up, a group being the layers carrying the
 * name. So deleting a layer takes its membership with it. see
 * decisions/layer-groups.
 */
export class Layer {
  constructor({
    id,
    name,
    color = null,
    group = null,
    visible = true,
    locked = false,
  }) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.group = group;
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
 * rather than half-read. So a `line` never carries a `box`.
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
    sharedVariationsToSource(this);
  }
}

const GENERATOR_FIELDS = [
  "layer",
  "type",
  "source",
  "pick",
  "resolution",
  "rotation",
  "random",
];

/**
 * A project written before variations were the source doodad's carries one list
 * for the whole array in `random.variation`. Read as those indices for every
 * source doodad, then dropped, so a variation comes from one place. see
 * issues/0051.
 *
 * An entry that already has a list keeps it, so this is safe to run on every
 * `Generator` rather than only on a file being read.
 */
function sharedVariationsToSource(generator) {
  const shared = generator.random?.variation;
  if (!shared) return;

  const { variation, ...random } = generator.random;
  generator.random = random;
  if (shared.length === 0) return;

  generator.source = generator.source.map((entry) => ({
    variation: [...shared],
    ...entry,
  }));
}

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
 * Whether a type's geometry is a box, as against the shapes drawn end to end.
 * Asked by the gizmo and by the sidebar, which draw one or the other.
 *
 * Derived from the table above rather than listed again, so a new box shape is
 * a box shape everywhere by having said so once.
 */
export function carriesBox(type) {
  return Boolean(SHAPE_FIELDS[type]?.includes("box"));
}

/**
 * The shape half of a set of parameters: the fields its type carries, and none
 * of the fields every type carries.
 *
 * What a rigid move rewrites, and therefore what a caller moving one writes
 * back -- see `arrays.moved`. Read off the same table as `carriesBox`, so a
 * shape that is added is moved by having been listed once.
 */
export function shapeOf(parameters) {
  return Object.fromEntries(
    (SHAPE_FIELDS[parameters.type] ?? []).map((field) => [
      field,
      parameters[field],
    ]),
  );
}

export class HideoutDocument {
  /**
   * `header` is whatever the file said, kept verbatim. The hideout type the
   * viewport draws bounds for must not reach back into it. see issues/0009.
   */
  constructor(header, doodads, layers, generators = []) {
    this.header = header;
    this.doodads = doodads;
    this.layers = layers;
    // Array placement: at most one `Generator` per layer, and a layer carrying
    // one owns its doodads -- they are computed from the parameters and not
    // authored, so nothing else may write into that layer.
    this.generators = generators;
    this.colorLayers();
    // A group is drawn as a run of rows, and a project file may hold its members
    // anywhere. Reading one is where that is put right, once.
    this.tidyGroups();
  }

  /**
   * A colour for every layer that arrived without one. In order, so each is
   * chosen against the ones already settled and no two layers share one.
   */
  colorLayers() {
    for (const layer of this.layers) {
      layer.color = layer.color ?? this.freeColor();
    }
  }

  /** A colour no layer of this document carries. */
  freeColor() {
    return colors.generate(this.layers.map((layer) => layer.color));
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
   * The layers moving with this one: its group, or the layer alone. Every
   * caller asks "what moves when I move this", and an ungrouped layer is a
   * group of one. In layer order.
   */
  groupOf(id) {
    const layer = this.findLayer(id);
    if (!layer) return [];
    if (layer.group === null) return [layer];

    return this.layersInGroup(layer.group);
  }

  layersInGroup(name) {
    return this.layers.filter((layer) => layer.group === name);
  }

  /** Every group name in use, in layer order, each once. */
  groupNames() {
    return [
      ...new Set(
        this.layers
          .map((layer) => layer.group)
          .filter((name) => name !== null && name !== undefined),
      ),
    ];
  }

  /**
   * The layers as the panel draws them: one entry per group and one per
   * ungrouped layer, `{ group, layers }`, in layer order. A group's entry stands
   * where its first member does and holds every member.
   *
   * The tree the layer list is, said once rather than rebuilt wherever a group
   * has to be stepped over: moving, drawing and tidying are the same walk. see
   * decisions/layer-groups.
   */
  layerOutline() {
    const entries = [];
    const seen = new Set();
    for (const layer of this.layers) {
      const name = layer.group ?? null;
      if (name === null) {
        entries.push({ group: null, layers: [layer] });
        continue;
      }
      if (seen.has(name)) continue;

      seen.add(name);
      entries.push({ group: name, layers: this.layersInGroup(name) });
    }
    return entries;
  }

  /**
   * Gathers each group's layers where its first member stands, leaving every
   * other layer where it is.
   *
   * A group is drawn as a run of rows, so it has to be one, and the tidying is
   * the outline flattened. Run on load and after every membership change.
   */
  tidyGroups() {
    this.layers = this.layerOutline().flatMap((entry) => entry.layers);
  }

  /**
   * Puts a layer in a group, or takes it out of one for `null`, and tidies --
   * joining a group is what moves a layer next to that group's others.
   */
  groupLayer(id, name) {
    const layer = this.findLayer(id);
    if (!layer) return;

    layer.group = name;
    this.tidyGroups();
  }

  /**
   * Renames a group by writing the name on every member, there being nothing
   * else a group is. Renaming onto a name already in use merges the two, which
   * is what sharing a name means when the name is the group.
   */
  renameGroup(name, renamed) {
    for (const layer of this.layersInGroup(name)) {
      layer.group = renamed;
    }
    this.tidyGroups();
  }

  /**
   * A copy of every layer of a group, in a group of its own.
   *
   * `duplicateLayer` copies the group name, which is right for one layer and
   * wrong for all of them -- the copies would join the original rather than
   * stand beside it. So they are renamed to a free name.
   */
  duplicateGroup(name) {
    const copies = this.layersInGroup(name).map((layer) =>
      this.duplicateLayer(layer.id),
    );
    const renamed = this.freeGroupName(`${name} copy`);
    for (const copy of copies) {
      copy.group = renamed;
    }
    this.tidyGroups();
    return copies;
  }

  /** A group name no group carries, from a name that may be taken. */
  freeGroupName(name) {
    const taken = new Set(this.groupNames());
    if (!taken.has(name)) return name;

    let number = 2;
    while (taken.has(`${name} ${number}`)) {
      number++;
    }
    return `${name} ${number}`;
  }

  /**
   * Removes every layer of a group, handing the doodads to a layer outside it.
   *
   * Outside it, because a layer of the group being deleted is about to be
   * deleted too, and the doodads would go round once and then vanish.
   */
  removeGroup(name, keepDoodadsIn) {
    const target = this.findLayer(keepDoodadsIn);
    if (!target)
      throw new Error(`No layer '${keepDoodadsIn}' to keep doodads in`);
    if (target.group === name) {
      throw new Error(`Layer '${keepDoodadsIn}' is in the group being deleted`);
    }

    for (const layer of this.layersInGroup(name)) {
      this.removeLayer(layer.id, keepDoodadsIn);
    }
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
   * Hiding reaches the export and `locked` does not, see issues/0026. The
   * document and the project file keep the hidden layers; the export omits
   * them.
   */
  exportedDoodads() {
    return this.layers
      .filter((layer) => layer.visible)
      .flatMap((layer) => this.doodadsIn(layer.id));
  }

  /**
   * A new empty layer, on top of the list, with an id and a colour no other
   * layer has.
   */
  addLayer(name) {
    const layer = new Layer({
      id: this.freeLayerId(),
      name,
      color: this.freeColor(),
    });
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
   * A layer is copied by what makes it: an ordinary layer by its doodads, an
   * array by its parameters, with the doodads computed again. Copying an
   * array's doodads would be a detach nobody asked for.
   *
   * Deep, because a shared `box` object would let a handle dragged on one array
   * move the other.
   *
   * The colour is the one thing not copied: a copy lands on top of its
   * original, so telling the two apart is the first thing wanted of it.
   */
  duplicateLayer(id) {
    const source = this.findLayer(id);
    if (!source) throw new Error(`No layer '${id}' to duplicate`);

    const copy = this.addLayer(`${source.name} copy`);
    copy.visible = source.visible;
    copy.locked = source.locked;
    // The group comes with it, so the copy still moves with what the original
    // moves with.
    copy.group = source.group;
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
   * Through `Generator`, which is what makes changing a type safe: a `line`
   * cannot carry the `box` it used to be. The doodads are not touched --
   * `regenerate` is a separate step, the caller may be changing several things.
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
   * The old ones go -- they were derived, and keeping any is how a layer ends
   * up with two generations of one array. Position in the flat array does not
   * matter, export order being layer order.
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
   * One way: the parameters are gone and the doodads are what the player has.
   * see decisions/array-placement.
   */
  detach(id) {
    this.generators = this.generators.filter((array) => array.layer !== id);
  }

  /**
   * Removes a layer and hands its doodads to another one.
   *
   * The doodads are never dropped and the caller names where they go: there is
   * no undo, and a delete that silently takes hundreds of doodads with it
   * cannot be taken back.
   *
   * An array layer is the exception, handled first, so deleting one needs no
   * layer to hand doodads to.
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
   * An array layer takes its doodads with it -- they are derived, so handing
   * them to a neighbour hands over objects nobody placed. The caller states the
   * number first. see decisions/array-placement.
   */
  removeArrayLayer(id) {
    this.doodads = this.doodads.filter((doodad) => doodad.layer !== id);
    this.detach(id);
    this.layers = this.layers.filter((layer) => layer.id !== id);
  }

  /**
   * Moves an entry of the outline `offset` places along it, clamped to its ends:
   * a group moves as its whole run, and an ungrouped layer steps over a
   * neighbouring group rather than into it.
   *
   * Landing between two members would be joining their group, which is what
   * dragging a row says instead. So the step is over the whole entry.
   */
  moveEntry(index, offset) {
    const entries = this.layerOutline();
    if (index < 0 || index >= entries.length) return;

    const to = clamp(index + offset, 0, entries.length - 1);
    entries.splice(to, 0, ...entries.splice(index, 1));
    this.layers = entries.flatMap((entry) => entry.layers);
  }

  /** Moves a layer `offset` places inside its own group, clamped to the run. */
  moveInGroup(id, offset) {
    const members = this.groupOf(id);
    const from = members.findIndex((layer) => layer.id === id);
    if (from < 0) return;

    const to = clamp(from + offset, 0, members.length - 1);
    if (to === from) return;

    // The run is contiguous -- `tidyGroups` is what keeps it so -- so it is
    // reordered and written back over the slice it occupies.
    const start = this.layers.indexOf(members[0]);
    members.splice(to, 0, ...members.splice(from, 1));
    const layers = [...this.layers];
    layers.splice(start, members.length, ...members);
    this.layers = layers;
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
