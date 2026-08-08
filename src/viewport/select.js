/**
 * Rubber-band selection: the rectangle maths, and the set semantics on top.
 *
 * The semantics are the three.js editor's and survive unchanged -- a committed
 * primary set, a transient set while the band is down, Shift adds, Ctrl
 * removes, merged when the drag ends. The plumbing underneath does not: in 3D
 * this needed a six-plane frustum and two modified copies of three.js addons,
 * 393 lines that also carried wiki issue 0004. In 2D it is
 * `intersects(one, other)`.
 *
 * The rectangles are screen pixels. That is not an implementation detail: the
 * view is turned -- see `stage.js` -- so an upright band and an upright node
 * box only exist on screen, and it is on screen that they may be compared as
 * plain overlapping rectangles.
 *
 * Nothing here imports Konva or touches the DOM, which is what makes it
 * testable. A node is anything `boundsOf` can measure.
 */

const REPLACE = "replace";
const ADD = "add";
const REMOVE = "remove";

/** The rectangle spanned by two points, whichever way round they were given. */
export function rectangle(one, other) {
  return {
    x: Math.min(one.x, other.x),
    y: Math.min(one.y, other.y),
    width: Math.abs(one.x - other.x),
    height: Math.abs(one.y - other.y),
  };
}

/**
 * Overlap, edges included. A click is a rectangle of no width or height, so
 * excluding the edges would make clicking a doodad impossible.
 */
export function intersects(one, other) {
  return (
    one.x <= other.x + other.width &&
    other.x <= one.x + one.width &&
    one.y <= other.y + other.height &&
    other.y <= one.y + one.height
  );
}

/**
 * Dispatches `changed` with the nodes that entered and left the selection, so
 * that a drag across a hideout recolours only what actually changed.
 */
export class Selection extends EventTarget {
  /** `boundsOf(node)` returns the node's rectangle in the band's own space. */
  constructor(boundsOf) {
    super();
    this.boundsOf = boundsOf;
    this.committed = new Set();
    this.preview = null;
    this.mode = REPLACE;
    this.reported = new Set();
  }

  /** The selection as it stands, drag in progress or not. */
  get nodes() {
    return [...(this.preview ?? this.committed)];
  }

  get size() {
    return (this.preview ?? this.committed).size;
  }

  /** Shift adds, Ctrl removes, neither replaces. Ctrl wins, as it did in 3D. */
  begin(event) {
    this.mode = event.ctrlKey ? REMOVE : event.shiftKey ? ADD : REPLACE;
    this.preview = this.combine([]);
    this.changed();
  }

  drag(area, candidates) {
    this.preview = this.combine(this.hit(area, candidates));
    this.changed();
  }

  end() {
    this.committed = this.preview ?? this.committed;
    this.preview = null;
    this.changed();
  }

  set(nodes) {
    this.committed = new Set(nodes);
    this.preview = null;
    this.changed();
  }

  clear() {
    this.set([]);
  }

  /** Forget nodes that no longer exist. Deletion is the only caller. */
  discard(nodes) {
    for (const node of nodes) {
      this.committed.delete(node);
      this.reported.delete(node);
    }
    this.changed();
  }

  hit(area, candidates) {
    return candidates.filter((node) => intersects(area, this.boundsOf(node)));
  }

  combine(hit) {
    if (this.mode === REPLACE) return new Set(hit);

    const combined = new Set(this.committed);
    for (const node of hit) {
      if (this.mode === ADD) combined.add(node);
      else combined.delete(node);
    }
    return combined;
  }

  /**
   * `settled` says the band is not down, so the selection will not change again
   * this gesture. Highlighting follows every step; anything more expensive --
   * rebuilding the sidebar list, re-attaching the transformer -- waits for it.
   */
  changed() {
    const current = this.preview ?? this.committed;
    const added = [...current].filter((node) => !this.reported.has(node));
    const removed = [...this.reported].filter((node) => !current.has(node));
    this.reported = new Set(current);
    this.dispatchEvent(
      new CustomEvent("changed", {
        detail: { added, removed, settled: this.preview === null },
      }),
    );
  }
}
