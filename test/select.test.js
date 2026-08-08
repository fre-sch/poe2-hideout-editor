/**
 * Selection semantics, which the three.js editor could not test at all: they
 * were entangled with a camera, a frustum and two vendored addons.
 */

import { describe, expect, it } from "vitest";

import * as select from "../src/viewport/select.js";

function node(x, y) {
  return { rectangle: { x, y, width: 2, height: 2 } };
}

function selection() {
  return new select.Selection((item) => item.rectangle);
}

const first = node(0, 0);
const second = node(10, 10);
const third = node(20, 20);
const all = [first, second, third];

/** Everything from `low` to `high` on both axes. */
function area(low, high) {
  return select.rectangle({ x: low, y: low }, { x: high, y: high });
}

describe("rectangle", () => {
  it("spans two points whichever way round they are given", () => {
    const expected = { x: 1, y: 2, width: 4, height: 6 };
    expect(select.rectangle({ x: 1, y: 2 }, { x: 5, y: 8 })).toEqual(expected);
    expect(select.rectangle({ x: 5, y: 8 }, { x: 1, y: 2 })).toEqual(expected);
  });
});

describe("intersects", () => {
  const one = { x: 0, y: 0, width: 10, height: 10 };

  it("finds an overlap", () => {
    expect(select.intersects(one, { x: 5, y: 5, width: 10, height: 10 })).toBe(
      true,
    );
  });

  it("finds no overlap when the rectangles are apart", () => {
    expect(select.intersects(one, { x: 11, y: 0, width: 1, height: 1 })).toBe(
      false,
    );
  });

  // A click is a rectangle of no size, so the edges have to count.
  it("counts a touching edge, and a click on one", () => {
    expect(select.intersects(one, { x: 10, y: 0, width: 0, height: 0 })).toBe(
      true,
    );
  });
});

describe("Selection", () => {
  it("replaces with what the band covered", () => {
    const selected = selection();
    selected.begin({});
    selected.drag(area(-1, 12), all);
    selected.end();
    expect(selected.nodes).toEqual([first, second]);
  });

  it("adds with Shift", () => {
    const selected = selection();
    selected.set([first]);
    selected.begin({ shiftKey: true });
    selected.drag(area(9, 12), all);
    selected.end();
    expect(selected.nodes).toEqual([first, second]);
  });

  it("removes with Ctrl", () => {
    const selected = selection();
    selected.set([first, second]);
    selected.begin({ ctrlKey: true });
    selected.drag(area(9, 12), all);
    selected.end();
    expect(selected.nodes).toEqual([first]);
  });

  it("shows the drag before it is committed, and forgets it if it moves on", () => {
    const selected = selection();
    selected.set([third]);
    selected.begin({});
    selected.drag(area(-1, 1), all);
    expect(selected.nodes).toEqual([first]);
    selected.drag(area(9, 12), all);
    expect(selected.nodes).toEqual([second]);
  });

  it("reports what entered and left, and whether the band is down", () => {
    const selected = selection();
    const changes = [];
    selected.addEventListener("changed", (event) => changes.push(event.detail));

    selected.begin({});
    selected.drag(area(-1, 1), all);
    selected.end();

    expect(changes.map((change) => change.settled)).toEqual([false, false, true]);
    expect(changes[1].added).toEqual([first]);
    expect(changes[2].added).toEqual([]);
  });

  it("forgets discarded nodes", () => {
    const selected = selection();
    selected.set([first, second]);
    selected.discard([first]);
    expect(selected.nodes).toEqual([second]);
  });
});
