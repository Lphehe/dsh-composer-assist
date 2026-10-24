import type { OrderTrace } from "./causality-order.js";
import type { AnalysisCore } from "./core.js";
import { type FlowEdge, type FlowHole, type FlowNode, type FlowPhase } from "./flow-graph.js";
/**
 * The phase quotient of the control-flow graph — the control-flow counterpart of
 * phase-graph.ts (which quotients the CAUSALITY graph). Same vocabulary, same all-or-nothing
 * contract, different question: this one says where execution can go between phases.
 *
 * `alongside` is folded here too, but it is not an edge and so not part of the quotient:
 * it is the union of the mark nodes' own `alongside` lists, because a phase entered twice
 * with different strands running is entered alongside both.
 */
/** Phases some node carries, in first-reach order, {@link UNPHASED_ID} first when present. */
export declare function collectFlowPhases(trace: OrderTrace, nodes: readonly FlowNode[]): FlowPhase[];
/**
 * The open holes for the display (docs/dynamic-workflow/presentation.md, `holes`), in source
 * order. `phase` is the phase of the hole's FIRST issue node — where it stands; a hole the
 * walk never reached (none in practice: the sweep issues every step) carries none.
 */
export declare function collectFlowHoles(core: AnalysisCore, nodes: readonly FlowNode[]): FlowHole[];
/**
 * Each occurrence edge projected onto the phases of its endpoints. Same-phase edges dissolve
 * unless they are `loop` back edges (a loop living inside one phase is a self-loop);
 * terminals project to themselves. Kinds are kept apart — the renderer merges arrows, the
 * model does not. No transitive reduction: a CFG never is.
 */
export declare function quotientFlow(nodes: readonly FlowNode[], edges: readonly FlowEdge[], phases: readonly FlowPhase[]): FlowEdge[];
//# sourceMappingURL=flow-phase.d.ts.map