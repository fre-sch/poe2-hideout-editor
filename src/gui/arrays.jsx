/**
 * Arrays, as the sidebar sees them: the button that makes one, the controls a
 * layer row grows when it carries one, and the column that configures it.
 *
 * **A second sidebar on the right, not a floating panel.** The palette's
 * reasoning, which it arrived at the hard way -- see the head of `palette.jsx`.
 * A generator has a dozen parameters and wants the room, and a column beside the
 * viewport is never in the way. See wiki/decisions/array-placement.md.
 *
 * **Editing is live, and that is the whole of it.** Every control writes the
 * parameters and asks the viewport to regenerate, because aligning an array
 * against doodads that are already there is done by eye. There is no Apply: it
 * was a rollback point, and a button that commits what is already committed
 * reads as a button that has not been pressed yet. Closing closes.
 *
 * **Every control takes the value it draws as a prop.** A component that reads a
 * signal is given a `shouldComponentUpdate` by `@preact/signals` which skips the
 * render when no prop changed by reference and no signal it read has changed --
 * and editing a parameter changes neither, the parameters being mutated inside
 * the document. The Selection section paid for this lesson in wiki issue 0042.
 */

import { useEffect, useRef } from "preact/hooks";

import * as state from "../state.js";
import * as arrays from "../hideout/arrays.js";
import * as generator from "../hideout/generator.js";
import { loadTable, variationsOf } from "./table.js";

const SHAPES = [
  ["grid", "Grid"],
  ["ellipse", "Ellipse"],
  ["polygon", "Polygon"],
  ["line", "Line"],
];

/**
 * A new array out of what is selected. It sits beside "Add layer", which is the
 * gesture it is a variant of: both make a layer out of the selection, and this
 * one keeps the numbers.
 */
export function AddArrayButton() {
  const selected = state.selection.value;
  return (
    <button
      type="button"
      class="btn btn-secondary btn-sm"
      disabled={selected.length === 0}
      title="A new layer whose doodads are generated from these ones, which it takes."
      onClick={addArray}
    >
      <i class="bi bi-grid-3x3"></i> Add array
      {selected.length > 0 && ` from ${selected.length} selected`}
    </button>
  );
}

/** What a layer row says instead of "this many doodads I am holding". */
export function ArrayBadge() {
  return (
    <span class="badge text-bg-info" title="This layer's doodads are generated">
      array
    </span>
  );
}

/**
 * The two buttons an array layer has where an ordinary one has its lock. The
 * lock is not one of them: an array's doodads cannot be selected in the first
 * place, so a toggle saying they cannot be selected says nothing.
 *
 * The settings are the granular half of working on an array. The other half is
 * the layer's own radio, which raises the box and its handles -- most of what a
 * player wants is to drag that box, and a dozen numbers is what they ask for
 * afterwards.
 */
export function ArrayButtons({ layer }) {
  const open =
    state.showArraySettings.value && state.editedArray.value === layer.id;
  return (
    <>
      <button
        type="button"
        class={`btn btn-sm btn-link p-0 ${open ? "" : "text-secondary"}`}
        title="Array settings"
        aria-pressed={open}
        onClick={() => (open ? closeSettings() : openSettings(layer.id))}
      >
        <i class="bi bi-sliders"></i>
      </button>
      <button
        type="button"
        class="btn btn-sm btn-link p-0"
        title="Detach: keep the doodads, drop the array"
        onClick={() => detach(layer)}
      >
        <i class="bi bi-scissors"></i>
      </button>
    </>
  );
}

export function ArraySidebar() {
  const layer = state.showArraySettings.value ? state.editedArray.value : null;
  const document_ = state.hideoutDocument.value;
  // Read so that the panel is redrawn when the parameters change, which happens
  // inside the document and cannot be subscribed to -- see `state.js`. Both
  // directions: an edit made here, and a handle dragged in the viewport.
  state.arrayEdit.value;
  state.arrayMoved.value;

  // The variation count is the doodad table's answer, and a player who made an
  // array from a selection may never have opened the palette.
  useEffect(() => {
    if (document_ && layer !== null) loadTable(document_);
  }, [document_, layer]);

  const parameters = layer === null ? null : document_?.findGenerator(layer);
  if (!parameters) return null;
  return (
    <div id="array-sidebar">
      <div class="d-flex justify-content-between align-items-center">
        <h2>Array settings</h2>
        <button
          type="button"
          class="btn-close btn-close-white"
          aria-label="Close the array settings"
          onClick={closeSettings}
        ></button>
      </div>
      <hr />
      <div class="array-fields">
        <Shape parameters={parameters} />
        <Rotation rotation={parameters.rotation} type={parameters.type} />
        <Randomness parameters={parameters} />
        <Source source={parameters.source} />
      </div>
      <Footer />
    </div>
  );
}

