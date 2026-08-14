/**
 * The layer panel: organise a layout into parts, and say which part is being
 * worked on.
 *
 * **The row is that saying, and it does all of it.** Picking one marks where new
 * doodads land, it selects the layer's doodads, and on an array it raises the
 * box and its handles. One gesture, because they are one intent -- "I am working
 * on this layer" -- and a separate button for the selection was a second way to
 * say a thing already said. It answers every click and not only the ones that
 * move the mark, so the way back to a selection just dismissed is the row it is
 * already on.
 *
 * **The row itself is the control**, and there is no radio button in it: the
 * mark on the row's background says which row is up -- wiki issues 0068 and
 * 0069 -- and a radio beside it said the same thing again, smaller. The controls
 * the row carries keep their own clicks; see `pickRow`.
 *
 * **The list is a tree, and a pick runs over both kinds of row.** A group is
 * a row of its own with its layers indented under it: pick a layer and that
 * layer is worked on, pick the group and every member comes up under one box.
 * A group answering for its members was a group its members could not answer
 * for themselves -- moving one layer of a group meant leaving it first, which is
 * three gestures to undo a feature. Wiki issues 0065 and 0066, and
 * wiki/decisions/layer-groups.md.
 *
 * The tree is `HideoutDocument.layerOutline`, and a group's rows are adjacent
 * because its layers are: the document tidies them, joining a group being what
 * moves a layer to it. So the list still reads top to bottom as export order.
 *
 * **Membership is written where it is read**: a layer row is dragged onto a
 * group row to join it, and onto the strip at the end of the list to leave the
 * group it is in. The select that used to do it said in 4.5rem of truncated
 * name what the row's place under a group row already says -- see `dropOn` and
 * wiki issue 0070. Dragging never reorders; the bar's arrows do that.
 *
 * **So the actions that act on a layer are drawn once, under the list.** A row
 * carries what it is and how it stands -- its name, its colour, its tally, its
 * two flags --
 * and those are a reading as much as a control, which belongs to the thing being
 * read. Moving, deleting and filling a layer are answered by the bar, which acts
 * on the layer the pick names. A copy of them in every row asks again, six
 * times over, what the pick has already answered once.
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
  const selected = state.selection.value.length;
  return (
    <>
      <p class="usage-text">
        Exported in this order, first at the top. A hidden layer is left out of
        the export; a locked one exports like any other. Layers in a group move
        together: drag a layer onto a group to join it, and joining moves the
        layer to that group.
      </p>
      <ul class="list-unstyled mb-2 layer-list">
        {outline().map((entry) =>
          entry.group === null ? (
            <LayerRows layers={entry.layers} />
          ) : (
            <GroupRows entry={entry} />
          ),
        )}
        <LeaveGroup />
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
          <i class="bi bi-layers"></i> Add layer
          <SelectionBadge count={selected} />
        </button>
        <AddArrayButton />
        <AddGroupButton />
      </div>
    </>
  );
}

function addLayerTitle(selected) {
  if (selected === 0) return "A new empty layer.";
  return `A new layer holding the ${selected} selected doodads.`;
}

/** The list as it is drawn, and a subscription to it changing. */
function outline() {
  state.layers.value;
  return document_()?.layerOutline() ?? [];
}

/**
 * The rows of some layers, each drawn from its values -- see `LayerRow` for why
 * every one of them is a prop.
 *
 * `indented` marks a member of a group, which is what the indent says: these
 * rows belong to the row above them.
 */
function LayerRows({ layers, indented = false }) {
  return layers.map((layer) => (
    <LayerRow
      layer={layer}
      name={layer.name}
      color={layer.color}
      group={layer.group}
      visible={layer.visible}
      locked={layer.locked}
      array={isArray(layer)}
      indented={indented}
      mark={layerMark(layer)}
      editing={state.editingName("layer", layer.id)}
    />
  ));
}

/**
 * **What is being worked on is a set of rows, not one row.** A pick names a
 * layer or a group, and the other kind of row comes with it: a layer's group
 * moves when the layer does, a group's layers are what the group is. So the
 * marked row and its company are both drawn, at two strengths of the one colour
 * -- the brighter one being the row that was picked, which is how the pair says
 * which of the two kinds is up. Wiki issue 0068.
 *
 * `null` for a row that is neither, which draws no mark at all.
 */
