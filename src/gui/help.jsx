/**
 * The shortcuts, as a modal and as the button that raises it.
 *
 * It opens by itself the first time, because the editor is its mouse gestures
 * and nothing on screen spells them out. Everything after that is one keypress
 * away, which is worth more than the sidebar height a permanent list costs --
 * and the checkbox decides whether "after that" includes the next load. The
 * preference is `state.showHelpOnLoad`, written when the modal closes.
 *
 * A native `<dialog>`: Bootstrap's modal needs Bootstrap's JavaScript, which
 * index.html deliberately does not load, and the element already does the
 * backdrop, the focus trap and Escape on its own.
 *
 * The shortcuts work while the viewport has focus, so clicking it comes first.
 * They are bound to the viewport rather than the window on purpose -- wiki
 * issue 0010 -- and this is where a player finds that out.
 */

import { useEffect, useRef } from "preact/hooks";

import * as state from "../state.js";

export function HelpButton() {
  return (
    <button
      type="button"
      class="btn btn-link btn-sm"
      onClick={() => {
        state.showHelp.value = true;
      }}
    >
      Help
    </button>
  );
}

export function HelpModal() {
  const dialog = useRef(null);
  const shown = state.showHelp.value;

  // `showModal` is what makes it modal; the `open` attribute alone does not.
  useEffect(() => {
    if (shown) dialog.current.showModal();
    else dialog.current.close();
  }, [shown]);

  return (
    <dialog
      class="help-modal"
      ref={dialog}
      // Escape and the backdrop close the element without asking, so the signal
      // follows the element rather than the other way round -- and the
      // preference is written on the way out, however the player left.
      onClose={() => {
        state.showHelp.value = false;
        state.rememberHelpPreference();
      }}
    >
      <h2>Help</h2>
      <p class="usage-text">
        The shortcuts reach the editor while the viewport has focus. Click it
        once if a key does nothing.
      </p>
      <Shortcuts />
      <form
        method="dialog"
        class="d-flex justify-content-between align-items-center"
      >
        <ShowAgain />
        <button type="submit" class="btn btn-primary btn-sm">
          Close
        </button>
      </form>
    </dialog>
  );
}

/**
 * Unticked, the modal has said its piece and stays out of the way until it is
 * asked for. It is worded as what happens next, not as what to switch off,
 * because a player meets it before they know what it would be switching off.
 */
function ShowAgain() {
  return (
    <div class="form-check mb-0">
      <input
        id="show-help-on-load"
        class="form-check-input"
        type="checkbox"
        checked={state.showHelpOnLoad.value}
        onChange={(event) => {
          state.showHelpOnLoad.value = event.currentTarget.checked;
        }}
      />
      <label class="form-check-label" for="show-help-on-load">
        Show this again on every load
      </label>
    </div>
  );
}

function Shortcuts() {
  return (
    <ul class="ms-0 ps-3">
      <li>
        Drag <span class="shortcut">left mouse button</span> to select.
        <br />
        Hold <span class="shortcut">Shift</span> to add,{" "}
        <span class="shortcut">Ctrl</span> to remove. Either one also selects
        inside the box, where a plain drag would move the selection.
      </li>
      <li>
        Drag <span class="shortcut">inside the selection box</span> to move the
        selection. Drag the box's corners to spread the doodads out, and the
        handle above it to turn them.
      </li>
      <li>
        Drag <span class="shortcut">an array's outline</span> to move it, and
        its handles to resize, turn or bend it. They are up while the array is
        the layer being worked on.
      </li>
      <li>
        <span class="shortcut">Click a row</span> in the layer list to work on
        that layer: new doodads land there, and its doodads are selected. The
        row is marked while it is the one being worked on.
      </li>
      <li>
        Put layers in the same <span class="shortcut">group</span> to move them
        as one. <span class="shortcut">Drag a layer row</span> onto a group row
        to put it in that group, and onto the strip at the end of the list to
        take it out again; <span class="shortcut">Add group</span> makes a new
        group out of the layer being worked on. The group gets a row of its own
        in the list: pick that row and the box holds every layer of it, arrays
        included, and moves and turns them together — pick a layer under it and
        you are working on that layer alone. A group move does not spread
        doodads out; for that, the selection box and an array's own box are
        still there.
      </li>
      <li>
        <span class="shortcut">Double-click</span> a layer or group name in the
        list to rename it. <span class="shortcut">Enter</span> accepts the new
        name, <span class="shortcut">Esc</span> puts the old one back, and
        clicking away accepts.
      </li>
      <li>
        Drag <span class="shortcut">middle mouse button</span> to pan.
      </li>
      <li>
        Drag <span class="shortcut">right mouse button</span> to turn the view.
        Turn it to line the selection box up with a row of doodads that runs
        diagonally.
      </li>
      <li>
        <span class="shortcut">Mouse wheel</span> zooms about the pointer.
      </li>
      <li>
        <span class="shortcut">Del</span> deletes the selection,{" "}
        <span class="shortcut">Esc</span> clears it.
      </li>
      <li>
        <span class="shortcut">f</span> frames the selection,{" "}
        <span class="shortcut">g</span> turns the view back to the game's
        perspective.
      </li>
      <li>
        <span class="shortcut">h</span> shows this help again.
      </li>
    </ul>
  );
}
