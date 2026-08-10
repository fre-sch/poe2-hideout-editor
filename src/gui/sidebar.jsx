/**
 * The sidebar: everything the viewport is not.
 *
 * A column, so that the layer list can take whatever height the fixed sections
 * leave it. It is the one section whose length is the player's own doing.
 */

import File from "./file.jsx";
import Hideout from "./hideout.jsx";
import Layers from "./layers.jsx";
import Selection from "./selection.jsx";
import View from "./view.jsx";
import { HelpButton } from "./help.jsx";

export default function Sidebar() {
  return (
    <div id="sidebar">
      <h1>PoE2 Hideout Editor</h1>
      <hr />
      <File />
      <Hideout />
      {/* Above the layer list, which is the section that takes whatever height
          is left: a selection is read and clicked while it is being made, and
          the bottom of a long sidebar is not where a player is looking. It
          renders nothing at all with nothing selected, so it costs the sections
          below it no room until it has something to say. */}
      <Selection />
      <Layers />
      <View />
      <div class="text-center">
        <HelpButton />
        <br />
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
