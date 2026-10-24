import type { AnalysisCore } from "./core.js";
import { type RegionKind } from "./constants.js";
import { type OrderKind } from "./causality-reduce.js";
import type { SiteGraph } from "./types.js";
import type { CausalityGraph } from "./causality-graph-types.js";
/** Re-exported so the causality vocabulary is importable from one module. */
export type { NamePattern } from "./types.js";
export { MAIN_LANE, SINK_ID, UNKNOWN_LANE, WORKSPACE_LANE } from "./causality-graph-types.js";
export type { CausalityGraph, Certainty, Lane, OrderEdge } from "./causality-graph-types.js";
export type { Phase, Region, Step, StepKind } from "./causality-graph-types.js";
/**
 * The causality graph: a partial order over workflow STEPS, with actors as lanes and
 * `happens-before` as its edges. This is the presentation-level view the GUI draws.
 * The graph uses these rules:
 *
 *   - a **step** is one facade operation that takes time (an `ask`, a `files.*` read);
 *   - an **actor** is an attribute of a step (a lane), never a node — any quotient by
 *     actor destroys the order this graph exists to show;
 *   - an **edge** means "runs after", and records WHY internally (`data` / `control` /
 *     `fifo` / `seq` / `carry`) while rendering as one indistinguishable arrow;
 *   - **regions** (`loop` / `fanout` / `branch`) are internal: they drive reduction and
 *     the multiplicity cues, and none of them draws a container.
 *
 * The taint analysis and the temporal walk both ran inside the fused interpreter
 * (interpret.ts); this module is a PURE projection of the {@link AnalysisCore} they
 * produced, plus the projected site graph: the core's sites give the steps, the site
 * graph's `data` edges answer "does B's argument carry A's output?", and the core's
 * `trace` supplies everything temporal. No `typescript` import, no AST.
 *
 * Phase 1 scope: one step per ask/world-read site —
 * per-call-site specialization (`ask#3/2`) lands with the execution engine in phase 3, so
 * `Step.callPath` is not emitted yet. Await resolution is syntactic, with full-barrier widening as the fallback. The one exception to one-step-per-site is
 * {@link expandMaySetLanes}, the final pass: a dynamically-selected receiver becomes one
 * copy per candidate lane, and `Step.source` names the site they came from.
 */
export type { OrderKind, RegionKind };
/** Project the causality graph off the core plus the (projected) site graph. */
export declare function projectCausalityGraph(core: AnalysisCore, site: SiteGraph): CausalityGraph;
//# sourceMappingURL=causality-graph.d.ts.map