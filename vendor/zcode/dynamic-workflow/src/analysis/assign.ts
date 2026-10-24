import ts from "typescript";
import {
  collapse,
  liveField,
  mergeInto,
  replayMayAliasWrite,
  staticIndexKey,
  unionValues,
  type AbstractValue,
} from "./domain.js";
import { type EvalContext, type Evaluator } from "./taint.js";

/**
 * Assignment transfer rules: plain `=`, compound / logical assignments (`+=`, `||=`,
 * `??=`, …), and destructuring assignment EXPRESSIONS (`[a, b] = xs`, `({ x } = o)`).
 * These live apart from the core evaluator (taint.ts) but operate on the same
 * `Evaluator` instance.
 */

/** `target = value`: bind the target (destructuring pattern or lvalue), yield value. */
export function handleAssignment(ev: Evaluator, node: ts.BinaryExpression, ctx: EvalContext): AbstractValue {
  const value = ev.evalExpr(node.right, ctx);
  // When the RHS is a place, the assignment aliases (shares the live reference) rather
  // than snapshotting, so a later write through either side is seen through both. For a
  // destructuring target the place is the source each element aliases a live field of.
  const rhsPlace = ev.resolvePlace(node.right);
  const target = peelParens(node.left);
  // Destructuring assignment expressions bind exactly like destructuring declarations.
  // Previously handleAssignment matched only identifier/property/element
  // targets, so these bound nothing (bindPattern was wired only to declarations/for-of).
  if (ts.isArrayLiteralExpression(target) || ts.isObjectLiteralExpression(target)) {
    bindAssignmentPattern(ev, target, value, ctx, rhsPlace);
    return value;
  }
  writeTarget(ev, target, value, ctx, rhsPlace);
  return value;
}

/**
 * `x += rhs` (and every compound / logical assignment): weak-merge the RHS into the
 * target through the same paths as plain assignment (gen-only has no kills, so the
 * old value stays), and yield the union of the target's prior value and the RHS.
 * evalBinary special-cased only `=`, so `+=`/`||=`/`??=`/… computed the value
 * but never wrote it back — the target kept its pre-op taint.
 */
export function handleCompoundAssignment(ev: Evaluator, node: ts.BinaryExpression, ctx: EvalContext): AbstractValue {
  const rhs = ev.evalExpr(node.right, ctx);
  const prior = ev.evalExpr(node.left, ctx);
  // A read-modify-write keeps the target's own identity (no aliasing): merge, not adopt.
  writeTarget(ev, peelParens(node.left), rhs, ctx);
  return unionValues(prior, rhs);
}

/**
 * Weak-merge (or alias, when `rhsPlace` is given) `value` into an assignment target.
 * Property / element receivers are resolved to their LIVE value via `resolvePlace`, so
 * `wrap.o.f = t`, `arr[0].f = t`, and writes through extracted sub-objects mutate the
 * SHARED field object — visible through every alias. Unresolvable receivers (a computed
 * index somewhere in the chain) fall back to smearing into the root identifier.
 */
function writeTarget(ev: Evaluator, target: ts.Expression, value: AbstractValue, ctx: EvalContext, rhsPlace?: AbstractValue): void {
  if (ts.isIdentifier(target)) {
    const sym = ev.checker.getSymbolAtLocation(target);
    if (sym !== undefined) ev.s.bindSymbol(sym, rhsPlace ?? value);
  } else if (ts.isPropertyAccessExpression(target)) {
    const recv = ev.resolvePlace(target.expression, true);
    if (recv !== undefined) writeField(ev, recv, target.name.text, value, rhsPlace);
    else mergeIntoRootIdentifier(ev, target.expression, value);
    recordSetterWrite(ev, target.name.text, value);
  } else if (ts.isElementAccessExpression(target)) {
    const key = staticIndexKey(target.argumentExpression);
    const recv = ev.resolvePlace(target.expression, true);
    if (key !== undefined) {
      // Static index: field-sensitive write into the live container (aliasing if a place).
      if (recv !== undefined) writeField(ev, recv, key, value, rhsPlace);
      else mergeIntoRootIdentifier(ev, target.expression, value);
      return;
    }
    // Computed index: the key expression must be evaluated (a facade sink can sit in it, e.g.
    // `o[await ask()] = v`) AND its taint becomes an observable property NAME (surfaced by
    // `for..in` / `Object.keys`, "strings launder nothing"), so it joins the container
    // alongside the value. Previously the key was never evaluated and its taint never
    // recorded, so both the sink and the key-derived flow were dropped.
    const keyTaint = collapse(ev.evalExpr(target.argumentExpression, ctx));
    if (recv !== undefined) {
      if (mergeInto(recv, keyTaint)) ev.s.changed = true;
      if (mergeInto(recv, collapse(value))) ev.s.changed = true;
    } else {
      mergeIntoRootIdentifier(ev, target.expression, keyTaint);
      mergeIntoRootIdentifier(ev, target.expression, value);
    }
  }
}

