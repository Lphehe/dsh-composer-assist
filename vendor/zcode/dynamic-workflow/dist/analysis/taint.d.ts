import ts from "typescript";
import type { WorkflowProgram } from "../compiler/compile.js";
import type { SiteTable } from "./sites.js";
import { type AbstractValue } from "./domain.js";
import { TaintState } from "./state.js";
export interface EvalContext {
    /** Enclosing dataflow regions, innermost last: "top", `fn@<id>`, `cand@<order>`. */
    regionStack: string[];
    /** Sink for `return` statements in this region. */
    onReturn: (value: AbstractValue) => void;
}
/**
 * The taint half of the fused interpreter:
 * drive the whole-script transfer to a fixpoint. Emission is the caller's business —
 * interpret.ts reads the converged state through `emitFacts` / `emitOracle` and runs
 * the temporal walk over the same state.
 */
export declare class Evaluator {
    readonly s: TaintState;
    readonly checker: ts.TypeChecker;
    constructor(workflow: WorkflowProgram, table: SiteTable);
    converge(): void;
    private iterate;
    private evalFunction;
    /**
     * Record a guard expression's value as the control-dependence oracle, keyed by the
     * guard node's START OFFSET — the same node `traceOrder` hands to `controllersOf`, so a
     * parenthesized guard is keyed by its ParenthesizedExpression. This is a SINK, not a
     * flow: the value is recorded and not joined into anything, because a condition does not
     * join the data contract (see the ConditionalExpression case in evalExpr). Consumed only
     * by the causality graph.
     */
    recordGuard(node: ts.Expression, value: AbstractValue): void;
    visit(node: ts.Node, ctx: EvalContext): void;
    handleDeclaration(decl: ts.VariableDeclaration, ctx: EvalContext): void;
    /**
     * The LIVE (shared, unclonable) abstract value a *place expression* denotes, or
     * undefined for non-places (calls, literals, computed access, operators). A place is
     * an identifier (its env slot) or a chain of static property / literal-index element
     * accesses rooted at a place. Value-preserving wrappers (parens / `as` / `satisfies` /
     * non-null / type assertion) are peeled at every level. This is the single primitive
     * behind aliasing: bindings, container-literal fields, write receivers and param
     * write-back all resolve places through it. Reads must NOT call this (they clone).
     *
     * `create` governs missing field slots. WRITE receivers create empty fields on demand
     * (`arr[0].f = t` materializes `arr[0]`). Read-side callers (aliasing binds,
     * container-literal embedding, write-back actuals) pass `create=false`: an absent field
     * returns undefined so the caller falls back to value semantics (readField's collapse),
     * which correctly surfaces the container's own occurrences. Fabricating an empty field
     * there would alias to a phantom and DROP the opaque container's taint (e.g. reading
     * `review.feedback` off an opaque ask result must yield collapse(review), not ∅).
     */
    resolvePlace(expr: ts.Expression, create?: boolean): AbstractValue | undefined;
    private placeField;
    /**
     * The parameter write-back target for an actual argument `arg` whose evaluated value is
     * `value`. A place actual resolves to its live slot (write-back aliases through it, as
     * before). An object/array LITERAL's evaluated value IS its allocation-site place
     * (state.literalPlaceOf), and its FIELDS hold live places (`poke({ box })` — the literal's
     * `box` field IS the box slot), so that value is the write-back target: `mergeHeapEffects`
     * descends into it and a field the callee wrote through `p.box` lands on the shared `box`
     * slot, while a field written on the literal itself (`tag({ name }, t)` → `box.note = t`)
     * persists on the place and reaches whoever the callee hands the object to.
     * A literal argument once skipped write-back entirely, so mutations through its live
     * sub-objects were invisible to the caller; and when the literal was a per-pass fresh
     * value, that write-back re-reported a change on every pass and the fixpoint never
     * settled.
     */
    argWriteBackPlace(arg: ts.Expression, value: AbstractValue): AbstractValue | undefined;
    /**
     * Bind a destructuring pattern (or a single name). See {@link bindPattern} in patterns.ts;
     * exposed as a thin method because the aliasing-bind machinery is used across modules.
     */
    bindPattern(name: ts.BindingName, value: AbstractValue, ctx: EvalContext, sourcePlace?: AbstractValue): void;
    /** The live field at `key` of a place, for destructuring aliasing (see patterns.ts). */
    extractField(container: AbstractValue, key: string): AbstractValue;
    /** Read a statically-known field with smear-on-read, else collapse (see patterns.ts). */
    selectField(value: AbstractValue, key: string): AbstractValue;
    evalExpr(node: ts.Expression, ctx: EvalContext): AbstractValue;
    private evalIdentifier;
    /**
     * The implicit `arguments` object as a rest-like placeholder gathering every actual of
     * the nearest enclosing NON-arrow function (param index 0, rest). `arguments[i]` then
     * reads a field of it → collapse keeps the placeholder → emission expands it to all
     * recorded actuals (a sound over-approximation: `arguments[0]` yields the whole list).
     * Arrow functions have no own `arguments`, so the ancestor walk skips them and binds the
     * enclosing function's — matching JS's lexical `arguments`. Previously `arguments`
     * resolved to the lib symbol with no env slot, so `arguments[0]` dropped every
     * actual's taint.
     */
    private argumentsValue;
    private evalBinary;
    private evalPropertyAccess;
    private evalElementAccess;
    receiverSymbol(expr: ts.Expression): ts.Symbol | undefined;
}
//# sourceMappingURL=taint.d.ts.map