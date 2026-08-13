/**
 * Arrays, as the sidebar sees them: the button that makes one, the two slots
 * they add to the layer actions bar, and the column that configures it.
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
import * as model from "../hideout/model.js";
import { ActionButton, SelectionBadge } from "./buttons.jsx";
import { loadTable, nameOf, variationsOf } from "../table.js";

const SHAPES = [
  ["grid", "Grid"],
  ["ellipse", "Ellipse"],
  ["polygon", "Polygon"],
  ["line", "Line"],
  ["bezier", "Curve"],
];

const DISTRIBUTIONS = [
  [generator.ON_CORNERS, "Corners"],
  [generator.ON_EDGES, "Edge middles"],
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
      title={`A new layer whose doodads are generated from the ${selected.length} selected ones, which it takes.`}
      onClick={addArray}
    >
      <i class="bi bi-grid-3x3"></i> Add array
      <SelectionBadge count={selected.length} />
    </button>
  );
}

/** What a layer row says instead of "this many doodads I am holding". */
export function ArrayBadge() {
  return (
    <i
      class="bi bi-grid-3x3 text-info"
      title="This layer's doodads are generated"
    ></i>
  );
}

/**
 * The array half of the layer actions bar: the two slots that only an array
 * answers. The lock is not one of them and never was -- an array's doodads
 * cannot be selected in the first place, so a toggle saying they cannot be
 * selected says nothing.
 *
 * `layer` is null when the layer being worked on is not an array, and then both
 * slots are drawn disabled rather than dropped. They hold their places in the
 * bar; see `LayerActions` in `layers.jsx` for why the places matter, and why
 * they are a group of their own -- they are the half of the bar that only an
 * array answers, which is a thing the bar can show rather than explain.
 *
 * The settings are the granular half of working on an array. The other half is
 * the layer's own radio, which raises the box and its handles -- most of what a
 * player wants is to drag that box, and a dozen numbers is what they ask for
 * afterwards.
 */
export function ArrayButtons({ layer = null }) {
  const open =
    layer !== null &&
    state.showArraySettings.value &&
    state.editedArray.value === layer.id;
  return (
    <div class="btn-group" role="group" aria-label="This array">
      <ActionButton
        icon="bi-sliders"
        extra={open ? "" : "text-secondary"}
        title={layer === null ? NOT_AN_ARRAY : "Array settings"}
        pressed={open}
        disabled={layer === null}
        onClick={() => (open ? closeSettings() : openSettings(layer.id))}
      />
      <ActionButton
        icon="bi-scissors"
        title={
          layer === null
            ? NOT_AN_ARRAY
            : "Detach: keep the doodads, drop the array"
        }
        disabled={layer === null}
        onClick={() => detach(layer)}
      />
    </div>
  );
}

const NOT_AN_ARRAY = "The layer being worked on is not an array";

export function ArraySidebar() {
  const layer = state.showArraySettings.value ? state.editedArray.value : null;
  const document_ = state.hideoutDocument.value;
  // Read so that the panel is redrawn when the parameters change, which happens
  // inside the document and cannot be subscribed to -- see `state.js`. Both
  // directions: an edit made here, and a handle dragged in the viewport.
  state.arrayEdit.value;
  state.arrayMoved.value;

  // The variation count is the doodad table's answer, and a player who made an
  // array from a selection may never have opened the palette. The language is a
  // dependency because switching it is what makes the loaded table the wrong
  // one, and the document it was read from does not change with it.
  const language = state.language.value;
  useEffect(() => {
    if (document_ && layer !== null) loadTable(document_);
  }, [document_, layer, language]);

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
        <Source
          source={parameters.source}
          pick={generator.pickOf(parameters)}
        />
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
      {model.carriesBox(parameters.type) ? (
        <Box box={parameters.box} />
      ) : (
        <Ends ends={parameters.ends} />
      )}
      {parameters.type === "bezier" && (
        <Controls controls={parameters.controls} />
      )}
      {parameters.type === "polygon" && <Polygon parameters={parameters} />}
      <Resolution parameters={parameters} />
      <PolygonHint parameters={parameters} />
    </details>
  );
}

/**
 * A polygon's own two questions: how many corners, and whether the doodads go on
 * them or between them. The second is a real choice and not a detail -- a fence
 * wants its posts on the corners, and a ring of braziers wants them facing the
 * middle of each wall.
 */
function Polygon({ parameters }) {
  return (
    <>
      <NumberField
        label="Corners"
        value={parameters.corners}
        min={3}
        onChange={(corners) => update({ corners })}
      />
      <Choice
        label="Doodads on"
        value={parameters.distribution ?? generator.ON_CORNERS}
        options={DISTRIBUTIONS}
        onChange={(distribution) => update({ distribution })}
      />
    </>
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
      <PointFields label="Start" field="ends" name="start" at={ends.start} />
      <PointFields label="End" field="ends" name="end" at={ends.end} />
    </>
  );
}