// -- the sections ------------------------------------------------------------

function Shape({ parameters }) {
  return (
    <details class="sidebar-item" open>
      <summary>Shape</summary>
      <Choice
        label="Shape"
        value={parameters.type}
        options={SHAPES}
        onChange={changeType}
      />
      {parameters.type === "line" ? (
        <Ends ends={parameters.ends} />
      ) : (
        <Box box={parameters.box} />
      )}
      {parameters.type === "polygon" && (
        <NumberField
          label="Corners"
          value={parameters.corners}
          min={3}
          onChange={(corners) => update({ corners })}
        />
      )}
      <Resolution parameters={parameters} />
      <CornerHint parameters={parameters} />
    </details>
  );
}

function Box({ box }) {
  return (
    <>
      <NumberField
        label="Centre x"
        value={box.center.x}
        onChange={(x) => updateBox({ center: { ...box.center, x } })}
      />
      <NumberField
        label="Centre y"
        value={box.center.y}
        onChange={(y) => updateBox({ center: { ...box.center, y } })}
      />
      <NumberField
        label="Width"
        value={box.width}
        min={0}
        onChange={(width) => updateBox({ width })}
      />
      <NumberField
        label="Height"
        value={box.height}
        min={0}
        onChange={(height) => updateBox({ height })}
      />
      <NumberField
        label="Angle"
        value={box.rotation}
        onChange={(rotation) => updateBox({ rotation })}
      />
    </>
  );
}

function Ends({ ends }) {
  return (
    <>
      <NumberField
        label="Start x"
        value={ends.start.x}
        onChange={(x) =>
          update({ ends: { ...ends, start: { ...ends.start, x } } })
        }
      />
      <NumberField
        label="Start y"
        value={ends.start.y}
        onChange={(y) =>
          update({ ends: { ...ends, start: { ...ends.start, y } } })
        }
      />
      <NumberField
        label="End x"
        value={ends.end.x}
        onChange={(x) => update({ ends: { ...ends, end: { ...ends.end, x } } })}
      />
      <NumberField
        label="End y"
        value={ends.end.y}
        onChange={(y) => update({ ends: { ...ends, end: { ...ends.end, y } } })}
      />
    </>
  );
}

/**
 * How many doodads the shape carries: two numbers for a grid, which counts in
 * two directions, and one for every outline, which counts along itself.
 */
function Resolution({ parameters }) {
  if (parameters.type !== "grid") {
    return (
      <NumberField
        label="Doodads"
        value={parameters.resolution}
        min={0}
        onChange={(resolution) => update({ resolution })}
      />
    );
  }
  const resolution = parameters.resolution;
  return (
    <>
      <NumberField
        label="Columns"
        value={resolution.x}
        min={0}
        onChange={(x) => update({ resolution: { ...resolution, x } })}
      />
      <NumberField
        label="Rows"
        value={resolution.y}
        min={0}
        onChange={(y) => update({ resolution: { ...resolution, y } })}
      />
    </>
  );
}

/**
 * A polygon whose doodads do not divide evenly among its edges misses its own
 * corners, which on a sharp shape reads as a mistake rather than as a choice.
 * Said where it can be acted on, next to both numbers it is about.
 */
function CornerHint({ parameters }) {
  if (parameters.type !== "polygon") return null;
  if (parameters.resolution % parameters.corners === 0) return null;
  return (
    <p class="text-warning mb-0">
      {parameters.resolution} doodads over {parameters.corners} corners does not
      divide evenly, so some corners carry no doodad. A multiple of{" "}
      {parameters.corners} puts one on each.
    </p>
  );
}

function Rotation({ rotation, type }) {
  return (
    <details class="sidebar-item" open>
      <summary>Rotation</summary>
      <NumberField
        label="Base angle"
        value={rotation.base}
        onChange={(base) => updateRotation({ base })}
      />
      <NumberField
        label="Step per doodad"
        value={rotation.increment}
        onChange={(increment) => updateRotation({ increment })}
      />
      <Flag
        id="array-align"
        label="Align to shape"
        checked={Boolean(rotation.align)}
        disabled={type === "grid"}
        title={
          type === "grid"
            ? "A grid's doodads already face the way its box is turned."
            : "Face each doodad along the outline it sits on."
        }
        onChange={(align) => updateRotation({ align })}
      />
    </details>
  );
}

/**
 * One seed drives every random channel, as a hash of seed, index and channel --
 * so changing the resolution does not reshuffle the doodads already placed, and
 * rolling the seed changes all of them and nothing else.
 */
