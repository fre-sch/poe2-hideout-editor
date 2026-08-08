/**
 * Application shell. Holds the layout only; the sidebar and the viewport are
 * rebuilt as components by the issues linked below.
 */
export default function App() {
  return (
    <>
      <div id="sidebar">
        <h1>Hideout Editor</h1>
        <p>
          The editor is being rewritten as a Preact application on a 2D canvas.
        </p>
        <p>
          The domain layer and the viewport are not part of this shell yet, see
          wiki issues 0017 and 0018.
        </p>
      </div>
      <div id="viewport-container"></div>
    </>
  );
}
