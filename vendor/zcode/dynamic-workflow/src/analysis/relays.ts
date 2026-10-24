import ts from "typescript";
import { addOcc, collapse, liveField, mergeInto, singleOcc, type AbstractValue } from "./domain.js";
import type { EvalContext, Evaluator } from "./taint.js";

/**
 * Facade sink and relay transfers: `Agent.ask`, `files.glob`/`read` (world reads), and
 * `Promise.all` join relays. Split out of calls.ts (pure move, no behavior change) to keep
 * that file under the line cap; `evalCall` dispatches here via the site lookups.
 */

export function handleAsk(ev: Evaluator, node: ts.CallExpression, askId: string, ctx: EvalContext): AbstractValue {
  ev.s.markFacade(ctx.regionStack);
  const site = ev.s.askSites.get(askId);
  if (site !== undefined) {
    ev.s.mergeSink(ev.s.askRecv, askId, collapse(ev.evalExpr(site.receiver, ctx)));
    if (site.instructions !== undefined) {
      ev.s.mergeSink(ev.s.askInstr, askId, collapse(ev.evalExpr(site.instructions, ctx)));
    }
  }
  // Evaluate any extra arguments for their side effects (heap writes etc.).
  node.arguments.forEach((arg, index) => {
    if (index !== 0) ev.evalExpr(arg, ctx);
  });
  return singleOcc(askId, true);
}

export function handleWorldRead(
  ev: Evaluator,
  id: string,
  args: readonly ts.Expression[],
  ctx: EvalContext,
): AbstractValue {
  ev.s.markFacade(ctx.regionStack);
  // Every positional argument is a sink: ops differ in arity (`files.grep(pattern, glob?)`,
  // `git.diff(base?, path?)`), and an artifact reaching any of them is a data dependency.
  for (const arg of args) ev.s.mergeSink(ev.s.worldRead, id, collapse(ev.evalExpr(arg, ctx)));
  return singleOcc(id, true);
}

export function handleJoin(
  ev: Evaluator,
  node: ts.CallExpression,
  id: string,
  arg: ts.Expression | undefined,
  ctx: EvalContext,
): AbstractValue {
  ev.s.markFacade(ctx.regionStack);
  // The join result is the PERSISTENT node of this call site (state.ts joinResultOf), NOT a
  // fresh value per pass: it is a place other values may-alias, and the canonical-heap
  // invariant requires every alias target to have pass-stable identity. Each merge below is
  // therefore weak and reports its growth into `ev.s.changed` — a pass in which only this
  // node grew must not terminate the fixpoint, or a consumer evaluated earlier in the pass
  // (a function body, a later re-read) would never observe the growth.
  const result = ev.s.joinResultOf(node);
  if (arg !== undefined && ts.isArrayLiteralExpression(arg) && !arg.elements.some(ts.isSpreadElement)) {
    // Static array literal: element positions become ports.
    arg.elements.forEach((el, port) => {
      const elemValue = ev.evalExpr(el, ctx);
      ev.s.mergeJoinIn(id, port, collapse(elemValue));
      const field = liveField(result, String(port));
      if (mergeInto(field, elemValue)) ev.s.changed = true;
      if (addOcc(field, { exact: true, port, site: id })) ev.s.changed = true;
      // A place element aliases its slot in the resolved tuple: `Promise.all([secret, box])`
      // resolves the non-promise `box` to box ITSELF, so a write through `res[k]` / a
      // destructured element reaches the original (weak, inexact via mayAlias). The field
      // KEEPS the join port occ (added above), so no relay edge is lost.
      const elemPlace = ev.resolvePlace(el);
      if (elemPlace !== undefined) {
        const targets = (field.mayAlias ??= new Set());
        if (!targets.has(elemPlace)) {
          targets.add(elemPlace);
          ev.s.changed = true;
        }
      }
    });
    if (addOcc(result, { exact: true, site: id })) ev.s.changed = true;
    return result;
  }
  // Non-literal iterable: portless in-taint; the result is an additive relay.
  if (arg !== undefined) {
    const argCollapsed = collapse(ev.evalExpr(arg, ctx));
    ev.s.mergeJoinIn(id, -1, argCollapsed);
    if (mergeInto(result, argCollapsed)) ev.s.changed = true;
  }
  if (addOcc(result, { exact: true, site: id })) ev.s.changed = true;
  return result;
}
