import type { WorkflowProgram } from "../compiler/compile.js";
import type { SiteTable } from "./sites.js";
import type { AnalysisCore } from "./core.js";
/**
 * The fused interpreter: ONE interpretation of
 * the script that produces the {@link AnalysisCore}. Engine schedule:
 *
 *  1. the taint listener runs alone to a fixpoint ({@link Evaluator.converge} — global
 *     env, placeholder summaries, semantics untouched);
 *  2. ONE final temporal walk ({@link traceOrder}) rides the evaluation-order spine,
 *     reading the converged state directly as its oracle ({@link TaintState.emitOracle})
 *     — the settle-certainty judgements need converged facts, so logging events on
 *     earlier iterations would be waste plus per-iteration state resets for nothing.
 *     The order-insensitivity lemma makes this schedule safe: a gen-only, kill-free,
 *     monotone fixpoint's result does not depend on visitation order, so the temporal
 *     walk's evaluation order is not a second semantics.
 *  3. minting ({@link mintCore}) digests everything position- or checker-shaped into
 *     plain data: `within` containment resolved onto sites, provisional `fan-out@order`
 *     ids renamed to final `fan-out#N` everywhere (occurrences and type keys included),
 *     artifact types materialized as strings.
 *
 * Downstream, graph.ts / causality-graph.ts are pure projections of the core — no
 * `typescript` import, no AST, no checker.
 */
export declare function interpret(workflow: WorkflowProgram, table: SiteTable): AnalysisCore;
//# sourceMappingURL=interpret.d.ts.map