/**
 * Write a value into a live container field. A place RHS ADOPTS the shared reference
 * when the field slot is fresh (so the field and the RHS name are one aliased object);
 * an existing slot or a non-place value weak-merges. Mirrors bindSymbol's adopt-vs-merge.
 */
function writeField(ev: Evaluator, container: AbstractValue, key: string, value: AbstractValue, rhsPlace?: AbstractValue): void {
  if (rhsPlace !== undefined && !container.fields.has(key)) {
    container.fields.set(key, rhsPlace);
    ev.s.changed = true;
    return;
  }
  const field = liveField(container, key);
  if (field !== (rhsPlace ?? value) && mergeInto(field, rhsPlace ?? value)) ev.s.changed = true;
  // Aliasing assignment onto an ALREADY-materialized field slot: the slot and the RHS
  // place are the same runtime object, so a write already sitting in the slot must also
  // reach the RHS place (and vice versa, above). This arises when a guarded write
  // fabricates the slot BEFORE the alias assignment in source order and a loop carries
  // the flow (`wrap.box.f = t` then `wrap.box = box`): re-pointing the slot to the place
  // would strand the fabricated slot's taint, so merge it back weakly instead.
  // Previously the merge only ran one direction, so the fabricated slot's
  // `ask#1` never reached the box.
  if (rhsPlace !== undefined && field !== rhsPlace && mergeInto(rhsPlace, field)) ev.s.changed = true;
  // May-alias replay: a conditional-binding / join-element container's write reaches every
  // candidate place it may BE (weak, inexact — the write lands on one arm only).
  if (replayMayAliasWrite(container, key, rhsPlace ?? value)) ev.s.changed = true;
}

/**
 * An object-literal set accessor is registered globally by property name; any write to
 * a property of that name records the assigned value as the setter's param-0 actual.
 * Deliberately crude (name-based, ignores the receiver object) — a sound
 * over-approximation so the setter body's flow is observed at all.
 */
function recordSetterWrite(ev: Evaluator, name: string, value: AbstractValue): void {
  const setters = ev.s.settersByProp.get(name);
  if (setters === undefined) return;
  const actual = collapse(value);
  for (const id of setters) ev.s.addParamActual(id, 0, actual);
}

/**
 * Bind an assignment-expression destructuring pattern (an array/object literal on an
 * lvalue). The expression-flavored mirror of `bindPattern`: targets are expressions
 * (identifiers, property/element accesses, nested patterns), not BindingNames, and
 * property/element targets go through the weak heap-write paths. When `sourcePlace` is a
 * live place, each element aliases a live field of it (via {@link Evaluator.extractField}),
 * mirroring the declaration path; rest/spread and non-place sources keep value semantics.
 */
function bindAssignmentPattern(
  ev: Evaluator,
  target: ts.Expression,
  value: AbstractValue,
  ctx: EvalContext,
  sourcePlace?: AbstractValue,
): void {
  if (ts.isArrayLiteralExpression(target)) {
    let index = 0;
    for (const element of target.elements) {
      if (ts.isOmittedExpression(element)) {
        index += 1;
        continue;
      }
      if (ts.isSpreadElement(element)) {
        bindAssignmentTarget(ev, element.expression, collapse(value), ctx); // rest: value semantics
        continue;
      }
      if (sourcePlace !== undefined) {
        const field = ev.extractField(sourcePlace, String(index));
        bindAssignmentTarget(ev, element, field, ctx, field);
      } else {
        bindAssignmentTarget(ev, element, ev.selectField(value, String(index)), ctx);
      }
      index += 1;
    }
    return;
  }
  if (!ts.isObjectLiteralExpression(target)) return;
  for (const prop of target.properties) {
    if (ts.isSpreadAssignment(prop)) {
      bindAssignmentTarget(ev, prop.expression, collapse(value), ctx);
    } else if (ts.isShorthandPropertyAssignment(prop)) {
      if (sourcePlace !== undefined) {
        const field = ev.extractField(sourcePlace, prop.name.text);
        // Default (`{ x = d }`) weak-merges into the live field, keeping the alias.
        if (prop.objectAssignmentInitializer !== undefined) {
          if (mergeInto(field, ev.evalExpr(prop.objectAssignmentInitializer, ctx))) ev.s.changed = true;
        }
        writeTarget(ev, prop.name, field, ctx, field);
      } else {
        let elemValue = ev.selectField(value, prop.name.text);
        if (prop.objectAssignmentInitializer !== undefined) {
          elemValue = unionValues(elemValue, ev.evalExpr(prop.objectAssignmentInitializer, ctx));
        }
        writeTarget(ev, prop.name, elemValue, ctx);
      }
    } else if (ts.isPropertyAssignment(prop) && !ts.isComputedPropertyName(prop.name)) {
      const key = prop.name.getText(ev.s.scriptFile);
      if (sourcePlace !== undefined) {
        const field = ev.extractField(sourcePlace, key);
        bindAssignmentTarget(ev, prop.initializer, field, ctx, field);
      } else {
        bindAssignmentTarget(ev, prop.initializer, ev.selectField(value, key), ctx);
      }
    } else if (ts.isPropertyAssignment(prop)) {
      bindAssignmentTarget(ev, prop.initializer, collapse(value), ctx); // computed key: value semantics
    }
  }
}

