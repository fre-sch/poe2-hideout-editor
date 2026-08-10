/**
 * The sidebar: everything the viewport is not.
 *
 * A column, so that the layer list can take whatever height the fixed sections
 * leave it. It is the one section whose length is the player's own doing.
 */

import File from "./file.jsx";
import Hideout from "./hideout.jsx";
import Tabs from "./tabs.jsx";
import View from "./view.jsx";
import { HelpButton } from "./help.jsx";

export default function Sidebar() {
  return (
    <div id="sidebar">
      <h1>PoE2 Hideout Editor</h1>
      <hr />
      <File />
      <Hideout />
      {/* The layers and the selection, tabbed: see `tabs.jsx`. One section, and
          the section that takes whatever height the fixed ones leave. */}
      <Tabs />
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
