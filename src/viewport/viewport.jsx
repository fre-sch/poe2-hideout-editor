/**
 * The viewport as a Preact component: a container element, a `Scene` that owns
 * the `Konva.Stage` inside it, and one effect per thing the scene has to be
 * told.
 *
 * Reading a signal in the component body subscribes the component to it, so the
 * effects below run exactly when their value changes. That is the whole bridge
 * between state and canvas -- the 3D viewport needed a standing
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
  const layers = state.layers.value;
  const hideoutType = state.hideoutType.value;
  const viewportMode = state.viewportMode.value;
  const showLabels = state.showLabels.value;
  const showGrid = state.showGrid.value;
  const selectionRequest = state.selectionRequest.value;
  const placementRequest = state.placementRequest.value;

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
  // After the load effect, which builds the nodes this one places into groups.
  useEffect(() => {
    scene.current.showLayers(layers);
  }, [layers]);
  useEffect(() => {
    scene.current.showBounds(hideoutType);
  }, [hideoutType]);
  useEffect(() => {
    scene.current.setMode(viewportMode);
  }, [viewportMode]);
  useEffect(() => {
    scene.current.showLabels(showLabels);
  }, [showLabels]);
  useEffect(() => {
    scene.current.showGrid(showGrid);
  }, [showGrid]);
  // Each request is a fresh array, so asking twice for the same doodads runs
  // twice -- which is what a player pressing the button twice means.
  useEffect(() => {
    if (selectionRequest === null) return;
    scene.current.selectDoodads(selectionRequest);
  }, [selectionRequest]);
  // A fresh object per request, for the same reason: the palette placing the
  // same doodad twice is two placements.
  useEffect(() => {
    if (placementRequest === null) return;
    scene.current.placeDoodad(placementRequest);
  }, [placementRequest]);

  // Konva appends its canvases to the inner element, so nothing Preact renders
  // may live there -- the two would diff against each other's children.
  return (
    <div id="viewport-container">
      <div class="viewport-stage" ref={container} tabIndex={0} />
      <Band />
      <Overlay />
    </div>
  );
}

/**
 * The rubber band, as an element over the canvas rather than a shape inside it.
 * The view is turned, and a band drawn inside the stage would turn with it.
 */
function Band() {
  const area = state.band.value;
  if (area === null) return null;
  return (
    <div
      class="select-band"
      style={{
        left: area.x,
        top: area.y,
        width: area.width,
        height: area.height,
      }}
    />
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
