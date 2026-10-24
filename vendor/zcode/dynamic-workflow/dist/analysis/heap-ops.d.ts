import ts from "typescript";
import { type AbstractValue } from "./domain.js";
import type { EvalContext, Evaluator } from "./taint.js";
/**
 * In-place heap-mutation transfers: `Object.assign` and the receiver-mutating array /
 * collection methods (`push`, `Map.set`, …). Extracted from calls.ts (pure move, no
 * behavior change) to keep that file under the line cap.
 */
/** `Object.assign` — a free function (not a method) that mutates its target in place. */
export declare function isObjectAssign(access: ts.PropertyAccessExpression): boolean;
export declare function handleHeapMutator(ev: Evaluator, node: ts.CallExpression, access: ts.PropertyAccessExpression, ctx: EvalContext): AbstractValue;
/** `Object.assign(target, ...sources)`: merge each source into the target's live value. */
export declare function handleObjectAssign(ev: Evaluator, node: ts.CallExpression, ctx: EvalContext): AbstractValue;
//# sourceMappingURL=heap-ops.d.ts.map