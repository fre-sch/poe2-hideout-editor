/**
 * Moving and rotating the selection.
 *
 * `Konva.Transformer` does not re-parent the nodes it transforms, which is the
 * single reason wiki/decisions/transform-control-reparenting.md is retired and
 * the two data-loss bugs it explains cannot be written here.
 *
 * Resizing is off: a doodad has `hash`, `x`, `y`, `r` and `fv`, and no scale.
 */

import Konva from "konva";

import * as doodads from "./doodads.js";

export const SELECT = "select";
export const TRANSLATE = "translate";
export const ROTATE = "rotate";

const ROTATION_SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];
const ROTATION_SNAP_TOLERANCE = 6;

/**
 * Dispatches `changed` once a move or a rotation has been written back to the
 * domain doodads.
 */
export class Transform extends EventTarget {
  constructor(layer) {
    super();

    this.konva = new Konva.Transformer({
      resizeEnabled: false,
      rotateEnabled: false,
      // Dragging anywhere inside the box moves the whole selection, rather than
      // only the node the pointer happens to be over.
      shouldOverdrawWholeArea: true,
      rotationSnaps: ROTATION_SNAPS,
      rotationSnapTolerance: ROTATION_SNAP_TOLERANCE,
      ignoreStroke: true,
    });
    layer.add(this.konva);

    this.konva.on("dragend", this.commit);
    this.konva.on("transformend", this.commit);
    this.setMode(SELECT);
  }

  /**
   * In select mode the transformer is empty, so the rubber band has the canvas
   * to itself. Dragging is enabled on the nodes rather than on the transformer
   * because that is what Konva proxies a whole-selection drag through -- and
   * leaving it off outside translate mode is what stops an unselected doodad
   * from being dragged by accident.
   */
  setMode(mode) {
    this.mode = mode;
    this.konva.rotateEnabled(mode === ROTATE);
    this.konva.visible(mode !== SELECT);
    this.setNodes(this.nodes ?? []);
  }

  setNodes(nodes) {
    for (const node of this.nodes ?? []) {
      node.draggable(false);
    }
    this.nodes = nodes;
    if (this.mode === TRANSLATE) {
      for (const node of nodes) {
        node.draggable(true);
      }
    }
    this.konva.nodes(this.mode === SELECT ? [] : nodes);
  }

  commit = () => {
    for (const node of this.konva.nodes()) {
      doodads.apply(node);
    }
    // The nodes just snapped onto the grid, so the box around them moved.
    this.konva.forceUpdate();
    this.dispatchEvent(new CustomEvent("changed"));
  };
}
