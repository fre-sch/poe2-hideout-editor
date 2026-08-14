/**
 * The layer panel: organise a layout into parts, and say which part is being
 * worked on.
 *
 * **The radio is that saying, and it does all of it.** It marks where new
 * doodads land, it selects the layer's doodads, and on an array it raises the
 * box and its handles. One control, because they are one intent -- "I am working
 * on this layer" -- and a separate button for the selection was a second way to
 * say a thing already said. It answers every click and not only the ones that
 * move it, so the way back to a selection just dismissed is the radio it is
 * already on.
 *
 * **So the actions that act on a layer are drawn once, under the list.** A row
 * carries what it is and how it stands -- its name, its colour, its tally, its
 * two flags --
 * and those are a reading as much as a control, which belongs to the thing being
 * read. Moving, deleting and filling a layer are answered by the bar, which acts
 * on the layer the radio names. A copy of them in every row asks again, six
 * times over, what the radio has already answered once.
 *
 * The layers are the document's, and this is the only place they are edited. It
 * mutates them and then calls `state.layersChanged`, which is what the viewport
 * and this panel both listen to -- see `state.js` for why a mutation cannot be
 * subscribed to on its own.
 *
 * A layer's doodad count is read from the document, which the count signal is
 * the proxy for: deleting doodads publishes it, and reading it here is what
 * brings the panel back after a delete.
 *
 * The panel shows before a file is loaded, holding an empty list. It is what the
 * sidebar's leftover height goes to, and a panel that appears halfway down on
 * load moves everything under it.
 *
 * It is a tab rather than a section of its own, sharing the place with the
 * selection -- see `tabs.jsx` for what the two have in common and why the list
 * had to stop moving.
 */

import * as state from "../state.js";
import { AddArrayButton, ArrayBadge, ArrayButtons } from "./arrays.jsx";
import { ActionButton, SelectionBadge } from "./buttons.jsx";
import { AddDoodadButton } from "./palette.jsx";

export default function Layers() {
  const loaded = state.hideoutDocument.value !== null;
  const layers = state.layers.value;
  const selected = state.selection.value.length;
  return (
    <>
      <p class="text-secondary mb-1">
        Exported in this order, first at the top. A hidden layer is left out of
        the export; a locked one exports like any other.
      </p>
      <ul class="list-unstyled mb-2 layer-list">
        {layers.map((layer) => (
          <LayerRow
            layer={layer}
            name={layer.name}
            color={layer.color}
            group={layer.group}
            groups={groupNames()}
            visible={layer.visible}
            locked={layer.locked}
            array={isArray(layer)}
          />
        ))}
      </ul>
      <LayerActions />
      <div class="d-flex gap-1 flex-nowrap">
        <button
          type="button"
          class="btn btn-secondary btn-sm text-nowrap"
          disabled={!loaded}
          title={addLayerTitle(selected)}
          onClick={addLayer}
        >
          <i class="bi bi-plus-lg"></i> Add layer
          <SelectionBadge count={selected} />
        </button>
        <AddArrayButton />
      </div>
    </>
  );
}

function addLayerTitle(selected) {
  if (selected === 0) return "A new empty layer.";
  return `A new layer holding the ${selected} selected doodads.`;
}

/**
 * The actions that act on a layer, once, acting on the layer the radio names.
 *
 * A slot that does not apply is disabled and not hidden. A hidden slot takes its
 * width with it and the rest slide over, so the delete button would sit
 * somewhere else depending on which layer is active -- and a delete button that
 * moves is a delete button pressed by accident. Disabled, the places stay
 * learnable and the `title` says why the slot is off.
 *
 * **The slots are grouped by what they act on**, in two `btn-group`s: the four
 * any layer answers, and the two only an array answers. Seven buttons at one
 * spacing read as seven unrelated buttons; grouped, the gap falls where the
 * meaning divides and the halves are read before any icon is. That gap is also
 * why there is no rule between them any more -- two groups say what a rule
 * between two runs of buttons was there to say.
 *
 * Add doodad stays outside both. It places a doodad in the layer rather than
 * acting on the layer, and it is the palette's.
 */
