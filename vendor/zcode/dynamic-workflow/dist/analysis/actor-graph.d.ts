import type { SiteGraph, SiteLoc } from "./types.js";
/**
 * The actor graph: a derived, presentation-level view of a {@link SiteGraph} with
 * **actors as nodes and messages as edges**. It is a PURE projection of an
 * already-built site graph (no program/table access); the site graph stays canonical
 * (journal, ordinals, and runtime marks all key off sites) and this view is recovered
 * on demand, the same category as SCC loop-box recovery. An agent-relevance filter
 * keeps the view about collaboration: an edge must touch at least one actor, so
 * endpoint-to-endpoint plumbing is dropped and endpoints left dangling are pruned.
 * Aggregated actor edges also carry the deduped producer artifact types of their
 * contributing site edges as `types` — the message types flowing between the lanes.
 */
/** A node: an actor lane, or one of the virtual endpoints `source` / `sink` / `workspace`. */
export interface ActorNode {
    /**
     * An actor-site id (`actor#1`); `"source"` / `"sink"` — the orchestrator's enter
     * and exit roles, kept unmerged so the graph reads as a pipeline; or `"workspace"`.
     */
    id: string;
    name?: string;
    loc?: SiteLoc;
    /** Enclosing promoted fan-out id when the actor site is a lane family (×N). */
    family?: string;
}
/** A message edge: aggregated site data-flow between two actor lanes. */
export interface ActorEdge {
    from: string;
    to: string;
    /** OR over the contributing site edges' exactness (a may-projection forces false). */
    exact: boolean;
    /** How many site data-edges collapsed into this actor edge. */
    count: number;
    /**
     * The producer artifact types carried by the contributing site edges — the message
     * types on this actor edge (provenance: values of these types flow `from` -> `to`).
     * Deduped, in contribution order (site-edge iteration order). Present iff non-empty;
     * contributing edges with no type (e.g. `source` edges) add nothing.
     */
    types?: string[];
}
export interface ActorGraph {
    nodes: ActorNode[];
    edges: ActorEdge[];
}
/** Project a site graph to its derived actor graph (pure). */
export declare function toActorGraph(graph: SiteGraph): ActorGraph;
//# sourceMappingURL=actor-graph.d.ts.map