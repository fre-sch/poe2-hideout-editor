/**
 * Doodad names, as DOM elements over the canvas.
 *
 * The projection is the 3D editor's, minus the camera: a node's absolute
 * position already is a pixel offset into the stage, so there is no normalized
 * device coordinate step left to do.
 *
 * What does not port is *when* it ran. The old viewport rebuilt every label on
 * every `render()`, which included every mouse move of a rubber-band drag --
 * wiki issue 0010. Here a rebuild is asked for only when the view moved or the
 * doodads did, and several such asks in one frame collapse into one.
 */

/** Dispatches nothing; it calls `publish` with the list to render. */
export class Labels {
  constructor(publish) {
    this.publish = publish;
    this.enabled = true;
    this.frame = null;
    this.pending = null;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.pending) this.refresh(...this.pending);
    else if (!enabled) this.publish([]);
  }

  /**
   * `collectNodes` is called in the frame that renders and not here. Which
   * doodads are on show is a pass over the whole hideout, and every ask inside
   * one frame would get the same answer -- an answer the labels do not need at
   * all when they are turned off.
   */
  refresh(collectNodes, stage) {
    this.pending = [collectNodes, stage];
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      const [collectPending, pendingStage] = this.pending;
      this.publish(this.enabled ? visible(collectPending(), pendingStage) : []);
    });
  }

  destroy() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }
}

/**
 * One entry per node whose position falls inside the canvas.
 *
 * Culling is not only cosmetic: a hideout runs to hundreds of doodads and each
 * label is a DOM element, so the cull is what keeps a zoomed-in edit cheap.
 */
export function visible(nodes, stage) {
  const width = stage.width();
  const height = stage.height();
  const labels = [];

  for (const node of nodes) {
    const position = node.getAbsolutePosition();
    if (position.x < 0 || position.x > width) continue;
    if (position.y < 0 || position.y > height) continue;
    labels.push({
      x: Math.round(position.x),
      y: Math.round(position.y),
      text: node.doodad.name,
    });
  }
  return labels;
}