function layerMark(layer) {
  if (state.activeLayer.value === layer.id) return "active";
  if (inGroup(layer) && state.activeGroup.value === layer.group) {
    return "related";
  }
  return null;
}

/** A group row is marked by its own pick, or by one of its layers'. */
function groupMark(group, layers) {
  if (state.activeGroup.value === group) return "active";
  if (layers.some((layer) => layer.id === state.activeLayer.value)) {
    return "related";
  }
  return null;
}

/**
 * A click anywhere on the row works on it -- unless it landed on a control the
 * row carries, which means what it means.
 *
 * The swatch, the two flag toggles, the fold caret and the name editor are all
 * such controls, and one test finds them: they are the form elements in a row
 * that is otherwise text. The name while it is being read is not among them. It
 * is part of the row and picks it, and the double click that opens the editor
 * costs only the selection the pick asked for.
 *
 * Every click and not only the ones that move the mark: clicking the row already
 * being worked on is how a selection just dismissed is asked for again.
 */
function pickRow(event, pick) {
  if (event.target.closest("button, input")) return;
  pick();
}

/**
 * A row picked up, to be dropped on a group row or on the strip that leaves one.
 *
 * The drag carries the layer's name as text although nothing reads it: a drag
 * with no data on it is a drag Firefox refuses to start, and a name is the
 * honest thing to hand to whatever the row is dropped on outside the editor.
 * What the list itself acts on is `state.draggedLayer`, the drop being answered
 * in a row the drag did not start in.
 */
function startDrag(event, layer) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", layer.name);
  state.startLayerDrag(layer.id, layer.group ?? null);
}

/**
 * A drop is offered here, or it is not: a target that does not call
 * `preventDefault` is one the browser refuses to drop on, cursor and all. So
 * this is where "you cannot drop a layer in the group it is already in" is said,
 * and it is said by the pointer before the player lets go.
 */
function allowDrop(event, group) {
  const dragged = state.draggedLayer.value;
  if (dragged === null || dragged.group === group) return;

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  state.dropTarget.value = { group };
}

/**
 * The drag has moved off this target, so it stops saying it would take it --
 * unless it has only moved onto something inside it. A row is a name and a few
 * controls, and each of them is a `dragleave` on the row that the drop is still
 * going to land on.
 */
function leaveDrop(event, group) {
  if (event.currentTarget.contains(event.relatedTarget)) return;
  if (state.overDropTarget(group)) state.dropTarget.value = null;
}

/**
 * The drop, which is the write: the layer's group becomes this row's -- a name,
 * or `null` for the strip at the end of the list.
 *
 * The document tidies the group into a run, so the layer moves in the list. What
 * is being worked on is taken up again afterwards, and it is not necessarily
 * this layer: what moves together has just changed, and the box on the canvas is
 * showing the set as it was. A drop does not pick the row it landed on -- one
 * gesture says one thing, and picking is the click's.
 */
function dropOn(event, group) {
  event.preventDefault();
  const dragged = state.draggedLayer.value;
  state.endLayerDrag();
  if (dragged === null) return;

  const layer = document_().findLayer(dragged.id);
  if (layer === null) return;

  document_().groupLayer(layer.id, group);
  state.layersChanged();
  reactivate(layer);
}

/**
 * The way out of a group: a strip under the last row, there only while a layer
 * that is in one is being dragged.
 *
 * It is a row of the list rather than the space beside it, so that it is still
 * reachable at the bottom of a list too long to fit. And it is there only for
 * the drag it answers -- a layer in no group has no group to leave, and a target
 * standing empty is a thing to wonder about.
 */
function LeaveGroup() {
  const dragged = state.draggedLayer.value;
  if (dragged === null || dragged.group === null) return null;

  return (
    <li
      class={rowClass(
        "layer-drop-out",
        state.overDropTarget(null) && "layer-drop-over",
      )}
      onDragOver={(event) => allowDrop(event, null)}
      onDragLeave={(event) => leaveDrop(event, null)}
      onDrop={(event) => dropOn(event, null)}
    >
      <i class="bi bi-box-arrow-left"></i> Drop here to leave the group
    </li>
  );
}

