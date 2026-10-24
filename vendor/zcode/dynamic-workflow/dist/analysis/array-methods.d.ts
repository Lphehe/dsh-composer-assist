import ts from "typescript";
import type { IterationCandidate } from "./sites.js";
import { type AbstractValue } from "./domain.js";
import type { EvalContext, Evaluator } from "./taint.js";
/**
 * Per-element callback calls (the callback registry's `each` entries — `map` / `forEach` /
 * `reduce` / … on a receiver, `Array.from(xs, fn)`) promoted to fan-out relays: `iterated`
 * fans out to the callback's element parameter(s), the callback body runs in a
 * `cand@<order>` region, and its return joins back. `evalCall` dispatches here via
 * `candByCall`.
 *
 * Two callback shapes, one contract:
 *  - an INLINE literal is evaluated in place with its parameters bound directly (it is not a
 *    tracked function — the callback IS the body);
 *  - any other expression (`xs.map(review)`, `xs.map(this.f)`) is evaluated to its function
 *    values and those tracked functions are applied with registry-shaped positional actuals,
 *    recorded as `argument` applications at the call so the ordering walk inlines the same
 *    bodies inside the same `fanout` region.
 */
export declare function handleArrayMethod(ev: Evaluator, node: ts.CallExpression, cand: IterationCandidate, ctx: EvalContext): AbstractValue;
//# sourceMappingURL=array-methods.d.ts.map