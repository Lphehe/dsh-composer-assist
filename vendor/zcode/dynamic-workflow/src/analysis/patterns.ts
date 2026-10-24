import ts from "typescript";
import {
  addOcc,
  addPlaceholder,
  bindingPropertyKey,
  collapse,
  emptyValue,
  mergeInto,
  readField,
  type AbstractValue,
} from "./domain.js";
import type { EvalContext, Evaluator } from "./taint.js";

/**
 * Destructuring / aliasing bind machinery, split out of the core evaluator (taint.ts) like
 * the call/relay rules in calls.ts and the assignment rules in assign.ts — same `Evaluator`
 * instance, free-function shape. Declarations, for-of/for-in initializers and callback
 * parameters all route through {@link bindPattern}.
 */

/**
 * Bind a destructuring pattern (or a single name). When `sourcePlace` is a LIVE place,
 * pattern elements selecting a statically-known field ALIAS to that live field (the
 * extracted binding and the container share one object), so `const { o } = wrap; o.f = t`
 * is visible through `wrap.o`. See {@link extractField} for the seed-on-absent handling
 * that preserves opaque containers' collapse-fallback flow. Rest elements and non-place
 * sources keep value semantics (a folded / field-selected clone).
 */
export function bindPattern(
  ev: Evaluator,
  name: ts.BindingName,
  value: AbstractValue,
  ctx: EvalContext,
  sourcePlace?: AbstractValue,
): void {
  if (ts.isIdentifier(name)) {
    const sym = ev.checker.getSymbolAtLocation(name);
    if (sym !== undefined) ev.s.bindSymbol(sym, value);
    return;
  }
  if (ts.isObjectBindingPattern(name)) {
    for (const element of name.elements) {
      if (element.dotDotDotToken !== undefined) {
        bindPattern(ev, element.name, collapse(value), ctx); // rest: fold, exact preserved (value semantics)
        continue;
      }
      const key = bindingPropertyKey(element);
      if (sourcePlace !== undefined && key !== undefined) {
        bindPatternElement(ev, element.name, extractField(ev, sourcePlace, key), element.initializer, ctx);
      } else {
        bindPattern(ev, element.name, key === undefined ? collapse(value) : selectField(value, key), ctx);
      }
    }
    return;
  }
  let index = 0;
  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) {
      index += 1;
      continue;
    }
    if (element.dotDotDotToken !== undefined) {
      bindPattern(ev, element.name, collapse(value), ctx); // rest: value semantics
      continue;
    }
    if (sourcePlace !== undefined) {
      bindPatternElement(ev, element.name, extractField(ev, sourcePlace, String(index)), element.initializer, ctx);
    } else {
      bindPattern(ev, element.name, selectField(value, String(index)), ctx);
    }
    index += 1;
  }
}

/**
 * Bind one destructuring element to a LIVE field: a default initializer weak-merges into
 * the field (runtime may bind either the field or the default — a sound over-approx), and
 * the field is passed as both value and source so nested patterns keep aliasing.
 */
function bindPatternElement(
  ev: Evaluator,
  name: ts.BindingName,
  field: AbstractValue,
  initializer: ts.Expression | undefined,
  ctx: EvalContext,
): void {
  if (initializer !== undefined && mergeInto(field, ev.evalExpr(initializer, ctx))) ev.s.changed = true;
  bindPattern(ev, name, field, ctx, field);
}

/**
 * The live field at `key` of a place, for destructuring aliasing. An existing field is
 * returned as-is (a real sub-object). An ABSENT field is created and SEEDED with the
 * container's own occurrences + placeholders (occs-only) — exactly what a read of the
 * field would collapse to on an opaque container (`const { feedback } = review`), so the
 * extraction never drops taint; and because it is now a shared field, a later write
 * through the extracted binding lands where the container sees it too. Never re-seeds an
 * existing field (that would over-smear a precise sub-object).
 */
export function extractField(ev: Evaluator, container: AbstractValue, key: string): AbstractValue {
  const existing = container.fields.get(key);
  if (existing !== undefined) return existing;
  const field = emptyValue();
  for (const occ of container.occs.values()) addOcc(field, occ);
  for (const ph of container.phs.values()) addPlaceholder(field, ph);
  container.fields.set(key, field);
  ev.s.changed = true;
  return field;
}

/** Read a statically-known field with smear-on-read, else collapse (exact preserved). */
export function selectField(value: AbstractValue, key: string): AbstractValue {
  return readField(value, key);
}
