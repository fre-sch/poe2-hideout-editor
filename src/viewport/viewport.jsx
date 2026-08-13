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
import { loadTable, nameOf } from "../table.js";
import { Scene } from "./scene.js";

export default function Viewport() {
  const container = useRef(null);
  const scene = useRef(null);

  const hideout = state.hideoutDocument.value;
  const layers = state.layers.value;
  const hideoutType = state.hideoutType.value;
  const showLabels = state.showLabels.value;
  const showGrid = state.showGrid.value;
  const editedArray = state.editedArray.value;
  const arrayEdit = state.arrayEdit.value;
  const selectionRequest = state.selectionRequest.value;
  const hoveredDoodad = state.hoveredDoodad.value;
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
  // After the layer effect too: the gizmo is drawn for a layer of the document
  // the load effect has just put in place.
  useEffect(() => {
    scene.current.showArray(editedArray);
  }, [editedArray, layers]);
  // A fresh object per edit, so two edits saying the same thing run twice. It
  // comes after the layer effect, which is what makes the group of a brand new
  // array layer exist before its doodads are drawn into it.
  useEffect(() => {
    if (arrayEdit === null) return;
    scene.current.refreshArray(arrayEdit.layer);
  }, [arrayEdit]);
  useEffect(() => {
    scene.current.showBounds(hideoutType);
  }, [hideoutType]);
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
  // `null` is a value here and not "nothing asked for": it is the pointer having
  // left the row, and putting the doodad back is the whole of it.
  useEffect(() => {
    scene.current.highlightDoodad(hoveredDoodad);
  }, [hoveredDoodad]);
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

/**
 * The names over the doodads. `Labels` says where each one goes and for which
 * doodad, and the name is looked up here so that a table arriving -- or a
 * language switched -- renames them without the viewport being touched.
 *
 * It asks for the table itself, the way the Selection section does: labels name
 * hundreds of doodads at once, so they are the reader that most wants the
 * table's word rather than the file's. Turned off, they want nothing -- which is
 * what keeps a player who never opens the palette from fetching 400 kilobytes.
 */
function Overlay() {
  const document_ = state.hideoutDocument.value;
  const showLabels = state.showLabels.value;
  // A switch of language asks for another table without changing the document,
  // so it is a dependency of its own -- wiki issue 0053.
  const language = state.language.value;

  useEffect(() => {
    if (document_ && showLabels) loadTable(document_);
  }, [document_, showLabels, language]);

  return (
    <div id="label-overlay">
      {state.labels.value.map((label) => (
        <div class="label" style={{ left: label.x, top: label.y }}>
          {nameOf(label.doodad)}
        </div>
      ))}
    </div>
  );
}
