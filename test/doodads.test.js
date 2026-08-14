/**
 * The doodad node, which is where the domain meets the canvas.
 *
 * Konva builds nodes without a canvas -- only drawing needs one -- so the whole
 * of this is reachable in a test: the gizmo the SVG parses into, the placement,
 * and the rotation that has to survive a round trip through a file.
 */

import { describe, expect, it } from "vitest";

import * as colors from "../src/hideout/colors.js";
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
  it("draws a scaled and sheared node the way the gizmo is drawn", () => {
    const node = doodads.create(doodad({ x: 1, y: 2 }));
    const drawn = node.scaleX();

    node.scale({ x: drawn * 4, y: drawn * 4 });
    node.skew({ x: 0.3, y: 0 });
    doodads.apply(node);

    expect(node.scale()).toEqual({ x: drawn, y: drawn });
    expect(node.skew()).toEqual({ x: 0, y: 0 });
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

  /**
   * Scaling a turned node unevenly is a shear, so Konva's `decompose` hands
   * back a `skewX` and `setAttrs` puts it on the node. Left there it compounds,
   * because the next step decomposes a matrix that already carries it.
   */
  it("takes the shear off a turned node", () => {
    const node = doodads.create(doodad({ x: 5, y: 5, r: 58301 }));

    node.skew({ x: 0.4, y: 0.2 });
    doodads.unscale(node);

    expect(node.skew()).toEqual({ x: 0, y: 0 });
  });
});

/**
 * The layer's colour on the doodads in it, wiki issue 0063. What a node wears
 * at rest is the layer's; the other two states are the editor's own and outdraw
 * it, or the player could not see what they are doing.
 */
describe("setColor", () => {
  it("draws a node in the colour it is given", () => {
    const node = doodads.create(doodad({ x: 0, y: 0 }));

    doodads.setColor(node, "#123456");

    expect(node.fill()).toBe("#123456");
  });

  it("outlines it in a lighter shade of the same colour", () => {
    const node = doodads.create(doodad({ x: 0, y: 0 }));

    doodads.setColor(node, "#123456");

    expect(node.stroke()).not.toBe(node.fill());
    expect(node.stroke()).toBe(colors.outline("#123456"));
  });

  it("does not disturb a selected node, and is worn when it is dropped", () => {
    const node = doodads.create(doodad({ x: 0, y: 0 }));
    doodads.setSelected(node, true);
    const selected = node.fill();

    doodads.setColor(node, "#123456");
    expect(node.fill()).toBe(selected);

    doodads.setSelected(node, false);
    expect(node.fill()).toBe("#123456");
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

/**
 * The three states overlap -- the highlighted doodad is one of the selected
 * ones -- so what matters is that neither setter forgets what the other said.
 */
describe("setHighlighted", () => {
  it("outdraws selected, and hands the node back to it", () => {
    const node = doodads.create(doodad({ x: 0, y: 0 }));
    doodads.setSelected(node, true);
    const selected = node.fill();

    doodads.setHighlighted(node, true);
    expect(node.fill()).not.toBe(selected);
    expect(node.strokeWidth()).toBeGreaterThan(1);

    doodads.setHighlighted(node, false);
    expect(node.fill()).toBe(selected);
    expect(node.strokeWidth()).toBe(1);
  });

  it("keeps the highlight through a change of selection", () => {
    const node = doodads.create(doodad({ x: 0, y: 0 }));
    doodads.setHighlighted(node, true);
    const highlighted = node.fill();

    doodads.setSelected(node, true);
    expect(node.fill()).toBe(highlighted);

    doodads.setSelected(node, false);
    expect(node.fill()).toBe(highlighted);
  });

  it("puts an unselected node back to normal", () => {
    const node = doodads.create(doodad({ x: 0, y: 0 }));
    const normal = node.fill();

    doodads.setHighlighted(node, true);
    doodads.setHighlighted(node, false);
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
