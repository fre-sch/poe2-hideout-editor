/**
 * The doodad node, which is where the domain meets the canvas.
 *
 * Konva builds nodes without a canvas -- only drawing needs one -- so the whole
 * of this is reachable in a test: the gizmo the SVG parses into, the placement,
 * and the rotation that has to survive a round trip through a file.
 */

import { describe, expect, it } from "vitest";

import { Doodad } from "../src/hideout/model.js";
import * as doodads from "../src/viewport/doodads.js";
import * as units from "../src/hideout/units.js";

const QUARTER_TURN = units.TURN / 4;

function doodad(fields) {
  return new Doodad("Stash", { hash: 3230065491, r: 0, fv: 0, ...fields });
}

describe("create", () => {
  it("puts the node where the axis swap says", () => {
    const node = doodads.create(doodad({ x: 10, y: 20 }));
    expect(node.position()).toEqual({ x: 20, y: 10 });
  });

  /**
   * Relative, and against the units rather than a number: the drawing decides
   * where a doodad at `r = 0` points and `GIZMO_ROTATION` decides how far that
   * is from the game, so neither belongs in an assertion about turning. Which
   * way a turn goes is `units.js`'s fact, and this asks it.
   */
  it("turns the node as far as the doodad turned", () => {
    const straight = doodads.create(doodad({ x: 0, y: 0, r: 0 }));
    const turned = doodads.create(doodad({ x: 0, y: 0, r: QUARTER_TURN }));

    expect(turned.rotation() - straight.rotation()).toBe(
      units.toDegrees(QUARTER_TURN),
    );
  });

  // The gizmo is drawn in its own units on its own page, so this is what says
  // it arrived scaled into doodad units and sitting on the doodad rather than
  // off to one side. Not an exact extent: how much of its page the drawing
  // fills is the drawing's business.
  it("draws the gizmo over the doodad, a few units across", () => {
    const node = doodads.create(doodad({ x: 100, y: 200 }));
    const box = node.getClientRect();

    for (const span of [box.width, box.height]) {
      expect(span).toBeGreaterThan(2);
      expect(span).toBeLessThan(12);
    }
    expect(box.x).toBeLessThan(200);
    expect(box.x + box.width).toBeGreaterThan(200);
    expect(box.y).toBeLessThan(100);
    expect(box.y + box.height).toBeGreaterThan(100);
  });
});

describe("apply", () => {
  /**
   * The gizmo is drawn turned away from `r = 0` by a constant, and this is the
   * guard that the constant never reaches a file: a doodad nobody touched must
   * save exactly as it was read.
   */
  it("leaves a doodad alone when nothing moved", () => {
    const untouched = doodad({ x: 116, y: 867, r: 58301 });
    doodads.apply(doodads.create(untouched));

    expect([untouched.x, untouched.y, untouched.r]).toEqual([116, 867, 58301]);
  });

  it("writes a dragged node back to its doodad, on the file's grid", () => {
    const moved = doodad({ x: 10, y: 20 });
    const node = doodads.create(moved);

    node.position({ x: 24.4, y: 13.7 });
    doodads.apply(node);

    expect([moved.x, moved.y]).toEqual([14, 24]);
    // Snapped, so what is drawn is what will be saved.
    expect(node.position()).toEqual({ x: 24, y: 14 });
  });

  /**
   * The acceptance criterion from wiki issue 0018: a quarter turn on screen is
   * exactly a quarter turn in the file, and turning back lands on exactly the
   * original. The criterion was written as `r + 16384`; it is `r - 16384`,
   * because the game counts `r` the other way round -- the size of the step is
   * what it was about.
   */
  it("round trips a quarter turn exactly", () => {
    const turned = doodad({ x: 0, y: 0, r: 58301 });
    const node = doodads.create(turned);

    node.rotation(node.rotation() + 90);
    doodads.apply(node);
    expect(turned.r).toBe(58301 - QUARTER_TURN);

    node.rotation(node.rotation() - 90);
    doodads.apply(node);
    expect(turned.r).toBe(58301);
  });

  /**
   * The last word on a scale, whatever left one on the node. Konva stops firing
   * `transform` at its own minimum box size, so the step-by-step undo below
   * cannot be the only place this happens.
   */
  it("draws a scaled node at the size the gizmo is drawn", () => {
    const node = doodads.create(doodad({ x: 1, y: 2 }));
    const drawn = node.scaleX();

    node.scale({ x: drawn * 4, y: drawn * 4 });
    doodads.apply(node);

    expect(node.scale()).toEqual({ x: drawn, y: drawn });
  });

  it("keeps hash and fv out of it", () => {
    const kept = doodad({ x: 1, y: 2, fv: 128 });
    const node = doodads.create(kept);

    node.position({ x: 9, y: 9 });
    doodads.apply(node);

    expect(kept.hash).toBe(3230065491);
    expect(kept.fv).toBe(128);
  });
});

/**
 * The whole of "scaling moves doodads apart", wiki issue 0038. The transformer
 * writes a scale, a rotation and a position onto a node; only the position is
 * a doodad's to keep.
 */
describe("unscale", () => {
  it("keeps where a resize put a node and drops the rest of it", () => {
    const stretched = doodad({ x: 10, y: 20, r: 58301 });
    const node = doodads.create(stretched);
    const drawn = node.scaleX();

    node.setAttrs({ x: 40, y: 60, scaleX: drawn * 3, scaleY: drawn * 3 });
    node.rotation(node.rotation() + 17);
    doodads.unscale(node);

    expect(node.position()).toEqual({ x: 40, y: 60 });
    expect(node.scale()).toEqual({ x: drawn, y: drawn });
    doodads.apply(node);
    expect(stretched.r).toBe(58301);
  });

  it("leaves a gizmo the size it was drawn", () => {
    const node = doodads.create(doodad({ x: 0, y: 0 }));
    const before = node.getClientRect();

    node.scale({ x: node.scaleX() * 5, y: node.scaleY() * 5 });
    doodads.unscale(node);

    expect(node.getClientRect()).toEqual(before);
  });
});

describe("setSelected", () => {
  it("colours a node and puts it back", () => {
    const node = doodads.create(doodad({ x: 0, y: 0 }));
    const normal = node.fill();

    doodads.setSelected(node, true);
    expect(node.fill()).not.toBe(normal);

    doodads.setSelected(node, false);
    expect(node.fill()).toBe(normal);
  });
});

describe("boundingRectangle", () => {
  it("has nothing to frame when nothing is selected", () => {
    expect(doodads.boundingRectangle([])).toBeNull();
  });

  it("spans every node, with room for the gizmo", () => {
    const nodes = [
      doodads.create(doodad({ x: 10, y: 20 })),
      doodads.create(doodad({ x: 30, y: 60 })),
    ];
    const box = doodads.boundingRectangle(nodes);

    // Stage coordinates, so the doodads' y spans the box's x.
    expect(box.x).toBeLessThan(20);
    expect(box.x + box.width).toBeGreaterThan(60);
    expect(box.y).toBeLessThan(10);
    expect(box.y + box.height).toBeGreaterThan(30);
  });
});
