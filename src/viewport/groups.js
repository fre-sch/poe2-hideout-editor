/**
 * User layers, as `Konva.Group` nodes inside the one doodad layer.
 *
 * Not `Konva.Layer` nodes: each of those is a real `<canvas>` and the stage
 * keeps exactly three. see decisions/2d-rendering-with-konva.
 *
 * A group carries the two flags a layer has, one property each: `visible` hides
 * the whole group in one draw, `listening` takes it out of hit testing.
 *
 * Which group a node sits in is derived from `doodad.layer` and nowhere else.
 * Not the re-parenting of decisions/transform-control-reparenting: the
 * document's array still holds every doodad exactly once, and a group is a
 * drawing detail read off it.
 */

import Konva from "konva";

/**
 * Puts `nodes` into a group per layer, in layer order, and drops the groups of
 * layers that are gone.
 *
 * `existing` maps layer id to group; the returned map replaces it. Nodes move
 * before anything is destroyed, so a deleted layer whose doodads went elsewhere
 * takes no node with it.
 *
 * `generated` is the ids of the layers carrying an array. Their doodads are
 * computed and would be overwritten by the next regeneration, so the group is
 * taken out of hit testing -- see `selectable`.
 */
export function sync(parent, existing, layers, nodes, generated = new Set()) {
  const current = new Map();
  for (const layer of layers) {
    current.set(layer.id, existing.get(layer.id) ?? added(parent, layer.id));
  }

  // Every doodad names a layer that exists, `removeLayer` handing them on
  // rather than orphaning them, so a node with no group is a broken document
  // and says so rather than being destroyed with the group it sat in.
  for (const node of nodes) {
    const group = current.get(node.doodad.layer);
    if (!group) throw new Error(`No layer '${node.doodad.layer}' to draw in`);
    if (node.getParent() !== group) group.add(node);
  }

  for (const [id, group] of existing) {
    if (!current.has(id)) group.destroy();
  }

  // In layer order, so the last layer draws on top. Order is the player's
  // statement about which doodads matter, and it decides export order too.
  for (const layer of layers) {
    const group = current.get(layer.id);
    group.visible(layer.visible);
    group.listening(selectable(layer, generated.has(layer.id)));
    group.moveToTop();
  }
  return current;
}

/**
 * Whether a layer's doodads can be picked. Locked says so outright, and hidden
 * says it by implication -- a band that selects what a player cannot see is a
 * band that deletes what a player cannot see.
 *
 * An array's are refused for a third reason: they are derived, and the array
 * writes them again whenever a parameter changes. A doodad that moves back by
 * itself is worse than one that cannot be moved. Detach is how a player asks
 * for them by hand. see decisions/array-placement.
 */
export function selectable(layer, generated = false) {
  return Boolean(layer) && layer.visible && !layer.locked && !generated;
}

function added(parent, id) {
  const group = new Konva.Group({ name: id });
  parent.add(group);
  return group;
}