function Randomness({ parameters }) {
  const random = parameters.random;
  return (
    <details class="sidebar-item" open>
      <summary>Randomness</summary>
      <NumberField
        label="Jitter along"
        value={random.jitter.x}
        min={0}
        onChange={(x) => updateJitter({ x })}
      />
      <NumberField
        label="Jitter across"
        value={random.jitter.y}
        min={0}
        onChange={(y) => updateJitter({ y })}
      />
      <NumberField
        label="Jitter angle"
        value={random.jitter.rotation}
        min={0}
        onChange={(rotation) => updateJitter({ rotation })}
      />
      <Variations
        chosen={random.variation ?? []}
        count={variationCount(parameters.source)}
      />
      <div class="d-flex justify-content-between align-items-center gap-1">
        <span class="text-secondary">Seed {random.seed}</span>
        <button
          type="button"
          class="btn btn-secondary btn-sm text-nowrap"
          onClick={rollSeed}
        >
          <i class="bi bi-dice-5"></i> Regenerate seed
        </button>
      </div>
    </details>
  );
}

/**
 * Which variations a doodad may be drawn as, chosen from the ones it has.
 *
 * An empty set is not "none": it is "leave the source alone", which is what an
 * array does until a player says otherwise. The generator is handed the indices
 * and never the table -- it is framework-free, and the table is fetched.
 */
function Variations({ chosen, count }) {
  if (count < 2)
    return <p class="text-secondary mb-1">{noVariations(count)}</p>;
  return (
    <div class="mb-1">
      <div class="text-secondary">Variations, chosen at random</div>
      <div class="d-flex flex-wrap gap-1">
        {range(count).map((index) => (
          <VariationButton
            index={index}
            on={chosen.includes(index)}
            chosen={chosen}
          />
        ))}
      </div>
    </div>
  );
}

function noVariations(count) {
  if (count === 1) return "These doodads have one variation to choose from.";
  return "The doodad table does not know one of these doodads, so how many variations they share is unknown.";
}

function VariationButton({ index, on, chosen }) {
  return (
    <button
      type="button"
      class={`btn btn-sm ${on ? "btn-primary" : "btn-outline-secondary"}`}
      aria-pressed={on}
      onClick={() => toggleVariation(chosen, index)}
    >
      {index + 1}
    </button>
  );
}

/**
 * What the array is made of, cycled: doodad `k` is `source[k % length]`. The
 * names are listed because a source is chosen once and read many times, and
 * "three doodads" is not an answer to which three.
 */
function Source({ source }) {
  const selected = state.selection.value;
  return (
    <details class="sidebar-item" open>
      <summary>Source ({source.length})</summary>
      <p class="text-secondary mb-1">
        Used in turn: the first doodad, then the second, and round again.
      </p>
      <ul class="list-unstyled mb-1 array-source">
        {source.map((entry) => (
          <li title={entry.name}>{entry.name}</li>
        ))}
      </ul>
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        disabled={selected.length === 0}
        onClick={useSelection}
      >
        Use selection as source
        {selected.length > 0 && ` (${selected.length})`}
      </button>
    </details>
  );
}

/**
 * One button, because there is one thing left to do. Every change is already
 * made, and the settings are the array -- they are what the project file keeps
 * and what the doodads are computed from, so there is nothing here to commit.
 */
function Footer() {
  return (
    <div class="array-footer">
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        onClick={closeSettings}
      >
        Close
      </button>
      <p class="text-secondary mt-1 mb-0">
        Every change is made as you make it and kept. The box and its handles
        stay up while this layer is the active one.
      </p>
    </div>
  );
}

// -- the controls ------------------------------------------------------------

/**
 * A number, drawn from the value handed to it and not from anything it reads
 * for itself. See the head of this module for why that is not incidental.
 *
 * It shows what the player is typing while that still says the number the
 * parameters hold, and the value itself the rest of the time -- which is how a
 * handle dragged in the viewport reaches the field. Without that, "1.0" would be
 * written back as "1" between the keystroke and the decimal point, and a number
 * could not be typed at all.
 *
 * Text on its way to being a number -- empty, a lone minus sign -- reaches the
 * parameters as nothing rather than as `NaN`, which would take the array off the
 * screen. It stays in the field, being what the player typed.
 */
function NumberField({ label, value, min, step = 1, onChange }) {
  const typed = useRef(null);
  const text = says(typed.current, value)
    ? typed.current
    : String(shown(value));
  return (
    <label class="array-field">
      <span>{label}</span>
      <input
        type="number"
        class="form-control form-control-sm"
        value={text}
        min={min}
        step={step}
        onInput={(event) => {
          typed.current = event.currentTarget.value;
          const number = Number.parseFloat(typed.current);
          if (Number.isFinite(number)) onChange(number);
        }}
      />
    </label>
  );
}

/** Whether text a player typed still describes a value, or nothing at all. */
function says(text, value) {
  if (text === null) return false;
  const number = Number.parseFloat(text);
  return !Number.isFinite(number) || number === value;
}

