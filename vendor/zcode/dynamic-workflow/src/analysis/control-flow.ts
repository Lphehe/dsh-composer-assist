import ts from "typescript";
import { addOcc, cloneValue, collapse, mergeInto, provisionalFanoutId, type AbstractValue } from "./domain.js";
import { bindForInitializer } from "./assign.js";
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
export function visitForStatement(ev: Evaluator, node: ts.ForStatement, ctx: EvalContext): void {
  if (node.initializer !== undefined) {
    if (ts.isVariableDeclarationList(node.initializer)) {
      for (const decl of node.initializer.declarations) ev.handleDeclaration(decl, ctx);
    } else {
      ev.evalExpr(node.initializer, ctx);
    }
  }
  if (node.condition !== undefined) ev.recordGuard(node.condition, ev.evalExpr(node.condition, ctx));
  if (node.incrementor !== undefined) ev.evalExpr(node.incrementor, ctx);
  ev.visit(node.statement, ctx);
}

/**
 * `for (x of xs) body`: the element value is the collapsed iterable (+ a fan-out label when the
 * loop is a promoted iteration candidate), bound through the same machinery as any other loop
 * variable. Derived, not a place, so binding keeps value semantics.
 */
export function handleForOf(ev: Evaluator, node: ts.ForOfStatement, ctx: EvalContext): void {
  const cand = ev.s.candByForOf.get(node);
  const iterated = collapse(ev.evalExpr(node.expression, ctx));
  // `for await (… of …)` awaits every element, so the ITERATED expression is the settle
  // oracle for the loop's per-iteration barrier — and the ordering walk puts that barrier
  // at exactly this expression's position, which is the key it looks the oracle up under.
  if (node.awaitModifier !== undefined) {
    ev.s.mergeSink(ev.s.awaitVal, node.expression.getStart(ev.s.scriptFile), iterated);
  }
  const element = cloneValue(iterated);
  let regionStack = ctx.regionStack;
  if (cand !== undefined) {
    const fanoutId = provisionalFanoutId(cand.order);
    if (ev.s.promotedOrders.has(cand.order)) {
      ev.s.mergeSink(ev.s.fanoutInVal, fanoutId, iterated);
      addOcc(element, { exact: true, site: fanoutId });
    }
    regionStack = [...ctx.regionStack, `cand@${cand.order}`];
  }
  // The element value is derived (collapsed iterable + fan-out label), not a place, so for-of
  // binding keeps value semantics. Only the declaration form used to be bound; an
  // assignment-form initializer (`for (cur of xs)`, or a destructuring target) bound nothing,
  // dropping the element's taint into every read of the loop variable.
  bindForInitializer(ev, node.initializer, element, ctx);
  ev.visit(node.statement, { onReturn: ctx.onReturn, regionStack });
  // Element-mutation write-back: the loop variable may-aliases the iterable's elements, so a
  // field written through it (`for (const y of b) y.note = t`) reaches the collection. Weak-
  // merge the element's FIELD effects (collapsed) into the collection place — a later
  // `b[k].note` read smears them out. Mirrors the array-method fan-out write-back. Without
  // this write-back, for-of element writes would be invisible to the collection.
  //
  // The write-back used to scan only THIS pass's fresh `element` clone, but
  // body writes land on the loop variable's persistent env slot — bindSymbol ADOPTS the pass-1
  // object and later passes merely merge the fresh clone INTO it. A clone of the collapsed
  // iterable has no fields, so element-field taint first arriving on pass >= 2 (exactly the
  // loop-carried flows) was never written back, and a DESTRUCTURED loop variable
  // (`for (const { doc } of items) doc.note = t`), whose sub-bindings hold their own slots,
  // never populated `element.fields` at all. Write back from the slots the body actually
  // wrote through: every binding of the initializer, plus `element` itself (which still
  // carries pass-1 writes for the identifier form).
  const collectionPlace = ev.resolvePlace(node.expression);
  if (collectionPlace !== undefined) {
    const writeBackFields = (holder: AbstractValue): void => {
      for (const field of holder.fields.values()) {
        if (mergeInto(collectionPlace, collapse(field))) ev.s.changed = true;
      }
    };
    writeBackFields(element);
    for (const sym of boundSymbolsOfForInitializer(ev, node.initializer)) {
      const slot = ev.s.env.get(sym);
      if (slot !== undefined && slot !== collectionPlace) writeBackFields(slot);
    }
  }
}

/**
 * The symbols a for-of initializer binds — the slots its body writes element mutations
 * through. Declaration form walks the (possibly destructuring) binding name; assignment
 * form covers the plain-identifier target (destructuring assignment targets write through
 * the heap paths of assign.ts, which need no loop write-back).
 */
function boundSymbolsOfForInitializer(ev: Evaluator, initializer: ts.ForInitializer): ts.Symbol[] {
  const out: ts.Symbol[] = [];
  const addName = (name: ts.BindingName): void => {
    if (ts.isIdentifier(name)) {
      const sym = ev.checker.getSymbolAtLocation(name);
      if (sym !== undefined) out.push(sym);
      return;
    }
    for (const el of name.elements) {
      if (ts.isBindingElement(el)) addName(el.name);
    }
  };
  if (ts.isVariableDeclarationList(initializer)) {
    const decl = initializer.declarations[0];
    if (decl !== undefined) addName(decl.name);
    return out;
  }
  if (ts.isIdentifier(initializer)) {
    const sym = ev.checker.getSymbolAtLocation(initializer);
    if (sym !== undefined) out.push(sym);
  }
  return out;
}

/**
 * `for (k in obj) body`: for-in enumerates the object's KEYS; each key string is derived from
 * that object ("strings launder nothing"), so the loop variable carries its collapsed taint.
 * For-in used to share the while/do arm (which binds nothing), so key-derived flow
 * (`keys += k`) was dropped for both the declaration and assignment initializer forms.
 */
export function handleForIn(ev: Evaluator, node: ts.ForInStatement, ctx: EvalContext): void {
  bindForInitializer(ev, node.initializer, collapse(ev.evalExpr(node.expression, ctx)), ctx);
  ev.visit(node.statement, ctx);
}
