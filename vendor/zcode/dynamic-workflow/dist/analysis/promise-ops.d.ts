import ts from "typescript";
import { type AbstractValue } from "./domain.js";
import type { EvalContext, Evaluator } from "./taint.js";
/**
 * `new UnknownThing(args)` (a non-class callee: `new Promise(exec)`, `new Set([x])`): the
 * union of the argument collapses (exact preserved, "strings launder nothing"), PLUS the
 * unknown-call keystone — function-valued args are pessimistically applied (their return
 * summary joins the result) — PLUS the promise-executor rule: whatever a function arg feeds
 * to invocations of its OWN parameters joins the result (`new Promise((resolve) =>
 * resolve(draft))` resolves to `draft`; a `reject(x)` arg lands in the pot too, an
 * over-approximation of the rejection path). Generic: `new X(fn)` may invoke fn and capture
 * what fn's params receive — never special-cased by name.
 */
export declare function handleNewUnknown(ev: Evaluator, node: ts.NewExpression, ctx: EvalContext): AbstractValue;
/**
 * `await e`: model awaiting a thenable = invoking its `then`. When the awaited value carries
 * a tracked `then` method, the promise resolves to whatever that method feeds its continuation
 * callback (`appliedCallbackTaint`): a custom thenable whose `then(onOk)` calls
 * `draft.then(onOk)` resolves to `draft`. When no `then` fn is visible (a plain settled value,
 * or a thenable collapsed past field-sensitivity), the operand's own taint already flows
 * through unchanged — the await is a passthrough, as before.
 *
 * Both exits also RECORD the returned value as the settle oracle for this await. Recording only; the value returned to
 * the evaluator is untouched, so no transfer rule changes.
 */
export declare function evalAwait(ev: Evaluator, node: ts.AwaitExpression, ctx: EvalContext): AbstractValue;
/** `Promise.reject(x)` — a rejected promise. Await unwraps it as a THROW, so feed collapse(x)
 * into the global thrown set (read by every catch binding). Returns collapse(x) as before
 * (the unknown-call result), so nothing on the resolved path regresses. */
export declare function handlePromiseReject(ev: Evaluator, node: ts.CallExpression, ctx: EvalContext): AbstractValue;
/** `Promise.reject` on the global Promise (textual match, mirroring {@link isJsonStringify}). */
export declare function isPromiseReject(access: ts.PropertyAccessExpression): boolean;
/**
 * Apply a script-local constructor `id` for a `new C(args)` (or a `super(args)` in a
 * derived ctor): record the actuals as the constructor's parameter placeholders and
 * write parameter mutations back into place actuals, exactly like an ordinary direct
 * call. The constructor's OWN body (which writes `this.x = param`) is evaluated in the
 * function pass, so the shared instance picks up the placeholder there; here we only
 * seed the actuals. The instance itself is returned by the caller (NewExpression), never
 * this call's result. A direct `new`/`super` keeps exactness (no clearing).
 */
export declare function applyConstructor(ev: Evaluator, id: number, ctx: EvalContext, argVals: AbstractValue[], argPlaces?: (AbstractValue | undefined)[], site?: ts.Node): void;
/**
 * Apply an UNRESOLVABLE-heritage constructor (`new D()` where `class D extends mix(Base)`):
 * the base class is produced by a mixin CALL we cannot resolve statically, so the inherited
 * constructor is unreachable. Sound over-approximation: the ctor may store any argument in any
 * field, so smear the collapsed (INEXACT) args into the instance's container-level taint —
 * surfaced by every field read via smear-on-read — and pessimistically apply function-valued
 * args (the keystone: the base ctor may invoke them). Never a drop.
 */
export declare function applyMixinConstructor(ev: Evaluator, ctx: EvalContext, instance: AbstractValue, argVals: AbstractValue[]): void;
//# sourceMappingURL=promise-ops.d.ts.map