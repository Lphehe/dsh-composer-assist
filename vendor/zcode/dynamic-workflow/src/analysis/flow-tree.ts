import type { OrderEvent, OrderRegion, OrderTrace } from "./causality-order.js";

/**
 * The trace's leaf stream re-read as the STRUCTURED CONTROL TREE that the control-flow
 * projection (flow-graph.ts) recurses over: regions are the inner nodes, events the
 * leaves, and every leaf sits in the innermost region of its own `regions` chain.
 *
 * Children are ordered by first leaf, which is the evaluation order the walk recorded. A
 * region holding no leaf sorts last among its siblings: it cannot affect the flow (an
 * empty region passes control straight through), only its EXISTENCE can (an empty `catch`
 * still catches).
 *
 * Its own file because flow-graph.ts sits at the 400-line cap and the tree is the one part
 * of it that owes nothing to the flow recursion. Like its siblings it must not import
 * `typescript`, and nothing here reaches the package barrels — flow-graph.ts is the only
 * consumer.
 */

export interface RegionNode {
  type: "region";
  region: OrderRegion;
  children: TreeNode[];
  /** Index of the first leaf in this subtree; Infinity when it holds none. */
  first: number;
}

export interface LeafNode {
  type: "leaf";
  event: OrderEvent;
  index: number;
}

export type TreeNode = RegionNode | LeafNode;

/** Rebuild the tree from the leaf stream, and index every region by id. */
export function buildTree(trace: OrderTrace): { root: RegionNode; byId: Map<string, RegionNode> } {
  const byId = new Map<string, RegionNode>();
  for (const region of trace.regions) {
    byId.set(region.id, { children: [], first: Number.POSITIVE_INFINITY, region, type: "region" });
  }
  for (const region of trace.regions) {
    if (region.parent === undefined) continue;
    byId.get(region.parent)?.children.push(byId.get(region.id) as RegionNode);
  }
  trace.events.forEach((event, index) => {
    const home = event.regions[event.regions.length - 1] ?? trace.root;
    byId.get(home)?.children.push({ event, index, type: "leaf" });
  });
  // Bottom-up: each child is ordered (and its `first` cached) BEFORE the parent sorts, so
  // the comparator reads a number instead of re-walking the subtree. A comparator that
  // called `order(child)` itself would re-sort and re-walk the whole subtree on every
  // comparison — exponential in nesting depth (a 2,500-region trace of inlined helpers
  // took 45 s before the projection had produced a single edge).
  const firstOf = (node: TreeNode): number => (node.type === "leaf" ? node.index : node.first);
  const order = (node: TreeNode): number => {
    if (node.type === "leaf") return node.index;
    for (const child of node.children) node.first = Math.min(node.first, order(child));
    node.children.sort((a, b) => firstOf(a) - firstOf(b));
    return node.first;
  };
  const root = byId.get(trace.root) as RegionNode;
  order(root);
  return { byId, root };
}
