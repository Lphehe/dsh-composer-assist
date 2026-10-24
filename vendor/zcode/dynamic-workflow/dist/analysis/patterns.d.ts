import ts from "typescript";
import { type AbstractValue } from "./domain.js";
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
export declare function bindPattern(ev: Evaluator, name: ts.BindingName, value: AbstractValue, ctx: EvalContext, sourcePlace?: AbstractValue): void;
/**
 * The live field at `key` of a place, for destructuring aliasing. An existing field is
 * returned as-is (a real sub-object). An ABSENT field is created and SEEDED with the
 * container's own occurrences + placeholders (occs-only) — exactly what a read of the
 * field would collapse to on an opaque container (`const { feedback } = review`), so the
 * extraction never drops taint; and because it is now a shared field, a later write
 * through the extracted binding lands where the container sees it too. Never re-seeds an
 * existing field (that would over-smear a precise sub-object).
 */
export declare function extractField(ev: Evaluator, container: AbstractValue, key: string): AbstractValue;
/** Read a statically-known field with smear-on-read, else collapse (exact preserved). */
export declare function selectField(value: AbstractValue, key: string): AbstractValue;
//# sourceMappingURL=patterns.d.ts.map