/**
 * Bind a for-in / for-of loop variable to `value` through the EXISTING binding machinery
 * (no parallel path): the declaration form (`for (const k … )`) routes through bindPattern,
 * the assignment form (`for (k … )` or a destructuring assignment target) through
 * bindAssignmentTarget. The loop value is derived (not a place), so value semantics — no
 * aliasing sourcePlace. Previously for-of bound only the declaration form and
 * for-in bound nothing at all, dropping element / key taint into every read
 * of the loop variable.
 */
export function bindForInitializer(
  ev: Evaluator,
  initializer: ts.ForInitializer,
  value: AbstractValue,
  ctx: EvalContext,
): void {
  if (!ts.isVariableDeclarationList(initializer)) {
    bindAssignmentTarget(ev, initializer, value, ctx);
    return;
  }
  const decl = initializer.declarations[0];
  if (decl !== undefined) ev.bindPattern(decl.name, value, ctx);
}

/** One target of an assignment pattern: a nested pattern, a default, or an lvalue. */
function bindAssignmentTarget(
  ev: Evaluator,
  target: ts.Expression,
  value: AbstractValue,
  ctx: EvalContext,
  sourcePlace?: AbstractValue,
): void {
  let t = peelParens(target);
  if (ts.isBinaryExpression(t) && t.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    // `[a = d]` / `{ x: a = d }`: the default joins in (it may carry taint). When aliasing,
    // `value` IS the live field, so merge the default into it in place to keep the alias.
    if (sourcePlace !== undefined) {
      if (mergeInto(value, ev.evalExpr(t.right, ctx))) ev.s.changed = true;
    } else {
      value = unionValues(value, ev.evalExpr(t.right, ctx));
    }
    t = peelParens(t.left);
  }
  if (ts.isArrayLiteralExpression(t) || ts.isObjectLiteralExpression(t)) {
    bindAssignmentPattern(ev, t, value, ctx, sourcePlace);
    return;
  }
  writeTarget(ev, t, value, ctx, sourcePlace);
}

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
export function mergeIntoRootIdentifier(ev: Evaluator, expr: ts.Expression, value: AbstractValue): void {
  let cur: ts.Expression = expr;
  while (true) {
    if (ts.isParenthesizedExpression(cur)) cur = cur.expression;
    else if (ts.isPropertyAccessExpression(cur)) cur = cur.expression;
    else if (ts.isElementAccessExpression(cur)) cur = cur.expression;
    // Peel the value-preserving wrappers that can sit on an lvalue chain
    // (`report!.sections.intro = x`, `(report as T).sections = x`) so the walk still
    // reaches the root identifier instead of stopping short and dropping x.
    else if (ts.isNonNullExpression(cur)) cur = cur.expression;
    else if (ts.isAsExpression(cur) || ts.isSatisfiesExpression(cur)) cur = cur.expression;
    else if (ts.isTypeAssertionExpression(cur)) cur = cur.expression;
    else break;
  }
  if (!ts.isIdentifier(cur)) return;
  const sym = ev.checker.getSymbolAtLocation(cur);
  if (sym !== undefined && mergeInto(ev.s.envSlot(sym), collapse(value))) ev.s.changed = true;
}

/** Peel parentheses off an lvalue expression. */
function peelParens(expr: ts.Expression): ts.Expression {
  let cur = expr;
  while (ts.isParenthesizedExpression(cur)) cur = cur.expression;
  return cur;
}
