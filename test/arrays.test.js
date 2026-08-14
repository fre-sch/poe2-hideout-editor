/**
 * The array gizmo's geometry: the outline, and the rectangle the handles
 * transform.
 *
 * The gestures themselves need a canvas and are not here, which is the split
 * `transform.test.js` already makes. What is here is the part that can be wrong
 * silently -- a gizmo drawn beside the doodads it claims to be around, or a box
 * that shifts a little every time it is read back off its handles.
 *
 * Konva builds nodes without a canvas, so a real `Konva.Rect` stands in for the
 * one the transformer holds.
 */

import Konva from "konva";
import { describe, expect, it } from "vitest";

import * as arrays from "../src/viewport/arrays.js";
import * as generator from "../src/hideout/generator.js";
import * as units from "../src/hideout/units.js";

const STASH = { hash: 3230065491, name: "Stash", fv: 0 };

function array(parameters) {
  return {
    layer: "layer-2",
    source: [STASH],
    rotation: { base: 0, increment: 0, align: false },
    random: { seed: 1, jitter: { x: 0, y: 0, rotation: 0 }, variation: [] },
    ...parameters,
  };
}

/**
 * How far a doodad may be off its own outline: the rounding `doodadAt` does and
 * nothing else. It rounds each axis onto the file's integer grid, so half a unit
 * each way, and the two together reach half a diagonal.
 */
const ROUNDING = Math.SQRT1_2;

const BOX = {
  center: { x: 400, y: 300 },
  width: 120,
  height: 80,
  rotation: 37,
};

/** The outline's flat point list back as points. */
function pairs(points) {
  const at = [];
  for (let index = 0; index < points.length; index += 2) {
    at.push({ x: points[index], y: points[index + 1] });
  }
  return at;
}

/** How far a point is from the nearest of an outline's segments. */
function distanceToOutline(point, outline) {
  const corners = pairs(arrays.stagePoints(outline));
  const ends = outline.closed ? [...corners, corners[0]] : corners;
  return Math.min(
    ...ends.slice(1).map((end, index) => toSegment(point, ends[index], end)),
  );
}

function toSegment(point, from, to) {
  const span = { x: to.x - from.x, y: to.y - from.y };
  const length = span.x * span.x + span.y * span.y;
  const along =
    length === 0
      ? 0
      : clamp(
          ((point.x - from.x) * span.x + (point.y - from.y) * span.y) / length,
          0,
          1,
        );
  return Math.hypot(
    point.x - (from.x + span.x * along),
    point.y - (from.y + span.y * along),
  );
}

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}

describe("stagePoints", () => {
  it("converts an outline through the one axis swap there is", () => {
    const outline = {
      points: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      closed: false,
    };

    expect(arrays.stagePoints(outline)).toEqual([2, 1, 4, 3]);
  });

  /**
   * The whole point of drawing the generator's own polyline: what a player sees
   * and what the doodads sit on cannot disagree. `ROUNDING` is the only
   * difference there is allowed to be.
   */
  it("puts every outline shape on top of its own doodads", () => {
    const shapes = [
      { type: "ellipse", box: BOX, resolution: 12 },
      { type: "polygon", corners: 5, box: BOX, resolution: 15 },
      {
        type: "line",
        ends: { start: { x: 100, y: 120 }, end: { x: 260, y: 400 } },
        resolution: 7,
      },
    ];

    for (const shape of shapes) {
      const parameters = array(shape);
      const outline = generator.outline(parameters);
      for (const doodad of generator.generate(parameters)) {
        expect(
          distanceToOutline(units.toStage(doodad), outline),
        ).toBeLessThanOrEqual(ROUNDING);
      }
    }
  });

  /**
   * A grid is the one shape whose doodads are not on its outline. They are at
   * cell centres, so every one of them is a clear margin inside the box -- half
   * a cell, and the smallest cell here is 20 across.
   */
  it("draws a grid's box around the lattice inside it", () => {
    const parameters = array({
      type: "grid",
      box: BOX,
      resolution: { x: 4, y: 3 },
    });
    const outline = generator.outline(parameters);

    expect(pairs(arrays.stagePoints(outline))).toHaveLength(4);
    for (const doodad of generator.generate(parameters)) {
      expect(distanceToOutline(units.toStage(doodad), outline)).toBeGreaterThan(
        10,
      );
    }
  });
});

/**
 * The proxies a layer group's arrays ride on. What the transformer does to them
 * is Konva's and needs a canvas; what is checked here is the two ends of the
 * mechanism -- a proxy standing where its array stands, and a proxy that has
 * been moved saying so in the parameters.
 */