/**
 * Geometry is unrounded by decision -- rounding it on every drag step would
 * walk an array's centre away and never walk it back -- so it is rounded for
 * reading only, where six decimal places of a drag are noise.
 */
const SHOWN_DECIMALS = 100;

function shown(value) {
  return Math.round(value * SHOWN_DECIMALS) / SHOWN_DECIMALS;
}

function Choice({ label, value, options, onChange }) {
  return (
    <label class="array-field">
      <span>{label}</span>
      <select
        class="form-select form-select-sm"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map(([key, name]) => (
          <option value={key}>{name}</option>
        ))}
      </select>
    </label>
  );
}

function Flag({ id, label, checked, disabled, title, onChange }) {
  return (
    <div class="form-check" title={title}>
      <input
        id={id}
        class="form-check-input"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <label class="form-check-label" for={id}>
        {label}
      </label>
    </div>
  );
}

// -- what the buttons do -----------------------------------------------------

function document_() {
  return state.hideoutDocument.value;
}

function edited() {
  return document_().findGenerator(state.editedArray.value);
}

/**
 * Writes the parameters and tells the viewport, which is every edit this panel
 * makes.
 *
 * They go back through `Generator`, so a change of shape drops the geometry of
 * the shape it left. That builds a new object, which is why the viewport redraws
 * its gizmo from the document rather than from the reference it was handed.
 */
function update(changes) {
  const array = edited();
  document_().replaceGenerator({ ...array, ...changes });
  state.arrayEdited(array.layer);
}

function updateBox(changes) {
  update({ box: { ...edited().box, ...changes } });
}

function updateRotation(changes) {
  update({ rotation: { ...edited().rotation, ...changes } });
}

function updateRandom(changes) {
  update({ random: { ...edited().random, ...changes } });
}

function updateJitter(changes) {
  updateRandom({ jitter: { ...edited().random.jitter, ...changes } });
}

function changeType(type) {
  update(arrays.withType(edited(), type));
}

function rollSeed() {
  updateRandom({ seed: generator.randomSeed() });
}

function toggleVariation(chosen, index) {
  const next = chosen.includes(index)
    ? chosen.filter((other) => other !== index)
    : [...chosen, index].sort((first, second) => first - second);
  updateRandom({ variation: next });
}

function useSelection() {
  update({ source: state.selection.value.map(arrays.sourceOf) });
}

/**
 * How many variations every doodad of the source has, or `0` where the table
 * cannot say for one of them.
 *
 * The smallest count and not the largest: the set of indices is used for every
 * doodad in turn, so an index only one of them has is an index the others cannot
 * be drawn as. Zero for the unknown falls out of the same `min`, which is the
 * honest answer -- a doodad the table does not know may have any number.
 */
function variationCount(source) {
  if (source.length === 0) return 0;
  return Math.min(...source.map((entry) => variationsOf(entry)));
}

/**
 * A new array layer out of the selection, with its settings open.
 *
 * It takes the doodads it was made from. The array's first generation stands
 * where they stood -- the box is fitted to them -- so leaving them there would
 * leave every one of them under a doodad the array had just made, and a player
 * who wanted them kept can say so with one more array or one fewer delete.
 *
 * The selection goes with them, because a selection box around doodads that are
 * no longer there is a claim about nothing.
 */
function addArray() {
  const hideout = document_();
  const source = state.selection.value;
  const parameters = arrays.fromSelection(source);

  const taken = new Set(source);
  hideout.doodads = hideout.doodads.filter((doodad) => !taken.has(doodad));
  const array = hideout.addArrayLayer(
    `Array ${state.layers.value.length + 1}`,
    parameters,
  );

  state.requestSelection([]);
  state.doodadCount.value = hideout.doodads.length;
  // The nodes of the doodads it took go here, and the group of the new layer is
  // made; the edit below is what draws the doodads it made.
  state.layersChanged();
  openSettings(array.layer);
  state.arrayEdited(array.layer);
}

/**
 * Raises the settings, and the handles with them: the settings are for one
 * array, and that array is the one being worked on.
 */
export function openSettings(layer) {
  state.editArray(layer);
  state.showArraySettings.value = true;
}

/**
 * Puts the settings away and leaves the handles up. Closing says "not these
 * numbers, then", not "not this array" -- which the layer list says, by making
 * another layer the active one.
 */
export function closeSettings() {
  state.showArraySettings.value = false;
}

const DETACH_WARNING =
  "Its doodads stay where they are and become ordinary doodads, which you can " +
  "select and move. The settings are dropped and cannot be brought back.";

function detach(layer) {
  if (!confirm(`Detach the array in '${layer.name}'?\n\n${DETACH_WARNING}`)) {
    return;
  }

  document_().detach(layer.id);
  if (state.editedArray.value === layer.id) state.editArray(null);
  state.layersChanged();
}

function range(count) {
  return Array.from({ length: count }, (_, index) => index);
}