function LayerActions() {
  const layers = state.layers.value;
  const index = layers.findIndex(
    (layer) => layer.id === state.activeLayer.value,
  );
  const layer = index === -1 ? null : layers[index];
  return (
    <div class="d-flex gap-1 flex-nowrap align-items-center mb-2 layer-actions">
      <AddDoodadButton />
      <div class="btn-group" role="group" aria-label="This layer">
        <ActionButton
          icon="bi-arrow-up"
          title="Move this layer up"
          disabled={layer === null || index === 0}
          onClick={() => move(layer, -1)}
        />
        <ActionButton
          icon="bi-arrow-down"
          title="Move this layer down"
          disabled={layer === null || index === layers.length - 1}
          onClick={() => move(layer, 1)}
        />
        <ActionButton
          icon="bi-copy"
          title="Duplicate this layer"
          disabled={layer === null}
          onClick={() => duplicate(layer)}
        />
        <ActionButton
          icon="bi-trash"
          extra="text-danger"
          title="Delete this layer"
          disabled={layer === null || layers.length < 2}
          onClick={() => remove(layer)}
        />
      </div>
      <ArrayButtons layer={arrayOf(layer)} />
    </div>
  );
}

/** Whether a layer carries a generator, which is what makes it an array. */
function isArray(layer) {
  return Boolean(document_().findGenerator(layer.id));
}

/** The layer if it carries a generator, and null for the bar to disable by. */
function arrayOf(layer) {
  if (layer === null) return null;
  return isArray(layer) ? layer : null;
}

/**
 * What a layer is and how it stands: which one is being worked on, its name, the
 * colour its doodads are drawn in, its tally, and its two flags. What is done to
 * it is the bar's, below.
 *
 * The swatch sits by the radio and not by the name, because it is read against
 * the canvas rather than against the row: a column of swatches down the left is
 * the same list the doodads make out there.
 *
 * An array's row differs in one place, and it is the fact that its doodads are
 * generated: it carries the badge and no lock, an array's doodads being
 * unselectable in the first place, so a toggle saying they cannot be selected
 * says nothing.
 *
 * It can still be the active layer, and the palette refuses to place there and
 * says why. Making it unpickable would have made the one gesture mean two
 * things.
 *
 * **Everything the row draws is passed as well as the layer it came off**, and
 * it has to be. A component that reads a signal gets a
 * `shouldComponentUpdate` from `@preact/signals` which skips the render when no
 * prop changed by reference and no signal it read has changed -- and this one
 * reads three. Toggling a flag changes neither of those things: it is written
 * into the layer object the row already holds, so the eye stayed open on a
 * hidden layer until something else redrew the row. Wiki issues 0050 and, for
 * the same lesson on the selection row, 0042. Whether the layer is an array is
 * passed for the same reason: detaching one leaves the layer object alone.
 *
 * So a row is a function of the values it draws. The layer is what the controls
 * edit, the rest is what they show.
 */
function LayerRow({
  layer,
  name,
  color,
  group,
  groups,
  visible,
  locked,
  array,
}) {
  return (
    <li class="layer-row">
      <input
        type="radio"
        class="form-check-input"
        name="active-layer"
        title={activateTitle(array, group)}
        checked={state.activeLayer.value === layer.id}
        // Not `onChange`: a radio that is already on reports no change, and
        // clicking the layer being worked on is how a selection just dismissed
        // is asked for again.
        onClick={() => activate(layer)}
      />
      <input
        type="color"
        class="form-control form-control-color layer-color"
        title="The colour this layer's doodads are drawn in"
        value={color}
        onInput={(event) => recolor(layer, event.currentTarget.value)}
      />
      <input
        type="text"
        class="form-control form-control-sm"
        value={name}
        onInput={(event) => rename(layer, event.currentTarget.value)}
      />
      <GroupChoice layer={layer} group={group} groups={groups} />
      {array && <ArrayBadge />}
      <span class="text-secondary layer-count">{doodadsIn(layer).length}</span>
      <Toggle
        layer={layer}
        flag="visible"
        enabled={visible}
        on="bi-eye"
        off="bi-eye-slash"
        title="Visible"
      />
      {array ? null : (
        <Toggle
          layer={layer}
          flag="locked"
          enabled={locked}
          on="bi-lock"
          off="bi-unlock"
          title="Locked"
        />
      )}
    </li>
  );
}

/** What the radio does here, which the group is half the answer to. */
function activateTitle(array, group) {
  if (group !== null) {
    return `Work on this layer, and put the group '${group}' in the box: it all moves together`;
  }
  if (array) return "Work on this array: its box and handles come up";
  return "Work on this layer: new doodads land here, and its doodads are selected";
}

