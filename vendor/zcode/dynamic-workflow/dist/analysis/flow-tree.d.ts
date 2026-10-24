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
export declare function buildTree(trace: OrderTrace): {
    root: RegionNode;
    byId: Map<string, RegionNode>;
};
//# sourceMappingURL=flow-tree.d.ts.map