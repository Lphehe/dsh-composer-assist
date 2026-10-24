import ts from "typescript";
import type { WorkflowProgram } from "../compiler/compile.js";
import type { HoleSite, IterationCandidate, SiteTable } from "./sites.js";
import { type AbstractValue, type TaintFacts, type TaintOcc } from "./domain.js";
/**
 * The mutable fixpoint state of the taint pass: the site lookups, the global
 * environment, function summaries, the reachability/promotion sets, and the sink
 * accumulators. The evaluator (taint.ts) drives it; this module owns the storage,
 * the monotone update primitives (each reports growth via `changed`), and the final
 * placeholder-resolving emission of {@link TaintFacts}.
 */
/** How a function reached a call site: as the thing called, or as an argument a library may invoke. */
export type ApplicationVia = "callee" | "argument";
export declare class TaintState {
    readonly table: SiteTable;
    readonly checker: ts.TypeChecker;
    readonly program: ts.Program;
    readonly scriptFile: ts.SourceFile;
    readonly body: ts.Block;
    readonly askByCall: Map<ts.CallExpression, string>;
    readonly askSites: Map<string, {
        receiver: ts.Expression;
        instructions: ts.Expression | undefined;
    }>;
    readonly worldByCall: Map<ts.CallExpression, {
        id: string;
        args: readonly ts.Expression[];
    }>;
    readonly joinByCall: Map<ts.CallExpression, {
        id: string;
        arg: ts.Expression | undefined;
    }>;
    readonly actorByCall: Map<ts.CallExpression, string>;
    /** 留白调用 → 站点（开放与已补全都在；transfer 规则按有无 body 分派）。 */
    readonly holeByCall: Map<ts.CallExpression, HoleSite>;
    /** Per-element callback calls (`xs.map(fn)`, `Array.from(xs, fn)`, …), keyed by the CALL. */
    readonly candByCall: Map<ts.CallExpression, IterationCandidate>;
    readonly candByForOf: Map<ts.Node, IterationCandidate>;
    /**
     * THE CALL ORACLE: for every call / `new` /
     * tagged-template node, the script-local functions this pass applied there and HOW —
     * `callee` (the node's callee value held the function: direct call, through a parameter,
     * a field, a class member) or `argument` (the node handed the function to a library callee
     * that may invoke it: a registry entry or the keystone rule). Monotone like every other
     * accumulator; read after convergence by the ordering walk, which inlines exactly these
     * bodies at exactly these sites instead of guessing from syntax.
     */
    readonly applications: Map<ts.Node, Map<ts.Node, ApplicationVia>>;
    /**
     * The live abstract result of each `Promise.all` join call, keyed by the join CALL NODE
     * and PERSISTENT across fixpoint passes (see {@link joinResultOf}). A join result IS a
     * place whose element fields carry may-alias back-references to the (place) inputs, so
     * resolvePlace returns it — letting `const [a, b] = await Promise.all([…])`
     * destructure-alias the elements and a write through `res[k]` reach the original input.
     */
    readonly joinResults: Map<ts.CallExpression, AbstractValue>;
    /**
     * The live abstract place of each conditional expression used as a place
     * (`flag ? box1 : box2`), keyed by the ConditionalExpression NODE and persistent across
     * passes (see {@link condPlaceOf}). Same canonical-heap requirement as {@link joinResults}.
     */
    readonly condPlaces: Map<ts.ConditionalExpression, AbstractValue>;
    /** Allocation-site places of container literals; see {@link literalPlaceOf}. */
    readonly literalPlaces: Map<ts.ObjectLiteralExpression | ts.ArrayLiteralExpression, AbstractValue>;
    readonly fnId: Map<ts.Node, number>;
    readonly fnParamSymbols: Map<number, (ts.Symbol | undefined)[]>;
    readonly functions: ts.Node[];
    readonly callbackNodes: Set<ts.Node>;
    /**
     * Object-literal set accessors, keyed by property name -> setter fn ids. Crude but
     * sound: an assignment to ANY property of that name (on any object) records the
     * assigned value as the setter's param-0 actual, so the setter body's flow is seen.
     */
    readonly settersByProp: Map<string, number[]>;
    /**
     * One shared abstract instance per class declaration/expression, keyed by the class
     * node. Static AND instance members conflate into this ONE value (a deliberate sound
     * over-approximation: per-instance and static/instance precision are out of scope, so
     * a write through any instance, through `this`, or through the class name is visible
     * through every other). Persistent across fixpoint passes — growth is signalled like
     * any env slot.
     */
    readonly classInstances: Map<ts.Node, AbstractValue>;
    /** Class declarations/expressions in the workflow body, in discovery order. */
    readonly classes: ts.Node[];
    readonly env: Map<ts.Symbol, AbstractValue>;
    readonly summaries: Map<number, AbstractValue>;
    readonly paramActuals: Map<string, AbstractValue>;
    /**
     * Per-placeholder-parameter set of values that MAY be passed to an INVOCATION of that
     * parameter (keyed by `${fnId}:${param}`). Two capture sites (calls.ts handleUnknownCall):
     * a direct call of a placeholder callee (`resolve(draft)` — resolve is param 0), and a
     * placeholder-valued argument to an unknown call (`draft.then(onOk)` — the unknown `.then`
     * may invoke onOk with the receiver pot). Consumed by the promise machinery: `new
     * Unknown(fn)` and `await thenable` resolve to whatever fn's / then's callback params
     * receive (the resolve/reject/continuation pattern). Distinct from {@link paramActuals},
     * which records what a function receives when IT is called.
     */
    readonly phCallActuals: Map<string, AbstractValue>;
    readonly reachSet: Set<string>;
    readonly calledFns: Map<string, Set<number>>;
    readonly promotedOrders: Set<number>;
    /**
     * Per-`reduce`-candidate accumulator taint (keyed by candidate `order`), carried
     * ACROSS fixpoint passes. The callback-return value that reduce threads into the
     * accumulator param is a fresh local each pass, so binding the param from it
     * directly never observed the return taint; this persistent slot fixes that.
     */
    readonly reduceAcc: Map<number, AbstractValue>;
    readonly askInstr: Map<string, AbstractValue>;
    readonly askRecv: Map<string, AbstractValue>;
    readonly worldRead: Map<string, AbstractValue>;
    /** 开放留白的提示 sink（docs/analysis.md「Sites」：提示流入留白，如 ask 的 instructions）。 */
    readonly holePrompt: Map<string, AbstractValue>;
    readonly joinInByPort: Map<string, Map<number, AbstractValue>>;
    readonly fanoutInVal: Map<string, AbstractValue>;
    /**
     * The ORACLE accumulators, keyed by source START OFFSET rather than by site id: the
     * value each `await` operand carries, and the value each guard expression reads. They
     * feed {@link emitOracle}, which only the temporal walk (causality-order.ts) consumes —
     * nothing here changes a transfer rule, and a position keys nothing in the site
     * vocabulary, which is what keeps the site-id stability rule untouched: no `order`
     * counter and no per-kind counter is consulted.
     */
    readonly awaitVal: Map<number, AbstractValue>;
    readonly guardVal: Map<number, AbstractValue>;
    readonly returnVal: AbstractValue;
    /**
     * One script-global thrown-value set: every `throw` joins its operand into it and
     * every `catch` binding reads all of it. A flow-insensitive over-approximation of
     * exception routing — sound under gen-only, deliberately imprecise across disjoint
     * `try` blocks. Persistent across passes so throws in one iteration reach catches
     * in the next (fixpoint-safe).
     */
    readonly thrownVal: AbstractValue;
    changed: boolean;
    constructor(workflow: WorkflowProgram, table: SiteTable);
    private buildLookups;
    private collectFunctions;
    /**
     * Bind a symbol to an abstract value. A FRESH symbol ADOPTS the value object by
     * reference (`env[sym] === value`); an already-bound slot weak-merges (sound smear).
     * Adoption is what makes bindings alias rather than snapshot: passing a live place (env slot / live field) shares it, so a later
     * write through any alias is visible through every other. Callers that must NOT
     * alias pass a fresh clone/collapse (reads already return snapshots).
     */
    bindSymbol(sym: ts.Symbol, value: AbstractValue): void;
    envSlot(sym: ts.Symbol): AbstractValue;
    summaryOf(id: number): AbstractValue;
    /** The shared abstract instance of a class node, created empty on demand (persistent). */
    instanceOf(cls: ts.Node): AbstractValue;
    /**
     * The shared abstract result of a join call, created empty on demand (persistent).
     *
     * THE CANONICAL-HEAP INVARIANT: every value that models runtime storage — anything that
     * can be aliased, written through, or referenced from a `mayAlias` set — is keyed by a
     * static program point and lives across fixpoint passes; per-pass temporaries are
     * snapshots only. handleJoin used to mint a FRESH result value each pass, so
     * `Promise.all([Promise.all([…])])` added a never-before-seen object to the outer
     * element's `mayAlias` set every pass. That set dedups by IDENTITY (domain.ts), so
     * `changed` stayed true forever and the fixpoint hit ITERATION_CAP. Keying the result by
     * the call node makes the identity stable, so the union saturates.
     */
    joinResultOf(call: ts.CallExpression): AbstractValue;
    /**
     * The shared abstract place of a conditional expression, created empty on demand
     * (persistent). Same canonical-heap invariant as {@link joinResultOf}: a per-pass
     * wrapper for `flag ? box1 : box2` diverged the fixpoint as soon as it became a
     * `mayAlias` target — which a SYNTACTICALLY NESTED ternary place
     * (`f2 ? (f ? box1 : box2) : box3`) does on every pass.
     */
    condPlaceOf(node: ts.ConditionalExpression): AbstractValue;
    /**
     * The allocation-site place of a container literal (`{…}` / `[…]`): the value its first
     * evaluation produced, kept across passes and weak-merged with every re-evaluation
     * (persistent). Same canonical-heap invariant as {@link joinResultOf}: a literal IS runtime
     * storage — a callee writes through it (`fill([], v)`, `tag({ name }, t)` with
     * `box.note = t`), a binding adopts it, a spread shares its fields — so a value recreated
     * every pass can never settle once something persistent merges INTO it. The
     * parameter write-back targeted the per-pass fresh literal, reported a change on every pass
     * (the note it had just added was gone again), and the fixpoint hit ITERATION_CAP with no
     * state growing at all. Any `f({ … })` whose callee mutates its parameter was affected.
     *
     * Adopting the first evaluation (rather than minting an empty slot) keeps the literal's
     * aliasing: a field that stores a live place (`{ box }`, `[obj]`) keeps pointing at that
     * slot, and later passes merge the same slot into itself — an identity no-op. Snapshot
     * fields accumulate monotonically, exactly as an env slot bound to the literal always did.
     */
    literalPlaceOf(node: ts.ObjectLiteralExpression | ts.ArrayLiteralExpression, fresh: AbstractValue): AbstractValue;
    mergeReturn(value: AbstractValue): void;
    /** Join a thrown operand into the script-global thrown-value set. */
    mergeThrown(value: AbstractValue): void;
    /**
     * Weak-merge into a keyed sink accumulator. Generic in the key so the oracle
     * accumulators ({@link awaitVal} / {@link guardVal}), which are keyed by source offset
     * rather than site id, share the one monotone update path every other sink uses.
     */
    mergeSink<K>(map: Map<K, AbstractValue>, id: K, value: AbstractValue): void;
    mergeJoinIn(id: string, port: number, value: AbstractValue): void;
    addParamActual(id: number, param: number, value: AbstractValue): void;
    /** Record a value that may reach an invocation of the placeholder-parameter `key`. */
    recordPhCall(key: string, value: AbstractValue): void;
    /** The taint fed to invocations of a function's parameter `param`, if any. */
    phCallActualsOf(id: number, param: number): AbstractValue | undefined;
    /** The persistent accumulator taint for a `reduce` candidate (empty until seeded). */
    reduceAccOf(order: number): AbstractValue;
    /** Merge a pass's callback-return taint into a `reduce` candidate's accumulator. */
    mergeReduceAcc(order: number, value: AbstractValue): void;
    /**
     * Record a call against EVERY enclosing region, mirroring {@link markFacade}.
     * Recording only the innermost region left a caller function `fn@f`
     * unmarked when its call to `g` happened inside an iteration candidate's callback
     * (region `cand@N`). Reachability then never propagated `fn@f`, so a sibling
     * candidate whose callback calls `f` failed to promote to a fan-out — an
     * under-approximation (a dropped may-flow), which this analysis must never do.
     */
    markCalled(regionStack: string[], id: number): void;
    /** Record that `fn` was applied at `site` (see {@link applications}). Not a fixpoint
     * signal: applications feed no transfer rule, and the final pass re-records them all. */
    recordApplication(site: ts.Node, fn: ts.Node, via: ApplicationVia): void;
    /** Mark every enclosing region as reaching a facade site. */
    markFacade(regionStack: string[]): void;
    /** Propagate reachability across the call graph until it stops growing. */
    propagateReachability(): void;
    /** Promote iteration candidates whose body region reaches a facade site. */
    recomputePromotion(): void;
    emitFacts(): TaintFacts;
    /**
     * The ordering walk's oracle view, resolved directly off the CONVERGED interpreter
     * state — the fused pass's replacement for the `awaitSettles`/`guardReads` members
     * TaintFacts used to carry.
     * Same keying (`node.getStart(scriptFile)` of the awaited/guard expression) and the
     * SAME resolution pipeline as every artifact sink (placeholders expanded, collapsed,
     * actor labels filtered) — so an awaited parameter still resolves to the union of the
     * promises its callers passed in, across all call sites. That union is normative: the
     * temporal walk must see today's context-INsensitive values bit-for-bit; caller-context
     * precision is explicitly out of scope.
     *
     * Only meaningful after the fixpoint has converged; interpret.ts is the one caller.
     */
    emitOracle(): {
        awaitSettles: Map<number, TaintOcc[]>;
        guardReads: Map<number, TaintOcc[]>;
        applications: ReadonlyMap<ts.Node, ReadonlyMap<ts.Node, ApplicationVia>>;
    };
    private resolveArtifact;
    private resolveActor;
    private resolveOccs;
    /** Expand parameter placeholders to the union of actual arguments across all calls. */
    private resolvePlaceholders;
    private resolvePlaceholder;
    bindPlaceholderParams(fn: ts.Node, id: number): void;
}
//# sourceMappingURL=state.d.ts.map