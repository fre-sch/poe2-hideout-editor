/**
 * The sidebar: everything the viewport is not.
 *
 * A column, so that the layer list can take whatever height the fixed sections
 * leave it. It is the one section whose length is the player's own doing.
 */

// The one place a version is written. Vite reads JSON as a module with named
// exports, so the bundle carries the string and not the manifest.
import { version } from "../../package.json";

import File from "./file.jsx";
import Hideout from "./hideout.jsx";
import Tabs from "./tabs.jsx";
import View from "./view.jsx";
import { HelpButton } from "./help.jsx";

export default function Sidebar() {
  return (
    <div class="sidebar" id="sidebar">
      {/* A player reports a problem about a build, and a page they have had
          open for a week is a build neither of us can name otherwise. */}
      <h1>
        PoE2 Hideout Editor <small class="version-stamp">v{version}</small>
      </h1>
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
