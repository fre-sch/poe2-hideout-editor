/**
 * The layer panel: organise a layout into parts, and say which part is being
 * worked on.
 *
 * The layers are the document's, and this is the only place they are edited. It
 * mutates them and then calls `state.layersChanged`, which is what the viewport
 * and this panel both listen to -- see `state.js` for why a mutation cannot be
 * subscribed to on its own.
 *
 * A layer's doodad count is read from the document, which the count signal is
 * the proxy for: deleting doodads publishes it, and reading it here is what
 * brings the panel back after a delete.
 */

import * as state from "../state.js";

export default function Layers() {
  if (state.hideoutDocument.value === null) return null;

  const layers = state.layers.value;
  // Reading the count subscribes the panel to doodad deletion, which is the one
  // thing that changes a layer's tally without changing the layer list.
  const total = state.doodadCount.value;
  return (
    <details class="sidebar-item" open>
      <summary>
        Layers ({layers.length}), {total} doodads
      </summary>
      <p class="text-secondary mb-1">
        Exported in this order, first at the top. Hiding and locking stay in the
        editor; everything exports.
      </p>
      <ul class="list-unstyled mb-2">
        {layers.map((layer, index) => (
          <LayerRow layer={layer} index={index} count={layers.length} />
        ))}
      </ul>
      <button
        type="button"
        class="btn btn-secondary btn-sm me-1"
        onClick={addLayer}
      >
        <i class="bi bi-plus-lg"></i> Add layer
      </button>
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        disabled={state.selection.value.length === 0}
        onClick={moveSelection}
        title="Move the selected doodads into the active layer"
      >
        <i class="bi bi-box-arrow-in-right"></i> Move selection here
      </button>
    </details>
  );
}

function LayerRow({ layer, index, count }) {
  return (
    <li class="layer-row">
      <input
        type="radio"
        class="form-check-input"
        name="active-layer"
        title="New doodads land here"
        checked={state.activeLayer.value === layer.id}
        onChange={() => {
          state.activeLayer.value = layer.id;
        }}
      />
      <input
        type="text"
        class="form-control form-control-sm"
        value={layer.name}
        onInput={(event) => rename(layer, event.currentTarget.value)}
      />
      <span class="text-secondary layer-count">{doodadsIn(layer).length}</span>
      <Toggle
        layer={layer}
        flag="visible"
        on="bi-eye"
        off="bi-eye-slash"
        title="Visible"
      />
      <Toggle
        layer={layer}
        flag="locked"
        on="bi-lock"
        off="bi-unlock"
        title="Locked"
      />
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

function doodadsIn(layer) {
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

function addLayer() {
  const layer = document_().addLayer(`Layer ${state.layers.value.length + 1}`);
  state.activeLayer.value = layer.id;
  state.layersChanged();
}

/**
 * Deleting a layer never deletes doodads. Where they go is stated before it
 * happens, because a player cannot undo finding out afterwards.
 */
function remove(layer) {
  const target = neighbourOf(layer);
  if (!confirm(removeWarning(layer, target, doodadsIn(layer).length))) return;

  document_().removeLayer(layer.id, target.id);
  if (state.activeLayer.value === layer.id) {
    state.activeLayer.value = target.id;
  }
  state.layersChanged();
}

function removeWarning(layer, target, count) {
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

function moveSelection() {
  document_().assign(state.selection.value, state.activeLayer.value);
  state.layersChanged();
}
