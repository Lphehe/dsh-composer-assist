import ts from "typescript";
import { type AbstractValue } from "./domain.js";
import { type EvalContext, type Evaluator } from "./taint.js";
/**
 * Assignment transfer rules: plain `=`, compound / logical assignments (`+=`, `||=`,
 * `??=`, …), and destructuring assignment EXPRESSIONS (`[a, b] = xs`, `({ x } = o)`).
 * These live apart from the core evaluator (taint.ts) but operate on the same
 * `Evaluator` instance.
 */
/** `target = value`: bind the target (destructuring pattern or lvalue), yield value. */
export declare function handleAssignment(ev: Evaluator, node: ts.BinaryExpression, ctx: EvalContext): AbstractValue;
/**
 * `x += rhs` (and every compound / logical assignment): weak-merge the RHS into the
 * target through the same paths as plain assignment (gen-only has no kills, so the
 * old value stays), and yield the union of the target's prior value and the RHS.
 * evalBinary special-cased only `=`, so `+=`/`||=`/`??=`/… computed the value
 * but never wrote it back — the target kept its pre-op taint.
 */
export declare function handleCompoundAssignment(ev: Evaluator, node: ts.BinaryExpression, ctx: EvalContext): AbstractValue;
/**
 * Bind a for-in / for-of loop variable to `value` through the EXISTING binding machinery
 * (no parallel path): the declaration form (`for (const k … )`) routes through bindPattern,
 * the assignment form (`for (k … )` or a destructuring assignment target) through
 * bindAssignmentTarget. The loop value is derived (not a place), so value semantics — no
 * aliasing sourcePlace. Previously for-of bound only the declaration form and
 * for-in bound nothing at all, dropping element / key taint into every read
 * of the loop variable.
 */
export declare function bindForInitializer(ev: Evaluator, initializer: ts.ForInitializer, value: AbstractValue, ctx: EvalContext): void;
/**
 * Weak-merge `collapse(value)` into the leftmost identifier of a member-access chain.
 * A nested assignment target (`a.b.c = x`, `a[i].f = x`) has a member-access
 * receiver rather than a plain identifier, so the field-sensitive branches above find
 * no `receiverSymbol` and used to drop x's taint silently. Folding into the root symbol
 * is a field-insensitive over-approximation, which a may-flow analysis must prefer over
 * under-approximating (dropping) the flow. Shared with the heap-mutator transfer
 * (heap-ops.ts), whose unresolvable receivers fall back the same way. A chain rooted in
 * a non-identifier (a call result: `log().push(x)`) still has no slot to fold into — the
 * known residual of the place model (function returns are summaries, not heap objects).
 */
export declare function mergeIntoRootIdentifier(ev: Evaluator, expr: ts.Expression, value: AbstractValue): void;
//# sourceMappingURL=assign.d.ts.map