/**
 * A new group holding the layer being worked on, which is the only layer the
 * button can mean: a group is a name its layers carry, so there is no empty
 * group to make and nothing to make it out of but a layer.
 *
 * The name is the next free `Group N`, the way a new layer is the next
 * `Layer N`, and it is renamed by double-clicking the group row. A prompt asks
 * for a name before there is a group to see, which is one answer more than the
 * gesture needs.
 */
function AddGroupButton() {
  const layer = activeLayer();
  return (
    <button
      type="button"
      class="btn btn-secondary btn-sm text-nowrap"
      disabled={layer === null}
      title={
        layer === null
          ? "Pick a layer to put in a new group"
          : `A new group holding the layer '${layer.name}'`
      }
      onClick={() => addGroup(layer)}
    >
      <i class="bi bi-collection"></i> Add group
    </button>
  );
}

/** A row's classes: what it is, and how it stands to what is worked on. */
function rowClass(...names) {
  return names.filter(Boolean).join(" ");
}

/** A layer's `group` is absent on the layers of a file that had no groups. */
function inGroup(layer) {
  return layer.group !== null && layer.group !== undefined;
}

/**
 * A group: its own row, and its layers under it unless it is folded shut.
 *
 * The members are drawn even while the group is the active one. A group is not
 * a thing apart from its layers, and a list that hid them while they were being
 * moved would be hiding what is moving.
 */
function GroupRows({ entry }) {
  const collapsed = state.collapsedGroups.value.includes(entry.group);
  const lockable = entry.layers.filter((layer) => !isArray(layer));
  return (
    <>
      <GroupRow
        group={entry.group}
        layers={entry.layers}
        collapsed={collapsed}
        visible={entry.layers.every((layer) => layer.visible)}
        locked={lockable.length > 0 && lockable.every((layer) => layer.locked)}
        lockable={lockable.length > 0}
        count={entry.layers.reduce(
          (total, layer) => total + doodadsIn(layer).length,
          0,
        )}
        mark={groupMark(entry.group, entry.layers)}
        editing={state.editingName("group", entry.group)}
      />
      {collapsed ? null : <LayerRows layers={entry.layers} indented />}
    </>
  );
}

/**
 * What a group is and how it stands: whether it is being worked on, its name,
 * how many doodads it holds, and the two flags -- which are its members' flags,
 * read as "all of them" and written to all of them.
 *
 * Nothing outside this panel learns what a group is: `viewport/groups.js` goes
 * on obeying two booleans per layer, the way it did before groups existed. It is
 * the reason a group is a name and not an object, applied to the flags.
 *
 * The name is committed once, when the editor is closed, and not per keystroke.
 * A group is its name, so every keystroke would be a group -- one that the
 * members are moved into, that a half-typed name may collide with, and that the
 * fold state and the active group both have to follow. See `Name`.
 */
function GroupRow({
  group,
  layers,
  collapsed,
  visible,
  locked,
  lockable,
  count,
  mark,
  editing,
}) {
  return (
    <li
      class={rowClass(
        "layer-row",
        "group-row",
        mark && `layer-row-${mark}`,
        state.overDropTarget(group) && "layer-drop-over",
      )}
      title={`Work on the group '${group}': its ${layers.length} layers move together. Drop a layer here to put it in the group`}
      onClick={(event) => pickRow(event, () => activateGroup(group, layers))}
      onDragOver={(event) => allowDrop(event, group)}
      onDragLeave={(event) => leaveDrop(event, group)}
      onDrop={(event) => dropOn(event, group)}
    >
      <button
        type="button"
        class="btn btn-sm btn-link p-0 group-caret"
        title={collapsed ? "Show these layers" : "Fold this group"}
        onClick={() => state.toggleCollapsed(group)}
      >
        <i
          class={`bi ${collapsed ? "bi-caret-right-fill" : "bi-caret-down-fill"}`}
        ></i>
      </button>
      <i class="bi bi-collection" title="A layer group"></i>
      <Name
        name={group}
        editing={editing}
        title="The name of this group, which is what its layers carry"
        edit={() => state.editName("group", group)}
        commit={(typed) => renameGroup(group, typed)}
      />
      <span class="layer-count">{count}</span>
      <Toggle
        layers={layers}
        flag="visible"
        enabled={visible}
        on="bi-eye"
        off="bi-eye-slash"
        title="Visible: every layer of the group"
      />
      {lockable ? (
        <Toggle
          layers={layers.filter((layer) => !isArray(layer))}
          flag="locked"
          enabled={locked}
          on="bi-lock"
          off="bi-unlock"
          title="Locked: every layer of the group"
        />
      ) : null}
    </li>
  );
}

