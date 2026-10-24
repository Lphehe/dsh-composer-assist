import ts from "typescript";
import { type AbstractValue } from "./domain.js";
import type { EvalContext, Evaluator } from "./taint.js";
import type { ApplicationVia } from "./state.js";
/**
 * Call and relay transfer rules: the facade sinks (`ask`, `files.*`), the relay
 * nodes (`Promise.all` joins and promoted iteration fan-outs), heap mutators, and
 * script-local / higher-order function calls with context-sensitive summaries. These
 * live apart from the core evaluator (taint.ts) but operate on the same `Evaluator`
 * instance.
 */
export declare function evalCall(ev: Evaluator, node: ts.CallExpression, ctx: EvalContext): AbstractValue;
/**
 * Apply a callee to already-evaluated argument values. Shared by ordinary call
 * expressions and tagged templates (``tag`…${e}…` `` is the call `tag(strings, e, …)`).
 * Script-local callees route through their context-sensitive summary; unknown/library
 * callees widen (see {@link handleUnknownCall}). `argPlaces[i]`, when present, is the
 * live value of a place actual, used for parameter write-back. `tail`, when present, is an
 * inexact spread smear bound to every parameter at index >= `argVals.length`. `site` is the
 * call / tagged-template node the application is recorded against (the call oracle).
 */
export declare function applyCall(ev: Evaluator, calleeExpr: ts.Expression, argVals: AbstractValue[], ctx: EvalContext, argPlaces?: (AbstractValue | undefined)[], tail?: AbstractValue, site?: ts.Node): AbstractValue;
/**
 * Keystone application of every script-local function reachable in `source`: each of its
 * parameters receives `pot` (already exactness-cleared), and its substituted return summary
 * joins `out`. Shared by {@link handleUnknownCall} and {@link handleNewUnknown} (`new`).
 */
export declare function applyPessimistically(ev: Evaluator, source: AbstractValue, pot: AbstractValue, ctx: EvalContext, out: AbstractValue, site?: ts.Node): void;
/**
 * Apply script-local functions handed to a per-element library call (`xs.map(review)`) with
 * positional actuals already shaped by the registry (element / whole / accumulator slots).
 * Records each as an `argument` application at `site` inside the candidate's region stack and
 * returns the union of the substituted return summaries (inexact: the dispatch is indirect).
 */
export declare function applyCallbackFns(ev: Evaluator, fns: readonly ts.Node[], actuals: AbstractValue[], regionStack: string[], site: ts.Node): AbstractValue;
export declare function recordCall(ev: Evaluator, id: number, regionStack: string[], argVals: AbstractValue[], argPlaces?: (AbstractValue | undefined)[], application?: {
    site: ts.Node;
    via: ApplicationVia;
}): void;
//# sourceMappingURL=calls.d.ts.map