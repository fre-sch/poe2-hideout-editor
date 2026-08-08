/** The sidebar: everything the viewport is not. */

import File from "./file.jsx";
import Hideout from "./hideout.jsx";
import Mode from "./mode.jsx";
import Selection from "./selection.jsx";

export default function Sidebar() {
  return (
    <div id="sidebar">
      <h1>PoE2 Hideout Editor</h1>
      <hr />
      <File />
      <Mode />
      <Hideout />
      <Selection />
      <Help />
      <div class="text-center">
        <a href="https://github.com/fre-sch/poe2-hideout-editor/issues">
          Report problem or add suggestion
        </a>
        <br />
        <a href="https://github.com/fre-sch/poe2-hideout-editor">
          Code on github
        </a>
      </div>
    </div>
  );
}

/**
 * The shortcuts work while the viewport has focus, so clicking it comes first.
 * They are bound to the viewport rather than the window on purpose -- wiki
 * issue 0010 -- and this is where a player finds that out.
 */
function Help() {
  return (
    <details class="sidebar-item" open>
      <summary>Help</summary>
      <ul class="ms-0 ps-3">
        <li>
          Drag <span class="shortcut">left mouse button</span> to select.
          <br />
          Hold <span class="shortcut">Shift</span> to add,{" "}
          <span class="shortcut">Ctrl</span> to remove.
        </li>
        <li>
          Drag <span class="shortcut">middle mouse button</span> to pan.
        </li>
        <li>
          Drag <span class="shortcut">right mouse button</span> to turn the
          view. Turn it to line the selection box up with a row of doodads that
          runs diagonally.
        </li>
        <li>
          <span class="shortcut">Mouse wheel</span> zooms about the pointer.
        </li>
        <li>
          <span class="shortcut">Del</span> deletes the selection.
        </li>
        <li>
          <span class="shortcut">1</span> select,{" "}
          <span class="shortcut">2</span> move, <span class="shortcut">3</span>{" "}
          rotate.
        </li>
        <li>
          <span class="shortcut">f</span> frames the selection,{" "}
          <span class="shortcut">g</span> turns the view back to the game's
          perspective.
        </li>
      </ul>
    </details>
  );
}
