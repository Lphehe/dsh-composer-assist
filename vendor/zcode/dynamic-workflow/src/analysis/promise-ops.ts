import ts from "typescript";
import {
  clearExact,
  cloneValue,
  collapse,
  collapseInto,
  emptyValue,
  mergeInto,
  type AbstractValue,
} from "./domain.js";
import type { EvalContext, Evaluator } from "./taint.js";
import { applyPessimistically, recordCall } from "./calls.js";

/**
 * Promise and constructor transfer rules, split out of calls.ts (max-lines): the unknown-`new`
 * keystone with the promise-executor rule, `await` of a thenable, `Promise.reject`, and the
 * script-class constructor application. Same `Evaluator` instance, same contract; they call back into calls.ts's shared primitives.
 */

/** The taint fed to invocations of function `fn`'s parameters (the promise resolve/reject/
 * continuation pattern). Empty for a non-tracked fn or one whose params are never invoked. */
function appliedCallbackTaint(ev: Evaluator, fn: ts.Node): AbstractValue {
  const out = emptyValue();
  const id = ev.s.fnId.get(fn);
  if (id === undefined) return out;
  const paramCount = (ev.s.fnParamSymbols.get(id) ?? []).length;
  for (let param = 0; param < paramCount; param += 1) {
    const captured = ev.s.phCallActualsOf(id, param);
    if (captured !== undefined) mergeInto(out, captured);
  }
  return out;
}

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
export function handleNewUnknown(ev: Evaluator, node: ts.NewExpression, ctx: EvalContext): AbstractValue {
  const out = emptyValue();
  const argVals = (node.arguments ?? []).map((arg) => ev.evalExpr(arg, ctx));
  for (const argVal of argVals) collapseInto(out, argVal);
  // The pot the constructor may feed to a callback arg's params is the sibling DATA, not the
  // callables themselves (a function arg is the callback being invoked, not data passed to a
  // sibling), so strip `fns`: otherwise binding a param to the executor's own fn would make
  // `resolve(draft)` dispatch as the executor and bypass the placeholder-invocation capture.
  const pot = clearExact(out);
  pot.fns.clear();
  for (const argVal of argVals) {
    applyPessimistically(ev, argVal, pot, ctx, out, node);
    for (const fn of argVal.fns) mergeInto(out, appliedCallbackTaint(ev, fn));
  }
  return out;
}

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
export function evalAwait(ev: Evaluator, node: ts.AwaitExpression, ctx: EvalContext): AbstractValue {
  const at = node.getStart(ev.s.scriptFile);
  const inner = ev.evalExpr(node.expression, ctx);
  const thenField = inner.fields.get("then");
  if (thenField === undefined || thenField.fns.size === 0) {
    ev.s.mergeSink(ev.s.awaitVal, at, inner);
    return inner;
  }
  const out = cloneValue(inner);
  for (const fn of thenField.fns) {
    const id = ev.s.fnId.get(fn);
    if (id !== undefined) ev.s.markCalled(ctx.regionStack, id);
    mergeInto(out, appliedCallbackTaint(ev, fn));
  }
  ev.s.mergeSink(ev.s.awaitVal, at, out);
  return out;
}

/** `Promise.reject(x)` — a rejected promise. Await unwraps it as a THROW, so feed collapse(x)
 * into the global thrown set (read by every catch binding). Returns collapse(x) as before
 * (the unknown-call result), so nothing on the resolved path regresses. */
export function handlePromiseReject(ev: Evaluator, node: ts.CallExpression, ctx: EvalContext): AbstractValue {
  const arg = node.arguments[0];
  const val = arg === undefined ? emptyValue() : collapse(ev.evalExpr(arg, ctx));
  ev.s.mergeThrown(val);
  return val;
}

/** `Promise.reject` on the global Promise (textual match, mirroring {@link isJsonStringify}). */
export function isPromiseReject(access: ts.PropertyAccessExpression): boolean {
  return ts.isIdentifier(access.expression) && access.expression.text === "Promise" && access.name.text === "reject";
}

/**
 * Apply a script-local constructor `id` for a `new C(args)` (or a `super(args)` in a
 * derived ctor): record the actuals as the constructor's parameter placeholders and
 * write parameter mutations back into place actuals, exactly like an ordinary direct
 * call. The constructor's OWN body (which writes `this.x = param`) is evaluated in the
 * function pass, so the shared instance picks up the placeholder there; here we only
 * seed the actuals. The instance itself is returned by the caller (NewExpression), never
 * this call's result. A direct `new`/`super` keeps exactness (no clearing).
 */
export function applyConstructor(
  ev: Evaluator,
  id: number,
  ctx: EvalContext,
  argVals: AbstractValue[],
  argPlaces?: (AbstractValue | undefined)[],
  site?: ts.Node,
): void {
  recordCall(ev, id, ctx.regionStack, argVals, argPlaces, site === undefined ? undefined : { site, via: "callee" });
}

/**
 * Apply an UNRESOLVABLE-heritage constructor (`new D()` where `class D extends mix(Base)`):
 * the base class is produced by a mixin CALL we cannot resolve statically, so the inherited
 * constructor is unreachable. Sound over-approximation: the ctor may store any argument in any
 * field, so smear the collapsed (INEXACT) args into the instance's container-level taint —
 * surfaced by every field read via smear-on-read — and pessimistically apply function-valued
 * args (the keystone: the base ctor may invoke them). Never a drop.
 */
export function applyMixinConstructor(
  ev: Evaluator,
  ctx: EvalContext,
  instance: AbstractValue,
  argVals: AbstractValue[],
): void {
  const pot = emptyValue();
  for (const arg of argVals) collapseInto(pot, arg);
  const inexact = clearExact(pot);
  if (mergeInto(instance, inexact)) ev.s.changed = true;
  for (const arg of argVals) applyPessimistically(ev, arg, inexact, ctx, instance);
}
