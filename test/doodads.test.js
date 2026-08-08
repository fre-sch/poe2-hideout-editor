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
import { TURN } from "../src/hideout/units.js";

const QUARTER_TURN = TURN / 4;

function doodad(fields) {
  return new Doodad("Stash", { hash: 3230065491, r: 0, fv: 0, ...fields });
}

describe("create", () => {
  it("puts the node where the axis swap says", () => {
    const node = doodads.create(doodad({ x: 10, y: 20 }));
    expect(node.position()).toEqual({ x: 20, y: 10 });
  });

  it("turns the node to face the way the doodad does", () => {
    const node = doodads.create(doodad({ x: 0, y: 0, r: QUARTER_TURN }));
    expect(node.rotation()).toBe(90);
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
   * The acceptance criterion from wiki issue 0018: a quarter turn is exactly
   * `r + 16384`, and turning back lands on exactly the original.
   */
  it("round trips a quarter turn exactly", () => {
    const turned = doodad({ x: 0, y: 0, r: 58301 });
    const node = doodads.create(turned);

    node.rotation(node.rotation() + 90);
    doodads.apply(node);
    expect(turned.r).toBe((58301 + QUARTER_TURN) % TURN);

    node.rotation(node.rotation() - 90);
    doodads.apply(node);
    expect(turned.r).toBe(58301);
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
