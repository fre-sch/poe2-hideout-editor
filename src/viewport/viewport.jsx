/**
 * The viewport as a Preact component: a container element, a `Scene` that owns
 * the `Konva.Stage` inside it, and one effect per thing the scene has to be
 * told.
 *
 * Reading a signal in the component body subscribes the component to it, so the
 * effects below run exactly when their value changes. That is the whole bridge
 * between state and canvas -- the three.js viewport needed a standing
 * `effect()` in `index.html` and a `saveHideoutFile` `CustomEvent` hop besides.
 *
 * The container is focusable because the shortcuts are bound to it and not to
 * the window, which is the last part of wiki issue 0010.
 */

import { useEffect, useRef } from "preact/hooks";

import * as state from "../state.js";
import { Scene } from "./scene.js";

export default function Viewport() {
  const container = useRef(null);
  const scene = useRef(null);

  const hideout = state.hideoutDocument.value;
  const hideoutType = state.hideoutType.value;
  const viewportMode = state.viewportMode.value;
  const showLabels = state.showLabels.value;

  useEffect(() => {
    scene.current = new Scene(container.current);
    const observer = new ResizeObserver(([entry]) =>
      scene.current.resize(entry.contentRect.width, entry.contentRect.height),
    );
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      scene.current.destroy();
      scene.current = null;
    };
  }, []);

  // Braces, not expression bodies: whatever an effect returns is called as its
  // cleanup, and `showBounds` returns a promise.
  useEffect(() => {
    scene.current.load(hideout);
  }, [hideout]);
  useEffect(() => {
    scene.current.showBounds(hideoutType);
  }, [hideoutType]);
  useEffect(() => {
    scene.current.setMode(viewportMode);
  }, [viewportMode]);
  useEffect(() => {
    scene.current.showLabels(showLabels);
  }, [showLabels]);

  // Konva appends its canvases to the inner element, so nothing Preact renders
  // may live there -- the two would diff against each other's children.
  return (
    <div id="viewport-container">
      <div class="viewport-stage" ref={container} tabIndex={0} />
      <Overlay />
    </div>
  );
}

function Overlay() {
  return (
    <div id="label-overlay">
      {state.labels.value.map((label) => (
        <div class="label" style={{ left: label.x, top: label.y }}>
          {label.text}
        </div>
      ))}
    </div>
  );
}