describe("Movers", () => {
  function grid(box = BOX) {
    return array({ type: "grid", box, resolution: { x: 3, y: 2 } });
  }

  /** A `Movers` over one array, and the parameters it is looking at. */
  function movers(parameters = grid()) {
    const held = { "layer-2": parameters };
    const find = (layer) => held[layer];
    const movers_ = new arrays.Movers(new Konva.Group(), find);
    movers_.show(["layer-2"]);
    return { movers: movers_, held, node: movers_.nodes[0] };
  }

  it("anchors a proxy on its array's centre", () => {
    const { node } = movers();

    expect(node.position()).toEqual(units.toStage(BOX.center));
  });

  it("covers the shape's extent, so the box around it holds the array", () => {
    const { node } = movers();
    const drawn = pairs(arrays.stagePoints(generator.outline(grid())));

    const box = node.getClientRect();
    for (const corner of drawn) {
      expect(corner.x).toBeGreaterThanOrEqual(box.x - 1e-9);
      expect(corner.x).toBeLessThanOrEqual(box.x + box.width + 1e-9);
      expect(corner.y).toBeGreaterThanOrEqual(box.y - 1e-9);
      expect(corner.y).toBeLessThanOrEqual(box.y + box.height + 1e-9);
    }
  });

  it("has nothing to say for a layer carrying no array", () => {
    const movers_ = new arrays.Movers(new Konva.Group(), () => undefined);
    movers_.show(["layer-9"]);

    expect(movers_.nodes).toEqual([]);
  });

  it("writes a proxy's displacement into the array's geometry", () => {
    const { movers: movers_, held, node } = movers();
    movers_.begin();
    const at = node.position();
    node.position({ x: at.x + 30, y: at.y - 12 });
    movers_.follow();

    // The stage's axes are the file's, swapped: `units.js` and nowhere else.
    expect(held["layer-2"].box.center).toEqual({ x: 388, y: 330 });
    expect(held["layer-2"].box.rotation).toBe(BOX.rotation);
  });

  it("writes a proxy's turn into the array's angle", () => {
    const { movers: movers_, held, node } = movers();
    movers_.begin();
    node.rotation(90);
    movers_.follow();

    expect(held["layer-2"].box.rotation).toBe(BOX.rotation + 90);
    expect(held["layer-2"].box.center).toEqual(BOX.center);
  });

  /**
   * The reason a mover names a layer instead of holding a generator: aligning a
   * group replaces the parameters, and a mover holding the old object would move
   * something nothing draws. See `state.js` for the same reasoning about
   * `editedArray`.
   */
  it("follows the parameters when the array is replaced", () => {
    const { movers: movers_, held, node } = movers();
    movers_.begin();
    const replaced = grid();
    held["layer-2"] = replaced;

    const at = node.position();
    node.position({ x: at.x, y: at.y + 10 });
    movers_.follow();

    expect(replaced.box.center).toEqual({ x: 410, y: 300 });
  });

  it("gives back the nodes of the arrays a layer edit has left", () => {
    const { movers: movers_ } = movers();

    expect(movers_.keepOnly(["layer-2"])).toBe(false);
    expect(movers_.keepOnly([])).toBe(true);
    expect(movers_.nodes).toEqual([]);
  });
});

describe("rectOf and boxOf", () => {
  it("reads a box back off the rectangle it was drawn as", () => {
    const rect = new Konva.Rect(arrays.rectOf(BOX));

    expect(arrays.boxOf(rect)).toEqual(BOX);
  });

  /**
   * The rectangle's position is its centre at any scale, which is what a
   * rotation turns about and what the handles leave alone while they resize.
   */
  it("keeps the centre where the scale is", () => {
    const rect = new Konva.Rect(arrays.rectOf(BOX));
    rect.scale({ x: 2, y: 0.5 });

    expect(arrays.boxOf(rect)).toEqual({
      center: BOX.center,
      width: 240,
      height: 40,
      rotation: 37,
    });
  });

  /**
   * A resize the handles wrote is a scale, and a generator's box has none. The
   * fold has to survive being drawn again, or a box would grow by its own scale
   * every time a gesture ended.
   */
  it("folds a scale into the size and leaves nothing behind", () => {
    const rect = new Konva.Rect(arrays.rectOf(BOX));
    rect.scale({ x: 3, y: 3 });

    const folded = new Konva.Rect(arrays.rectOf(arrays.boxOf(rect)));

    expect(folded.scaleX()).toBe(1);
    expect(folded.scaleY()).toBe(1);
    expect(arrays.boxOf(folded)).toEqual({
      center: BOX.center,
      width: 360,
      height: 240,
      rotation: 37,
    });
  });

  /** The corners of the drawn rectangle are the corners of the drawn box. */
  it("covers the same four corners a grid's outline is drawn through", () => {
    const rect = new Konva.Rect(arrays.rectOf(BOX));
    const drawn = pairs(
      arrays.stagePoints(generator.outline(array({ type: "grid", box: BOX }))),
    );

    const corners = [
      { x: 0, y: 0 },
      { x: rect.width(), y: 0 },
      { x: rect.width(), y: rect.height() },
      { x: 0, y: rect.height() },
    ].map((corner) => rect.getAbsoluteTransform().point(corner));

    for (const corner of corners) {
      expect(
        Math.min(
          ...drawn.map((point) =>
            Math.hypot(point.x - corner.x, point.y - corner.y),
          ),
        ),
      ).toBeLessThan(1e-9);
    }
  });
});