/**
 * The actions, once, acting on whatever row is picked -- a layer, or a group.
 *
 * A group answers the same four slots as a layer, meaning them of the whole
 * group: moving steps the run over its neighbour, duplicating copies every
 * member into a group of its own, deleting takes them all after saying so. They
 * are the same four things a player wants of the thing they have picked, and a
 * second bar for groups would be the same bar drawn twice.
 *
 * The array half stays a layer's. An array is one member of a group, and the
 * settings and the detach are about that one array.
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
  const target = activeTarget();
  return (
    <div class="d-flex gap-1 flex-nowrap align-items-center mb-2 layer-actions">
      <AddDoodadButton />
      <div class="btn-group" role="group" aria-label="This layer">
        <ActionButton
          icon="bi-arrow-up-square-fill"
          title={`Move this ${target.what} up`}
          disabled={!target.canMove(-1)}
          onClick={() => target.move(-1)}
        />
        <ActionButton
          icon="bi-arrow-down-square-fill"
          title={`Move this ${target.what} down`}
          disabled={!target.canMove(1)}
          onClick={() => target.move(1)}
        />
        <ActionButton
          icon="bi-copy"
          title={`Duplicate this ${target.what}`}
          disabled={!target.canDuplicate}
          onClick={target.duplicate}
        />
        <ActionButton
          icon="bi-trash"
          extra="text-danger"
          title={target.deleteTitle}
          disabled={!target.canDelete}
          onClick={target.remove}
        />
      </div>
      <ArrayButtons layer={arrayOf(target.layer)} />
    </div>
  );
}

/**
 * What the bar acts on: the group being worked on, the layer being worked on, or
 * neither -- one shape either way, so the bar reads its slots and does not ask
 * which kind of thing it is holding.
 *
 * `what` names the thing in every title, which is the whole of what the bar says
 * differently for a group.
 */
function activeTarget() {
  const entries = outline();
  const group = state.activeGroup.value;
  if (group !== null) {
    const index = entries.findIndex((entry) => entry.group === group);
    if (index !== -1) return groupTarget(group, entries, index);
  }

  const layer = activeLayer();
  if (layer === null) return NO_TARGET;
  return layerTarget(layer, entries);
}

/** The layer being worked on, and `null` while a group or nothing is. */
function activeLayer() {
  return document_()?.findLayer(state.activeLayer.value) ?? null;
}

const NO_TARGET = {
  what: "layer",
  layer: null,
  canMove: () => false,
  move: () => {},
  canDuplicate: false,
  duplicate: () => {},
  canDelete: false,
  deleteTitle: "Delete this layer",
  remove: () => {},
};

function groupTarget(group, entries, index) {
  const target = neighbourOfGroup(group);
  return {
    what: "group",
    layer: null,
    canMove: (offset) => at(index + offset, entries) !== null,
    move: (offset) => moveEntry(index, offset),
    canDuplicate: true,
    duplicate: () => duplicateGroup(group),
    canDelete: target !== null,
    deleteTitle:
      target === null
        ? "Every layer is in this group, and a document keeps one layer"
        : "Delete this group and all its layers",
    remove: () => removeGroup(group, target),
  };
}

/**
 * A layer moves inside its group, or over its neighbours when it has none.
 *
 * A step that landed between two members would be joining their group, and
 * joining is what a drop on the group's row says -- one gesture, one meaning.
 */
function layerTarget(layer, entries) {
  const members = document_().groupOf(layer.id);
  const index = entries.findIndex((entry) => entry.layers.includes(layer));
  const place = members.indexOf(layer);
  const grouped = inGroup(layer);
  return {
    what: "layer",
    layer,
    canMove: (offset) =>
      grouped
        ? at(place + offset, members) !== null
        : at(index + offset, entries) !== null,
    move: (offset) =>
      grouped ? moveInGroup(layer, offset) : moveEntry(index, offset),
    canDuplicate: true,
    duplicate: () => duplicate(layer),
    canDelete: state.layers.value.length > 1,
    deleteTitle: "Delete this layer",
    remove: () => remove(layer),
  };
}

