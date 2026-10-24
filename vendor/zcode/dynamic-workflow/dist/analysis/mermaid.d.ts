import type { ActorGraph } from "./actor-graph.js";
import { type CausalityGraph } from "./causality-graph.js";
import { type ControlFlowGraph } from "./flow-graph.js";
import type { HandoffGraph } from "./handoff-graph.js";
import type { SiteGraph } from "./types.js";
/** Emit a {@link SiteGraph} as a mermaid `flowchart TD`. Deterministic node/edge order. */
export declare function siteGraphToMermaid(graph: SiteGraph): string;
/** Emit an {@link ActorGraph} as a mermaid `flowchart LR`. Deterministic node/edge order. */
export declare function actorGraphToMermaid(graph: ActorGraph): string;
/**
 * Emit a {@link CausalityGraph} as a mermaid `flowchart LR`: steps grouped into lane
 * subgraphs, the returned artifact as a terminal node, and ONE arrow form — no dashes,
 * no labels, no variants, exactly as the GUI renders it. `sequenceDiagram` was
 * considered and rejected for the same reason as loop frames: its `loop`/`par`/`alt`
 * blocks reintroduce the framing this design removes.
 */
export declare function causalityGraphToMermaid(graph: CausalityGraph): string;
/**
 * Emit the phase quotient as a mermaid `flowchart LR`: one node per phase, the same ONE
 * arrow form as the step graph (self-loops and back edges included — a cycle among the
 * arrows IS the loop), and the sink terminal derived from the phases of the steps that
 * feed the return. Absent vocabulary means no diagram: a script with no `phase()` markers
 * has nothing to draw here and the caller renders the step graph instead.
 */
export declare function phaseGraphToMermaid(graph: CausalityGraph): string;
/**
 * Emit the phase-level CONTROL-FLOW quotient as a mermaid `flowchart LR`: the same phase
 * nodes as {@link phaseGraphToMermaid} so the two diagrams can be read side by side
 * ("what must precede what" vs "where execution can go next"), plus the `entry` / `sink` /
 * `abort` terminals. Arrows between one phase pair merge into one, labeled with the
 * distinct edge kinds behind it (`via` in parentheses); a pair joined only by `next`
 * renders unlabeled. Two phases that ran at the same time get one dashed `alongside` link
 * on top, drawn from the earlier to the later — a node fact about the pair, not a path.
 * Absent vocabulary means no diagram.
 */
export declare function phaseFlowToMermaid(flow: ControlFlowGraph): string;
/**
 * Emit the OCCURRENCE-level control-flow graph as a mermaid `flowchart TD` — the full CFG
 * behind {@link phaseFlowToMermaid}'s quotient. Issue nodes are rectangles labelled by
 * their occurrence id; marks are hexagons labelled by the phase name they switch to; the
 * `entry` / `sink` / `abort` terminals share
 * the endpoint palette of every other chart. When the script declares phases, nodes sit in
 * one subgraph per phase (in `flow.phases` order) so a mark inside a loop reads as a jump
 * between boxes. Edges keep the graph's canonical order and are drawn one arrow per edge —
 * two edges between the same pair (`exit via=break` beside `next`) stay two arrows, because
 * at this level they ARE two ways to get there. `next` renders unlabeled, every other kind
 * carries {@link flowEdgeLabel}. Detached nodes (a never-called body) are dashed.
 */
export declare function controlFlowToMermaid(flow: ControlFlowGraph): string;
/**
 * Emit a {@link HandoffGraph} as a mermaid `flowchart LR`: one subgraph per phase (in the
 * analyzer's participant order, which IS the stack order), one card per participant, and
 * one arrow per hand-off — solid for a forward hand-off, dashed for a `back` one (all its
 * contributing edges were loop carries), labelled with the artifact `types` when known.
 * The graph itself carries only ids; pass the causality graph's `lanes` / `phases` to
 * label cards and boxes with the author's names, exactly as `serializeHandoffGraph` echoes
 * lane names for readability.
 */
export declare function handoffGraphToMermaid(graph: HandoffGraph, names?: Pick<CausalityGraph, "lanes" | "phases">): string;
//# sourceMappingURL=mermaid.d.ts.map