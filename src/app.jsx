/** Application shell. A sidebar and a viewport, side by side. */

import Sidebar from "./gui/sidebar.jsx";
import Viewport from "./viewport/viewport.jsx";

export default function App() {
  return (
    <>
      <Sidebar />
      <Viewport />
    </>
  );
}