/**
 * A curve's two controls: where it leaves its start for, and where it arrives at
 * its end from. They are far easier dragged than typed -- the viewport draws one
 * on a leash from each end -- and they are here because everything else is.
 */
function Controls({ controls }) {
  return (
    <>
      <PointFields
        label="Control 1"
        field="controls"
        name="first"
        at={controls.first}
      />
      <PointFields
        label="Control 2"
        field="controls"
        name="second"
        at={controls.second}
      />
    </>
  );
}

/**
 * The two numbers of one named point of the geometry. `field` and `name` are
 * where it lives in the parameters, which is what lets one component draw four
 * points instead of four components drawing one each.
 */
function PointFields({ label, field, name, at }) {
  return (
    <>
      <NumberField
        label={`${label} x`}
        value={at.x}
        onChange={(x) => updatePoint(field, name, { x })}
      />
      <NumberField
        label={`${label} y`}
        value={at.y}
        onChange={(y) => updatePoint(field, name, { y })}
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
 * What a count that does not divide by the corner count costs, which is not the
 * same thing in the two distributions: on corners it is the corners that are
 * missed, and between them it is the edges. Said where it can be acted on, next
 * to both numbers it is about.
 *
 * Nothing is wrong with either, so it is a hint and not a refusal -- a run of
 * doodads that stops halfway round is a thing a player may well want.
 */
function PolygonHint({ parameters }) {
  if (parameters.type !== "polygon") return null;

  const count = parameters.resolution;
  const corners = parameters.corners;
  if (count % corners === 0) return null;
  return (
    <p class="text-warning mb-0">
      {hintFor(parameters.distribution, count, corners)} A multiple of {corners}{" "}
      gives every{" "}
      {parameters.distribution === generator.ON_EDGES ? "edge" : "corner"} the
      same number.
    </p>
  );
}

function hintFor(distribution, count, corners) {
  const short = count < corners;
  if (distribution === generator.ON_EDGES) {
    return short
      ? `${count} doodads over ${corners} edges leaves ${corners - count} edges empty.`
      : `${count} doodads over ${corners} edges does not divide evenly, so some edges carry more than others.`;
  }
  return short
    ? `${count} doodads over ${corners} corners leaves ${corners - count} corners empty.`
    : `${count} doodads over ${corners} corners does not divide evenly, so the edges between them carry different numbers.`;
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
 * Which variations this doodad may be drawn as, chosen from the ones it has.
 *
 * An empty set is not "none": it is "leave this doodad alone", and it is drawn
 * as the variation it was added with. The generator is handed the indices and
 * never the table -- it is framework-free, and the table is fetched.
 */
function Variations({ index, chosen, count }) {
  if (count < 2)
    return <p class="text-secondary small mb-0">{noVariations(count)}</p>;
  return (
    <div class="d-flex flex-wrap gap-1">
      {range(count).map((at) => (
        <VariationButton
          index={index}
          at={at}
          on={chosen.includes(at)}
          chosen={chosen}
        />
      ))}
    </div>
  );
}

function noVariations(count) {
  if (count === 1) return "One variation.";
  return "The doodad table does not know this one, so its variations are unknown.";
}

function VariationButton({ index, at, on, chosen }) {
  return (
    <button
      type="button"
      class={`btn btn-sm ${on ? "btn-primary" : "btn-outline-secondary"}`}
      aria-pressed={on}
      title={`Variation ${at + 1}`}
      onClick={() => toggleVariation(index, chosen, at)}
    >
      {at + 1}
    </button>
  );
}

/**
 * What the array is made of, and how it is walked. The names are listed because
 * a source is chosen once and read many times, and "three doodads" is not an
 * answer to which three.
 *
 * The two switches are the whole of "how": in turn is `source[k % length]`, the
 * array's original and only behaviour, and at random is the seed. They are two
 * switches and not one because the two lists are two questions -- a shuffled bag
 * of one doodad's variations is as reasonable as a strict alternation of two
 * doodads.
 *
 * Adding is the palette's -- which doodad is the question it exists to answer,
 * for an array exactly as for the floor. Taking one back out is here, because
 * *which of these* is a question only this list can put. The last one cannot go:
 * an array with nothing to place is not an emptier array, it is a broken one.
 */
function Source({ source, pick }) {
  return (
    <details class="sidebar-item" open>
      <summary>Source ({source.length})</summary>
      <ul class="list-unstyled mb-1 array-source">
        {source.map((entry, index) => (
          <SourceRow
            entry={entry}
            index={index}
            only={source.length === 1}
            chosen={entry.variation ?? []}
          />
        ))}
      </ul>
      <PickSwitch
        label="Doodads"
        value={pick.source}
        title="Which doodad each place along the shape is made of"
        onChange={(source_) => updatePick({ source: source_ })}
      />
      <PickSwitch
        label="Variations"
        value={pick.variation}
        title="Which of a doodad's chosen variations it is drawn as"
        onChange={(variation) => updatePick({ variation })}
      />
      <p class="text-secondary mb-0">
        Double-click one in <strong>Set array doodad</strong> to change this,
        and hold <span class="shortcut">Shift</span> there to add another.
      </p>
    </details>
  );
}

/**
 * In turn or at random, for one of the two lists an array walks.
 *
 * Both live here rather than under Randomness, because both are answers to
 * "what is placed", and one of the two answers is not random at all. The seed
 * they follow when they are is the Randomness section's, which is where a
 * player goes to shuffle them.
 */
function PickSwitch({ label, value, title, onChange }) {
  return (
    <div class="d-flex justify-content-between align-items-center mb-1">
      <span class="text-secondary" title={title}>
        {label}
      </span>
      <div class="btn-group" role="group" aria-label={title}>
        <PickButton
          label="In turn"
          mode={generator.CYCLE}
          value={value}
          onChange={onChange}
        />
        <PickButton
          label="At random"
          mode={generator.RANDOM}
          value={value}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

function PickButton({ label, mode, value, onChange }) {
  const on = value === mode;
  return (
    <button
      type="button"
      class={`btn btn-sm ${on ? "btn-primary" : "btn-outline-secondary"}`}
      aria-pressed={on}
      onClick={() => onChange(mode)}
    >
      {label}
    </button>
  );
}

/**
 * One doodad of the source: what it is, the variations it may be drawn as, and
 * the button that takes it out.
 *
 * The variations are the row's because they are the doodad's -- a torch and a
 * brazier have their own art and their own count of it, and one list for the
 * array meant the indices of whichever doodad had the fewest. It also meant an
 * array could place a variation a doodad does not have, which the game rejects:
 * wiki issue 0051.
 */
function SourceRow({ entry, index, only, chosen }) {
  // The table's name for the hash, or the one the source was stored with --
  // wiki issue 0059. The stored name is what the doodads are written with.
  const name = nameOf(entry);
  return (
    <li class="mb-1">
      <div class="array-source-row">
        <span class="array-source-name" title={name}>
          {name}
        </span>
        <button
          type="button"
          class="btn btn-sm btn-link p-0 text-danger"
          title={
            only
              ? "An array needs something to place, so the last one stays"
              : "Take this doodad out of the source"
          }
          disabled={only}
          onClick={() => removeSource(index)}
        >
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <Variations index={index} chosen={chosen} count={variationsOf(entry)} />
    </li>
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
  updateArray(state.editedArray.value, changes);
}

/**
 * The same, for a caller that names its array: the palette sets the source of
 * the *active* layer's array, which is the one being worked on -- but it is the
 * active layer it is answering about, so it says which.
 */
function updateArray(layer, changes) {
  const array = document_().findGenerator(layer);
  document_().replaceGenerator({ ...array, ...changes });
  state.arrayEdited(layer);
}

function updateBox(changes) {
  update({ box: { ...edited().box, ...changes } });
}

/** One coordinate of one named point: `ends.start.x`, and its three siblings. */
function updatePoint(field, name, changes) {
  const held = edited()[field];
  update({ [field]: { ...held, [name]: { ...held[name], ...changes } } });
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

function updatePick(changes) {
  update({ pick: { ...generator.pickOf(edited()), ...changes } });
}

/** One variation on or off, for one doodad of the source. */
function toggleVariation(index, chosen, at) {
  const next = chosen.includes(at)
    ? chosen.filter((other) => other !== at)
    : [...chosen, at].sort((first, second) => first - second);
  updateSource(index, { variation: next });
}

function updateSource(index, changes) {
  update({
    source: edited().source.map((entry, other) =>
      other === index ? { ...entry, ...changes } : entry,
    ),
  });
}

/**
 * One doodad out of the source. The doodads that were being made from it are not
 * where they were: the cycle is shorter, so every index after the gap takes the
 * next one along -- which is what a cycle means, and is visible immediately.
 */
function removeSource(index) {
  const source = edited().source;
  if (source.length < 2) return;
  update({ source: source.filter((_, other) => other !== index) });
}

/**
 * The doodad an array is made of, as the palette says it: a double-click makes
 * it the whole source, and Shift adds it to the cycle -- the editor's Shift,
 * which adds to a selection.
 *
 * It arrives as the first variation and chooses none, the same as a placed
 * doodad does. Which of its variations the array may draw it as is its own row's
 * question, asked of the table.
 */
export function sourceDoodad(layer, { hash, name }, adding) {
  const array = document_().findGenerator(layer);
  const entry = {
    hash: Number(hash),
    name,
    fv: FIRST_VARIATION,
    variation: [],
  };
  updateArray(layer, {
    source: adding ? [...array.source, entry] : [entry],
  });
}

const FIRST_VARIATION = 0;

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
 *
 * It becomes the active layer as well, because that is what "being worked on"
 * means everywhere else -- and it is what the palette reads to know that a
 * double-click sets this array's doodad rather than placing one.
 */
export function openSettings(layer) {
  state.activeLayer.value = layer;
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
