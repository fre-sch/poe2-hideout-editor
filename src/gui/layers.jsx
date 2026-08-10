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
 * The layers are the document's, and this is the only place they are edited. It
 * mutates them and then calls `state.layersChanged`, which is what the viewport
 * and this panel both listen to -- see `state.js` for why a mutation cannot be
 * subscribed to on its own.
 *
 * A layer's doodad count is read from the document, which the count signal is
 * the proxy for: deleting doodads publishes it, and reading it here is what
 * brings the panel back after a delete.
 *
 * The panel shows before a file is loaded, holding an empty list. It is the
 * section the sidebar's height goes to, and a section that appears halfway
 * down on load moves everything under it.
 */

import * as state from "../state.js";
import { AddArrayButton, ArrayBadge, ArrayButtons } from "./arrays.jsx";
import { AddDoodadButton } from "./palette.jsx";

export default function Layers() {
  const loaded = state.hideoutDocument.value !== null;
  const layers = state.layers.value;
  const selected = state.selection.value.length;
  return (
    <details class="sidebar-item sidebar-item-grow" open>
      <summary>Layers</summary>
      <p class="text-secondary mb-1">
        Exported in this order, first at the top. A hidden layer is left out of
        the export; a locked one exports like any other.
      </p>
      <ul class="list-unstyled mb-2 layer-list">
        {layers.map((layer, index) => (
          <LayerRow layer={layer} index={index} count={layers.length} />
        ))}
      </ul>
      <div class="d-flex gap-1 flex-wrap">
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          disabled={!loaded}
          onClick={addLayer}
        >
          <i class="bi bi-plus-lg"></i> Add layer
          {selected > 0 && ` with ${selected} selected`}
        </button>
        <AddArrayButton />
        <AddDoodadButton />
      </div>
    </details>
  );
}

/**
 * An array's row differs in two places, and both are the same fact: its doodads
 * are generated. Working on it raises its box instead of selecting them, and it
 * carries settings and a **Detach** where an ordinary layer carries a lock.
 *
 * It can still be the active layer, and the palette refuses to place there and
 * says why. Making it unpickable would have made the one gesture mean two
 * things.
 */
function LayerRow({ layer, index, count }) {
  const array = Boolean(document_().findGenerator(layer.id));
  return (
    <li class="layer-row">
      <input
        type="radio"
        class="form-check-input"
        name="active-layer"
        title={
          array
            ? "Work on this array: its box and handles come up"
            : "Work on this layer: new doodads land here, and its doodads are selected"
        }
        checked={state.activeLayer.value === layer.id}
        // Not `onChange`: a radio that is already on reports no change, and
        // clicking the layer being worked on is how a selection just dismissed
        // is asked for again.
        onClick={() => activate(layer)}
      />
      <input
        type="text"
        class="form-control form-control-sm"
        value={layer.name}
        onInput={(event) => rename(layer, event.currentTarget.value)}
      />
      {array && <ArrayBadge />}
      <span class="text-secondary layer-count">{doodadsIn(layer).length}</span>
      <Toggle
        layer={layer}
        flag="visible"
        on="bi-eye"
        off="bi-eye-slash"
        title="Visible"
      />
      {array ? (
        <ArrayButtons layer={layer} />
      ) : (
        <Toggle
          layer={layer}
          flag="locked"
          on="bi-lock"
          off="bi-unlock"
          title="Locked"
        />
      )}
      <button
        type="button"
        class="btn btn-sm btn-link p-0"
        title="Move up"
        disabled={index === 0}
        onClick={() => move(layer, -1)}
      >
        <i class="bi bi-arrow-up"></i>
      </button>
      <button
        type="button"
        class="btn btn-sm btn-link p-0"
        title="Move down"
        disabled={index === count - 1}
        onClick={() => move(layer, 1)}
      >
        <i class="bi bi-arrow-down"></i>
      </button>
      <button
        type="button"
        class="btn btn-sm btn-link p-0 text-danger"
        title="Delete layer"
        disabled={count < 2}
        onClick={() => remove(layer)}
      >
        <i class="bi bi-trash"></i>
      </button>
    </li>
  );
}

/** The two flags, which differ only in which icon says which way round. */
function Toggle({ layer, flag, on, off, title }) {
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
      <i class={`bi ${layer[flag] ? on : off}`}></i>
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
 * Working on a layer: it takes new doodads, and what it already holds is put in
 * front of the player.
 *
 * For an ordinary layer that is its doodads, selected -- the viewport skips the
 * hidden and the locked, so a locked layer answers with an empty selection,
 * which is the truthful answer to "show me what I can move here". For an array
 * it is the box and its handles, its doodads being nothing to select; the
 * previous selection is dismissed either way, one layer at a time being the
 * point of the control.
 */
function activate(layer) {
  state.activeLayer.value = layer.id;
  if (document_().findGenerator(layer.id)) {
    state.requestSelection([]);
    state.editArray(layer.id);
    return;
  }

  state.editArray(null);
  state.requestSelection(doodadsIn(layer));
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