/**
 * Which group this layer moves with: none, one that exists, or a new one.
 *
 * It is in the row and not in the actions bar because a group is what a layer
 * *is*, the way its name and its colour are -- and because the answer has to be
 * readable down the column: which layers move together is a thing to see at a
 * glance rather than to discover by dragging one.
 *
 * A group is its name, so there is nothing else to make and nothing to keep in
 * step -- see wiki/decisions/layer-groups.md. Naming a new one is a prompt for
 * the same reason a delete is a confirm: it is one line of answer, and the
 * editor has no dialogue of its own.
 */
function GroupChoice({ layer, group, groups }) {
  return (
    <select
      class="form-select form-select-sm layer-group"
      title={
        group === null
          ? "This layer moves by itself"
          : `This layer moves with the group '${group}'`
      }
      value={group ?? NO_GROUP}
      onChange={(event) => regroup(layer, event.currentTarget.value)}
    >
      <option value={NO_GROUP}>—</option>
      {groups.map((name) => (
        <option value={name}>{name}</option>
      ))}
      <option value={NEW_GROUP}>New group…</option>
    </select>
  );
}

/**
 * The two entries of the select that are not a group name.
 *
 * A `<select>` carries strings, so these have to be strings no group can be
 * called. They lead with a NUL, which nothing a player types contains -- written
 * as an escape, a control character in source being a character nobody can see
 * is there.
 */
const NO_GROUP = "\u0000none";
const NEW_GROUP = "\u0000new";

/**
 * The two flags, which differ only in which icon says which way round.
 *
 * `flag` is what is written and `enabled` is what is drawn, which reads like one
 * thing said twice and is not: the value has to arrive as a prop for the row
 * above to redraw at all. See `LayerRow`.
 */
function Toggle({ layer, flag, enabled, on, off, title }) {
  return (
    <button
      type="button"
      class="btn btn-sm btn-link p-0"
      title={title}
      onClick={() => {
        layer[flag] = !layer[flag];
        state.layersChanged();
      }}
    >
      <i class={`bi ${enabled ? on : off}`}></i>
    </button>
  );
}

function document_() {
  return state.hideoutDocument.value;
}

/**
 * The doodads in a layer, and -- for a caller that renders -- a subscription to
 * their being deleted. Deletion is the one thing that changes a layer's tally
 * without changing the layer list, and `doodadCount` is how it is published:
 * the document itself cannot be subscribed to. See `state.js`.
 */
function doodadsIn(layer) {
  state.doodadCount.value;
  return document_().doodadsIn(layer.id);
}

function rename(layer, name) {
  layer.name = name;
  state.layersChanged();
}

function groupNames() {
  return state.hideoutDocument.value?.groupNames() ?? [];
}

/**
 * The group a layer moves with, as the row's select says it. A new group is
 * named and then simply carried, there being nothing else to a group.
 *
 * The layer being worked on is taken up again afterwards, and it is not
 * necessarily this one: what moves together has just changed, and the box on
 * the canvas is showing the set as it was. Grouping a layer does not make it the
 * active one -- the radio says that, and one gesture says one thing.
 */
function regroup(layer, chosen) {
  const group = chosen === NEW_GROUP ? newGroupName() : chosen;
  if (group === null) {
    // Cancelled at the prompt. The select is sitting on "New group…", which is
    // not where the layer is, so the row is drawn again to put it back.
    state.layersChanged();
    return;
  }

  layer.group = group === NO_GROUP ? null : group;
  state.layersChanged();
  reactivate();
}

function reactivate() {
  const layer = document_().findLayer(state.activeLayer.value);
  if (layer) activate(layer);
}

/** A name for a new group, or `null` where the player gave none. */
function newGroupName() {
  const name = prompt("Name the group these layers move with:")?.trim();
  return name ? name : null;
}

/**
 * The colour this layer's doodads are drawn in. `onInput` rather than `onChange`
 * so that the canvas follows the picker while it is open: a colour is chosen by
 * looking at what it does to the hideout, not by reading a hex code.
 */
function recolor(layer, color) {
  layer.color = color;
  state.layersChanged();
}

function move(layer, offset) {
  document_().moveLayer(layer.id, offset);
  state.layersChanged();
}

/**
 * A new layer, holding whatever is selected. A layer is made to hold something,
 * and an empty selection still gives the empty layer -- so the one button
 * covers both, and the selection needs no button of its own.
 */
