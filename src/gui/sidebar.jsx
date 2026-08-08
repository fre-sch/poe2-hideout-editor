/**
 * The sidebar: everything the viewport is not.
 *
 * A column, so that the layer list can take whatever height the fixed sections
 * leave it. It is the one section whose length is the player's own doing.
 */

import File from "./file.jsx";
import Hideout from "./hideout.jsx";
import Layers from "./layers.jsx";
import Mode from "./mode.jsx";
import Selection from "./selection.jsx";
import { HelpButton } from "./help.jsx";

export default function Sidebar() {
  return (
    <div id="sidebar">
      <h1>PoE2 Hideout Editor</h1>
      <hr />
      <File />
      <Mode />
      <Hideout />
      <Layers />
      <Selection />
      <HelpButton />
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
