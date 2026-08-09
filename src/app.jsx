/**
 * Application shell. The sidebar, the viewport, and on the right the doodad
 * palette and an array's settings when either is open -- up to four columns,
 * the viewport taking whatever the others leave.
 *
 * The array settings go outside the palette rather than beside it: a player
 * configuring an array with the palette open is asking for both, and the
 * palette keeps the place it already had.
 *
 * Both are siblings of the viewport and not children of it, which is what keeps
 * their inputs out of the viewport's keyboard shortcuts -- those are bound to
 * the viewport's own container, wiki issue 0010.
 */

import Sidebar from "./gui/sidebar.jsx";
import Viewport from "./viewport/viewport.jsx";
import { ArraySidebar } from "./gui/arrays.jsx";
import { DoodadPalette } from "./gui/palette.jsx";
import { HelpModal } from "./gui/help.jsx";

export default function App() {
  return (
    <>
      <Sidebar />
      <Viewport />
      <DoodadPalette />
      <ArraySidebar />
      <HelpModal />
    </>
  );
}
