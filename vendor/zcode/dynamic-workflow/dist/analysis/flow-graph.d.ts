import type { ScriptLoc } from "../compiler/compile.js";
import type { AnalysisCore } from "./core.js";
/**
 * The control-flow projection: "where can
 * execution go next", as opposed to the causality graph's "what must precede what".
 *
 * Input is the core's trace read as a STRUCTURED CONTROL TREE (flow-tree.ts): regions are
 * the inner nodes, events the leaves in pre-order, and each leaf's `regions` chain names
 * its ancestors. The walk already resolved everything that needed the AST — arm grouping (`choice`), helper
 * boundaries (`call`), try parts, and every `jump`'s target region — so this module is a
 * pure function of the core and must not import `typescript`.
 *
 * Nodes are OCCURRENCES (each `issue` leaf, each `mark` leaf), not sites: a helper called
 * twice contributes two nodes for one step id. The phase quotient (`phaseEdges`) folds
 * them back by phase. Neither level is transitively reduced — a CFG never is.
 *
 * The graph is CONCURRENT: a `strand` region (an asynchronous activation the walk inlined)
 * is entered by a `fork` and left by a `join` at the barrier that awaits its promise, not
 * at its spawn point. Its exits wait in the strand park (flow-strands.ts) in between, and a
 * `mark` reached while strands are parked records their phases as `alongside` — a node
 * fact, because "an earlier phase is still running here" is not a transfer of control and
 * cannot be read off the edges once they fold.
 */
export type FlowNodeKind = "issue" | "mark";
export interface FlowNode {
    /** `${step}@${k}` — the k-th issue of that step; `${phase}@${k}` for a mark. */
    id: string;
    kind: FlowNodeKind;
    /** issue: the step's site id. */
    site?: string;
    /** The phase current at this leaf (a mark's is the phase it switched TO). */
    phase: string;
    /**
     * mark only: the phases whose strands are still running when this marker is entered —
     * every strand parked here, minus this node's own phase and minus any strand the marker
     * sits inside. In the trace's phase-table order, absent when empty. Flow-insensitive
     * across choice arms, like the walk's `issued` set: over-claiming "may run alongside" is
     * the licensed direction.
     */
    alongside?: string[];
    /** Inside a never-called body the sweep placed: runs at an unknown point, if at all. */
    detached?: true;
}
export type FlowEdgeKind = "next" | "branch" | "loop" | "exit" | "fork" | "join" | "jump" | "throw" | "may-throw";
export type FlowVia = "continue" | "break" | "return" | "recur";
export interface FlowEdge {
    from: string;
    to: string;
    kind: FlowEdgeKind;
    /** The jump statement kind behind a `loop` / `exit` / `jump` / `join` edge, when any. */
    via?: FlowVia;
}
export interface FlowPhase {
    id: string;
    /** Absent for {@link UNPHASED_ID}. */
    name?: string;
    /** The first marker that minted the phase; absent for {@link UNPHASED_ID}. */
    loc?: ScriptLoc;
    /**
     * Phases whose strands were still running when this one was entered: the union of
     * {@link FlowNode.alongside} over the phase's mark nodes, in phase-table order, absent
     * when empty. All-or-nothing with the rest of the phase vocabulary.
     */
    alongside?: string[];
    /** The filled hole whose body wrote this phase (a hole's own phase names the hole enclosing it). */
    fill?: string;
}
/**
 * An OPEN hole as the display lists it (docs/dynamic-workflow/presentation.md, `holes`): the
 * station the rail draws dashed ahead of the run. `phase` is where the hole STANDS — the
 * phase of its issue node, the hole's own memberless phase being `siteId` itself.
 */
export interface FlowHole {
    siteId: string;
    name: string;
    /** The author's spelling of the type argument. */
    type: string;
    phase?: string;
    /** The tail form `return await hole<T>(...)`: the script's end is open. */
    tail?: true;
}
/** Terminal node ids. `sink` is the causality graph's sink: the script completed normally. */
export declare const FLOW_ENTRY = "entry";
export declare const FLOW_SINK = "sink";
export declare const FLOW_ABORT = "abort";
export interface ControlFlowGraph {
    /** Leaf-stream order; detached nodes last (the sweep runs after the main walk). */
    nodes: FlowNode[];
    /** Canonical order: by from-node, to-node, kind, via; `entry` first, terminals last. */
    edges: FlowEdge[];
    /**
     * The phase quotient, present iff the script declares a phase (all-or-nothing, exactly
     * like the causality graph's `phaseEdges`). Same-phase edges dissolve except `loop`
     * back edges, which stay as self-loops.
     */
    phaseEdges?: FlowEdge[];
    /** Phases that appear on some node, in first-reach order, {@link UNPHASED_ID} first. */
    phases?: FlowPhase[];
    /** The open holes in source order; present iff the script has one (see {@link FlowHole}). */
    holes?: FlowHole[];
}
/**
 * A dangling exit: the edge it will make once it learns where control goes next. Exported
 * for flow-strands.ts only — a strand's exits leave this module to wait for their join —
 * and deliberately not re-exported from the package barrels.
 */
export interface Src {
    from: string;
    kind: FlowEdgeKind;
    via?: FlowVia;
}
export declare function projectControlFlow(core: AnalysisCore): ControlFlowGraph;
//# sourceMappingURL=flow-graph.d.ts.map