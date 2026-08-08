/**
 * Application shell. A sidebar and a viewport, side by side.
 *
 * The palette is a sibling of the viewport and not a child of it, which is what
 * keeps its search input out of the viewport's keyboard shortcuts -- those are
 * bound to the viewport's own container, wiki issue 0010.
 */

import Sidebar from "./gui/sidebar.jsx";
import Viewport from "./viewport/viewport.jsx";
import { DoodadPalette } from "./gui/palette.jsx";
import { HelpModal } from "./gui/help.jsx";

export default function App() {
  return (
    <>
      <Sidebar />
      <Viewport />
      <DoodadPalette />
      <HelpModal />
    </>
  );
}
