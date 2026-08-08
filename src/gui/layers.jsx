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
 *
 * The panel shows before a file is loaded, holding an empty list. It is the
 * section the sidebar's height goes to, and a section that appears halfway
 * down on load moves everything under it.
 */

import * as state from "../state.js";

export default function Layers() {
  const loaded = state.hideoutDocument.value !== null;
  const layers = state.layers.value;
  const selected = state.selection.value.length;
  return (
    <details class="sidebar-item sidebar-item-grow" open>
      <summary>Layers</summary>
      <p class="text-secondary mb-1">
        Exported in this order, first at the top. Hiding and locking stay in the
        editor; everything exports.
      </p>
      <ul class="list-unstyled mb-2 layer-list">
        {layers.map((layer, index) => (
          <LayerRow layer={layer} index={index} count={layers.length} />
        ))}
      </ul>
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        disabled={!loaded}
        onClick={addLayer}
      >
        <i class="bi bi-plus-lg"></i> Add layer
        {selected > 0 && ` with ${selected} selected`}
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
      <button
        type="button"
        class="btn btn-sm btn-link p-0"
        title="Select this layer's doodads"
        disabled={!selectable(layer) || doodadsIn(layer).length === 0}
        onClick={() => selectContents(layer)}
      >
        <i class="bi bi-cursor"></i>
      </button>
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
  state.activeLayer.value = layer.id;
  state.layersChanged();
}

function selectContents(layer) {
  state.requestSelection(doodadsIn(layer));
}

/**
 * The viewport refuses to select what is hidden or locked, so the button that
 * would ask for it is off rather than quietly doing nothing. Stated here in
 * plain terms instead of imported from `viewport/groups.js`, which would bring
 * Konva into the sidebar to answer a question about two booleans.
 */
function selectable(layer) {
  return layer.visible && !layer.locked;
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