/** The item at an index, or `null` where the index is off either end. */
function at(index, items) {
  if (index < 0 || index >= items.length) return null;
  return items[index];
}

/** A layer outside a group, to hand its doodads to when the group goes. */
function neighbourOfGroup(group) {
  return state.layers.value.find((layer) => layer.group !== group) ?? null;
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
 * The swatch leads the row and does not sit by the name, because it is read
 * against the canvas rather than against the row: a column of swatches down the
 * left is the same list the doodads make out there.
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
  visible,
  locked,
  array,
  indented,
  mark,
  editing,
}) {
  return (
    <li
      class={rowClass(
        "layer-row",
        indented && "layer-row-grouped",
        mark && `layer-row-${mark}`,
      )}
      title={activateTitle(array, group)}
      onClick={(event) => pickRow(event, () => activate(layer))}
      draggable={!editing}
      onDragStart={(event) => startDrag(event, layer)}
      onDragEnd={state.endLayerDrag}
    >
      <input
        type="color"
        class="form-control form-control-color layer-color"
        title="The colour this layer's doodads are drawn in"
        value={color}
        onInput={(event) => recolor(layer, event.currentTarget.value)}
      />
      <Name
        name={name}
        editing={editing}
        title="The name of this layer"
        edit={() => state.editName("layer", layer.id)}
        commit={(typed) => rename(layer, typed)}
      />
      {array && <ArrayBadge />}
      <span class="layer-count">{doodadsIn(layer).length}</span>
      <Toggle
        layers={[layer]}
        flag="visible"
        enabled={visible}
        on="bi-eye"
        off="bi-eye-slash"
        title="Visible"
      />
      {array ? null : (
        <Toggle
          layers={[layer]}
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

/**
 * What picking the row does. A layer in a group answers for itself, the group
 * row being what answers for the group -- so the group changes nothing about
 * this except that it is worth saying which one moves.
 */
function activateTitle(array, group) {
  const alone = group === null ? "" : ", by itself";
  if (array) return `Work on this array${alone}: its box and handles come up`;
  return `Work on this layer${alone}: new doodads land here, and its doodads are selected`;
}

/**
 * A name in the list: text to read, and a field once it has been double-clicked.
 *
 * **A row's name is read far more often than it is written.** A column of live
 * text boxes says every name is about to change, and it leaves no way to take
 * typing back: with the layer written per keystroke, there is nothing for an
 * Escape to put back. So the name is text, the double click is the way in, and
 * the editor is a place where a name is being typed but is not yet the layer's.
 *
 * Enter commits and closes, Escape closes and leaves the old name, and clicking
 * away commits -- losing a typed name to a stray click would be the worse
 * mistake of the two. The keys are stopped here: Escape also clears the viewport
 * selection and closes the help, and while a name is being typed it means this
 * name.
 *
 * `editing` arrives as a prop for the reason every other value in a row does --
 * see `LayerRow`.
 */
function Name({ name, editing, title, edit, commit }) {
  if (!editing) {
    return (
      <span
        class="form-control-plaintext form-control-sm layer-name"
        title={`${title}. Double-click to rename it`}
        onDblClick={edit}
      >
        {name}
      </span>
    );
  }

  return (
    <input
      type="text"
      class="form-control form-control-sm"
      value={name}
      title={title}
      ref={focusName}
      onBlur={(event) => finishNameEdit(commit, event.currentTarget.value)}
      onKeyDown={(event) => nameKey(event, commit, name)}
    />
  );
}

/**
 * The editor takes the focus as it appears, and offers its text, so that typing
 * replaces the name and an arrow key keeps it.
 *
 * A named function and not an inline one: a ref that changes identity is a ref
 * Preact calls again on every redraw, which would take the focus back from
 * wherever the player had put it. `autofocus` is not enough here -- the field is
 * inserted long after the document loaded.
 */
function focusName(input) {
  if (input === null) return;
  input.focus();
  input.select();
}

function nameKey(event, commit, name) {
  if (event.key === "Enter") {
    event.stopPropagation();
    finishNameEdit(commit, event.currentTarget.value);
    return;
  }
  if (event.key !== "Escape") return;

  event.stopPropagation();
  cancelNameEdit(event.currentTarget, name);
}

function finishNameEdit(commit, typed) {
  state.endNameEdit();
  commit(typed);
}

/**
 * Escape: the field goes away and nothing is written.
 *
 * The typed text is put back first. Closing the editor removes the field, and a
 * browser that answers that with a `blur` would otherwise commit what was just
 * abandoned; with the old name in the box, that commit is not a change.
 */
function cancelNameEdit(input, name) {
  input.value = name;
  state.endNameEdit();
}

/**
 * The two flags, which differ only in which icon says which way round.
 *
 * `flag` is what is written and `enabled` is what is drawn, which reads like one
 * thing said twice and is not: the value has to arrive as a prop for the row
 * above to redraw at all. See `LayerRow`.
 *
 * A list of layers rather than one, because a group's flag is its members'
 * flags: they are all written to what `enabled` was not, so a group half of
 * whose layers are hidden shows itself hidden and opens all of them at once.
 */
function Toggle({ layers, flag, enabled, on, off, title }) {
  return (
    <button
      type="button"
      class="btn btn-sm btn-link p-0"
      title={title}
      onClick={() => toggle(layers, flag, enabled)}
    >
      <i class={`bi ${enabled ? on : off}`}></i>
    </button>
  );
}

/**
 * Writes a flag on some layers, and asks again what is being worked on when
 * they are part of it.
 *
 * **What is up on the canvas was derived from the flags once, when the row was
 * picked.** A hidden layer's doodads are not selected and a hidden array does
 * not ride with its group, so hiding one afterwards left a box standing over
 * nothing -- the doodads go, `showLayers` discards them, but an array rides on a
 * proxy the box holds and no flag reaches that. Showing one again was the same
 * omission the other way round: nothing had asked for its proxy.
 *
 * So the flags are a thing the answer depends on, and changing one asks again.
 * Only when these layers are part of what is up: toggling an eye elsewhere in
 * the list would otherwise throw away a selection the player banded by hand.
 */
function toggle(layers, flag, enabled) {
  for (const layer of layers) {
    layer[flag] = !enabled;
  }
  state.layersChanged();
  if (worksOn(layers)) reactivate(layers[0]);
}

/** Whether any of these layers is part of what is being worked on. */
function worksOn(layers) {
  const group = state.activeGroup.value;
  if (group !== null) return layers.some((layer) => layer.group === group);
  return layers.some((layer) => layer.id === state.activeLayer.value);
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

/**
 * A layer renamed, once -- when the editor closes and not per keystroke, which
 * is what leaves an Escape something to put back. See `Name`.
 *
 * An empty name is no answer and is ignored, the way a group's is. The list is
 * drawn again either way: the editor has just gone, and the row has to come back
 * as text.
 */
function rename(layer, typed) {
  const name = typed.trim();
  if (name !== "") layer.name = name;
  state.layersChanged();
}

function groupNames() {
  return state.hideoutDocument.value?.groupNames() ?? [];
}

/**
 * A group holding one layer, which is all a new group can be: a group is a name
 * its layers carry, so it comes into being with its first member and not before.
 *
 * The layer becomes the group's only member and goes on being the layer worked
 * on, `reactivate` taking the group up instead when a group was up. Joining
 * moves the layer to the group's run -- here that is a run of one, and it is the
 * same `groupLayer` a drop calls.
 */
function addGroup(layer) {
  document_().groupLayer(layer.id, newGroupName());
  state.layersChanged();
  reactivate(layer);
}

/**
 * The next free `Group N`, the way a new layer is the next `Layer N`.
 *
 * Free rather than simply next: two groups cannot share a name -- sharing one
 * *is* being one group, see wiki/decisions/layer-groups.md -- so a `Group 2`
 * that a player renamed something else and a `Group 2` typed onto another group
 * both have to be stepped over, or "add group" would silently join one.
 */
function newGroupName() {
  const taken = groupNames();
  let number = taken.length + 1;
  while (taken.includes(`Group ${number}`)) number += 1;
  return `Group ${number}`;
}

/**
 * Takes up again whatever is being worked on, now that the membership has
 * changed. `fallback` is the layer that changed, and it is what is taken up when
 * the group that was active has just lost its last member.
 */
function reactivate(fallback) {
  const group = state.activeGroup.value;
  if (group === null) {
    const layer = document_().findLayer(state.activeLayer.value);
    if (layer) activate(layer);
    return;
  }

  const members = document_().layersInGroup(group);
  if (members.length > 0) {
    activateGroup(group, members);
    return;
  }
  activate(fallback);
}

/**
 * A group renamed, which is the name written on every member -- see
 * `model.renameGroup`. An empty name is no answer and is ignored, the way the
 * new-group prompt ignores one.
 *
 * The fold and the active group follow the name: they hold group names, and the
 * group they held is the one that has just been renamed.
 */
function renameGroup(group, renamed) {
  const name = renamed.trim();
  if (name === "" || name === group) {
    state.layersChanged();
    return;
  }

  document_().renameGroup(group, name);
  state.collapsedGroups.value = state.collapsedGroups.value.map((other) =>
    other === group ? name : other,
  );
  if (state.activeGroup.value === group) state.activeGroup.value = name;
  state.layersChanged();
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

/** A group, or an ungrouped layer, over its neighbour in the list. */
function moveEntry(index, offset) {
  document_().moveEntry(index, offset);
  state.layersChanged();
}

/** A layer over its neighbour inside its own group. */
function moveInGroup(layer, offset) {
  document_().moveInGroup(layer.id, offset);
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
 * A copy of a whole group, in a group of its own, which becomes the one being
 * worked on -- `duplicate`'s reasoning, one level up: the copy is made in order
 * to work on it, and it is standing exactly on the original.
 */
function duplicateGroup(group) {
  const copies = document_().duplicateGroup(group);
  state.doodadCount.value = document_().doodads.length;
  state.layersChanged();
  activateGroup(copies[0].group, copies);
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
 * **A layer in a group answers for itself.** It is one layer of several that
 * move together, and picking it says which one -- the group is picked by its own
 * row. See `activateGroup` and wiki/decisions/layer-groups.md.
 */
function activate(layer) {
  state.workOnLayer(layer.id);
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
 *
 * No layer is active while a group is. A group is not a place a doodad lands, so
 * the palette refuses and names the layer to pick instead -- falling through to
 * some member would be the editor answering the question the pick asks.
 */
function activateGroup(group, layers) {
  state.workOnGroup(group);
  state.editArray(null);
  state.movingArrays.value = layers
    .filter((layer) => isArray(layer) && layer.visible)
    .map((layer) => layer.id);
  state.requestSelection(
    layers
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
    state.workOnLayer(target.id);
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

/**
 * Deleting a group deletes its layers, so it says how many and what becomes of
 * their doodads -- `remove`'s rule, said once for all of them rather than once
 * per layer, which would be a row of confirms nobody reads by the third.
 *
 * The doodads go to a layer outside the group, `neighbourOfGroup`'s answer: a
 * member would be about to be deleted itself.
 */
function removeGroup(group, target) {
  const layers = document_().layersInGroup(group);
  if (!confirm(removeGroupWarning(group, layers, target))) return;

  document_().removeGroup(group, target.id);
  state.collapsedGroups.value = state.collapsedGroups.value.filter(
    (other) => other !== group,
  );
  state.editArray(null);
  state.movingArrays.value = [];
  state.requestSelection([]);
  state.doodadCount.value = document_().doodads.length;
  state.layersChanged();
  activate(target);
}

function removeGroupWarning(group, layers, target) {
  const arrays = layers.filter((layer) => isArray(layer));
  const kept = layers
    .filter((layer) => !isArray(layer))
    .reduce((total, layer) => total + doodadsIn(layer).length, 0);
  const generated = arrays.reduce(
    (total, layer) => total + doodadsIn(layer).length,
    0,
  );
  return (
    `Delete the group '${group}' and its ${layers.length} layers?\n\n` +
    `Their ${kept} doodads are not deleted. They move to the layer ` +
    `'${target.name}'.` +
    (arrays.length === 0
      ? ""
      : `\n\nThe ${arrays.length} arrays among them generate their own ` +
        `${generated} doodads, so those are deleted with them. Detach an array ` +
        `first to keep its doodads.`)
  );
}
