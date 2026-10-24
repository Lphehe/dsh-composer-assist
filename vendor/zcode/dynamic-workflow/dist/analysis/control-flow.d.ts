import ts from "typescript";
import type { EvalContext, Evaluator } from "./taint.js";
/**
 * Loop / iteration statement handlers: `for`, `for-of`, and `for-in`. Split out of the core
 * evaluator (taint.ts) like the call/relay rules in calls.ts and the assignment rules in
 * assign.ts — same `Evaluator` instance, free-function shape. The `visit` dispatcher in
 * taint.ts routes the three loop statement kinds here. Plain `while`/`do` carry no binding, so
 * they stay inline in `visit`. Gen-only weak updates over-approximate every iteration order at once,
 * so a loop body is evaluated exactly like straight-line code.
 */
/** `for (init; cond; incr) body`: evaluate every clause for effect, then the body. */
export declare function visitForStatement(ev: Evaluator, node: ts.ForStatement, ctx: EvalContext): void;
/**
 * `for (x of xs) body`: the element value is the collapsed iterable (+ a fan-out label when the
 * loop is a promoted iteration candidate), bound through the same machinery as any other loop
 * variable. Derived, not a place, so binding keeps value semantics.
 */
export declare function handleForOf(ev: Evaluator, node: ts.ForOfStatement, ctx: EvalContext): void;
/**
 * `for (k in obj) body`: for-in enumerates the object's KEYS; each key string is derived from
 * that object ("strings launder nothing"), so the loop variable carries its collapsed taint.
 * For-in used to share the while/do arm (which binds nothing), so key-derived flow
 * (`keys += k`) was dropped for both the declaration and assignment initializer forms.
 */
export declare function handleForIn(ev: Evaluator, node: ts.ForInStatement, ctx: EvalContext): void;
//# sourceMappingURL=control-flow.d.ts.map