function addLayer() {
  const layer = document_().addLayer(`Layer ${state.layers.value.length + 1}`);
  document_().assign(state.selection.value, layer.id);
  state.layersChanged();
  activate(layer);
}

/**
 * A copy of a layer, which becomes the layer being worked on: a copy is made in
 * order to work on it, and it lands exactly on the original, so the one thing
 * wanted next is to drag it off.
 *
 * What "a copy" means differs by what the layer is, and that is the document's
 * answer -- see `model.duplicateLayer`. Here it is one gesture either way, which
 * is the bar's pattern: a slot whose meaning follows the layer.
 */
function duplicate(layer) {
  const copy = document_().duplicateLayer(layer.id);
  state.doodadCount.value = document_().doodads.length;
  state.layersChanged();
  activate(copy);
}

/**
 * Working on a layer: it takes new doodads, and what it already holds is put in
 * front of the player.
 *
 * For an ordinary layer that is its doodads, selected -- the viewport skips the
 * hidden and the locked, so a locked layer answers with an empty selection,
 * which is the truthful answer to "show me what I can move here". For an array
 * it is the box and its handles, its doodads being nothing to select; the
 * previous selection is dismissed either way, one layer at a time being the
 * point of the control.
 *
 * **A layer in a group answers for the group.** The radio still names the one
 * layer being worked on -- new doodads land there, and the palette still reads
 * it -- and what comes up is everything that moves with it. See `activateGroup`
 * and wiki/decisions/layer-groups.md.
 */
function activate(layer) {
  state.activeLayer.value = layer.id;
  const group = document_().groupOf(layer.id);
  if (group.length > 1) {
    activateGroup(group);
    return;
  }

  state.movingArrays.value = [];
  if (document_().findGenerator(layer.id)) {
    state.requestSelection([]);
    state.editArray(layer.id);
    return;
  }

  state.editArray(null);
  state.requestSelection(doodadsIn(layer));
}

/**
 * Working on a group: every ordinary member's doodads selected, and every array
 * member carried along with them under the one box.
 *
 * No array's own handles come up, however many arrays are in the group. Two
 * boxes over one array is two answers to what a drag would do, and the group is
 * the one being asked for; the array by itself is what its settings are for.
 *
 * A hidden array is left where it is, the way the viewport leaves a hidden
 * layer's doodads unselected: a layer that cannot be seen moving is a layer that
 * has moved without the player watching.
 */
function activateGroup(group) {
  state.editArray(null);
  state.movingArrays.value = group
    .filter((layer) => isArray(layer) && layer.visible)
    .map((layer) => layer.id);
  state.requestSelection(
    group
      .filter((layer) => !isArray(layer))
      .flatMap((layer) => doodadsIn(layer)),
  );
}

/**
 * Deleting a layer never deletes doodads, and an array is the one exception --
 * its doodads are computed and there is nothing to hand them to. Either way what
 * happens is stated before it happens, because a player cannot undo finding out
 * afterwards.
 */
function remove(layer) {
  const target = neighbourOf(layer);
  const count = doodadsIn(layer).length;
  if (!confirm(removeWarning(layer, target, count))) return;

  const wasArray = Boolean(document_().findGenerator(layer.id));
  document_().removeLayer(layer.id, target.id);
  if (state.activeLayer.value === layer.id) {
    state.activeLayer.value = target.id;
  }
  if (wasArray) {
    if (state.editedArray.value === layer.id) state.editArray(null);
    state.doodadCount.value = document_().doodads.length;
  }
  state.layersChanged();
}

function removeWarning(layer, target, count) {
  if (document_().findGenerator(layer.id)) {
    return (
      `Delete the array '${layer.name}'?\n\n` +
      `Its ${count} doodads are generated by it, so they are deleted with it. ` +
      `Detach the array first to keep them.`
    );
  }
  if (count === 0) {
    return `Delete the layer '${layer.name}'?\n\nIt holds no doodads.`;
  }
  return (
    `Delete the layer '${layer.name}'?\n\n` +
    `Its ${count} doodads are not deleted. They move to the layer ` +
    `'${target.name}'.`
  );
}

function neighbourOf(layer) {
  const layers = state.layers.value;
  const index = layers.indexOf(layer);
  return layers[index === 0 ? 1 : index - 1];
}
