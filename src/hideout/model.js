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

import * as colors from "./colors.js";
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
 * A user layer: a name to organise by, a colour its doodads are drawn in, and
 * two flags the viewport obeys.
 *
 * `visible` reaches the export: a hidden layer is left out of the `.hideout`,
 * which is how a player tries a layout two ways without deleting half of it.
 * `locked` reaches nothing but the mouse. Neither reaches the project file,
 * which keeps every layer whatever its flags say.
 *
 * `color` arrives from the document rather than defaulting here, because a
 * useful colour is one no other layer carries -- and a layer knows about no
 * other layer. A layer that arrives without one is coloured by the document it
 * is put in, which is what loads a project written before colours existed.
 *
 * `group` is the name of the layer group this layer moves with, or `null`. The
 * group is the layers carrying the name and is nothing besides -- the same
 * arrangement one level up, a layer being a name a doodad carries rather than a
 * collection it lives in. So a group cannot name a layer that has gone, and
 * deleting a layer takes its membership with it. See
 * wiki/decisions/layer-groups.md.
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
 * for the whole array, in `random.variation`. It is read as what it was already
 * doing -- those indices, for every doodad of the source -- and dropped, so that
 * a variation comes from one place and the count that bounds it is the doodad's
 * own. Wiki issue 0051.
 *
 * An entry that already has a list keeps it, which is what makes this safe to
 * run on every `Generator` rather than only on a file being read.
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
    this.colorLayers();
    // A group is drawn as a run of rows, and a project file may hold its members
    // anywhere. Reading one is where that is put right, once.
    this.tidyGroups();
  }

  /**
   * A colour for every layer that arrived without one, which is every layer of
   * a project written before colours and the single layer a `.hideout` becomes.
   *
   * One at a time and in order, so that each is chosen against the ones already
   * settled and no two layers of a loaded document share a colour.
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
   * The layers moving with this one: its group, or the layer alone when it
   * carries no group name.
   *
   * A layer alone rather than an empty answer, because every caller is asking
   * "what moves when I move this", and an ungrouped layer is a group of one.
   * In layer order, which is the order the list shows them in.
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
   * The tree the layer list is, said once here rather than rebuilt wherever a
   * group has to be stepped over -- moving, drawing and tidying are the same
   * walk. See wiki/decisions/layer-groups.md.
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
   * A group is drawn as a run of rows, so it has to be one -- and the tidying is
   * the outline flattened, the two being the same statement read twice. Run on
   * load, so a project file whose members are scattered arrives tidy, and after
   * every membership change.
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
   * `duplicateLayer` copies the group name along with the layer, which is right
   * for one layer and wrong for all of them -- the copies would join the
   * original instead of standing beside it. So they are renamed, and a free name
   * is found because two groups cannot share one.
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
   * Hiding is how a player tries a layout two ways, so it reaches the export
   * and `locked` does not -- see wiki issue 0026. The document keeps the hidden
   * layers and so does the project file; one export leaves them out.
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
   * **A layer is copied by what makes it.** An ordinary layer is its doodads, so
   * they are copied one for one. An array is its parameters, so those are copied
   * and the doodads computed from them again -- copying the doodads instead
   * would give a layer that looks the same and has forgotten how it got there,
   * which is a detach nobody asked for.
   *
   * The copy is deep, because two arrays are two arrays: a shared `box` object
   * would let a handle dragged on one move the other.
   *
   * The colour is the one thing not copied. A copy lands exactly on top of its
   * original, so telling the two apart is the first thing wanted of it -- which
   * is what a colour is for.
   */
  duplicateLayer(id) {
    const source = this.findLayer(id);
    if (!source) throw new Error(`No layer '${id}' to duplicate`);

    const copy = this.addLayer(`${source.name} copy`);
    copy.visible = source.visible;
    copy.locked = source.locked;
    // The group comes with it: a copy is made to work on beside the original,
    // and a copy that had left the group would be moved by nothing the original
    // is moved by.
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

  /**
   * Moves an entry of the outline `offset` places along it, clamped to its ends:
   * a group moves as its whole run, and an ungrouped layer steps over a
   * neighbouring group rather than into it.
   *
   * Landing between two members would be joining their group, and joining is
   * what the row's group control says. So the step is over the entry.
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
