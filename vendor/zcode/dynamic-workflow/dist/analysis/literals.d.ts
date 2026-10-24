import ts from "typescript";
import { type AbstractValue } from "./domain.js";
import type { EvalContext, Evaluator } from "./taint.js";
/**
 * Array- and object-literal evaluation, split out of the core evaluator (taint.ts) like
 * the call/relay rules in calls.ts — same `Evaluator` instance, free-function shape. A
 * container literal is field-sensitive: a place element/property stores the LIVE value it
 * denotes (aliasing), and spread copies its source's fields by reference (shallow copy).
 *
 * Both functions build a FRESH value for this pass; the evaluator hands it to
 * `state.literalPlaceOf`, which adopts it on first sight and merges it into the persistent
 * allocation-site place afterwards. So the value that flows on from a literal is storage
 * that survives the pass (a callee may write through it), and the `changed` signal for a
 * re-evaluation that grew is raised there — neither function touches `ev.s.changed`.
 */
export declare function evalArrayLiteral(ev: Evaluator, node: ts.ArrayLiteralExpression, ctx: EvalContext): AbstractValue;
export declare function evalObjectLiteral(ev: Evaluator, node: ts.ObjectLiteralExpression, ctx: EvalContext): AbstractValue;
//# sourceMappingURL=literals.d.ts.map