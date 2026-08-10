/**
 * User layers as groups. Konva builds a scene graph without a canvas -- only
 * drawing needs one -- so parenting, ordering and the two flags are all
 * reachable here.
 *
 * The parent stands in as a `Konva.Group`, because a `Konva.Layer` is a real
 * `<canvas>` and there is none in a test. That `sync` does not notice is the
 * point: it needs somewhere to add groups, not a canvas.
 */

import Konva from "konva";
import { describe, expect, it } from "vitest";

import { Doodad, Layer } from "../src/hideout/model.js";
import * as doodads from "../src/viewport/doodads.js";
import * as groups from "../src/viewport/groups.js";

function layer(id, flags) {
  return new Layer({ id, name: id, ...flags });
}

function node(layerId) {
  return doodads.create(
    new Doodad("Stash", { hash: 3230065491, x: 0, y: 0, r: 0, fv: 0 }, layerId),
  );
}

function sync(layers, nodes, existing = new Map(), generated = new Set()) {
  return groups.sync(new Konva.Group(), existing, layers, nodes, generated);
}

describe("sync", () => {
  it("puts a node in the group of the layer its doodad names", () => {
    const nodes = [node("walls"), node("garden")];
    const current = sync([layer("walls"), layer("garden")], nodes);

    expect(nodes[0].getParent()).toBe(current.get("walls"));
    expect(nodes[1].getParent()).toBe(current.get("garden"));
  });

  it("moves a node when its doodad changes layer", () => {
    const nodes = [node("walls")];
    const layers = [layer("walls"), layer("garden")];
    const current = sync(layers, nodes);

    nodes[0].doodad.layer = "garden";
    sync(layers, nodes, current);

    expect(nodes[0].getParent()).toBe(current.get("garden"));
    expect(current.get("walls").getChildren()).toHaveLength(0);
  });

  it("keeps the groups it already has", () => {
    const layers = [layer("walls")];
    const first = sync(layers, []);

    expect(sync(layers, [], first).get("walls")).toBe(first.get("walls"));
  });

  it("takes no node with a layer that is gone", () => {
    // The doodads of a deleted layer move first, so the group it leaves behind
    // is empty by the time it is destroyed.
    const nodes = [node("walls")];
    const current = sync([layer("walls"), layer("garden")], nodes);

    nodes[0].doodad.layer = "garden";
    const left = sync([layer("garden")], nodes, current);

    expect(left.has("walls")).toBe(false);
    expect(nodes[0].getParent()).toBe(left.get("garden"));
  });

  it("draws the layers in list order, last on top", () => {
    const current = sync([layer("walls"), layer("garden")], []);

    expect(current.get("walls").zIndex()).toBeLessThan(
      current.get("garden").zIndex(),
    );
  });

  it("maps visible and locked onto the group", () => {
    const current = sync([layer("walls", { visible: false, locked: true })], []);

    expect(current.get("walls").visible()).toBe(false);
    expect(current.get("walls").listening()).toBe(false);
  });

  it("takes an array's group out of hit testing", () => {
    const layers = [layer("walls"), layer("hedge")];
    const current = sync(layers, [], new Map(), new Set(["hedge"]));

    expect(current.get("walls").listening()).toBe(true);
    expect(current.get("hedge").listening()).toBe(false);
    expect(current.get("hedge").visible()).toBe(true);
  });
});

describe("selectable", () => {
  it("is false for a locked layer and for a hidden one", () => {
    expect(groups.selectable(layer("walls"))).toBe(true);
    expect(groups.selectable(layer("walls", { locked: true }))).toBe(false);
    expect(groups.selectable(layer("walls", { visible: false }))).toBe(false);
  });

  /**
   * An array writes its doodads again whenever a parameter changes, so one that
   * could be dragged would move back by itself. Detach is how a player asks for
   * them by hand.
   */
  it("is false for the doodads an array generates", () => {
    expect(groups.selectable(layer("hedge"), true)).toBe(false);
  });

  it("is false for a node whose layer is not there at all", () => {
    expect(groups.selectable(undefined)).toBe(false);
  });
});
