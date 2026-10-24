import ts from "typescript";
import { type ArtifactOp, type WorldReadOp } from "../facade/registry.js";
import { type ScriptLoc, type WorkflowProgram } from "../compiler/compile.js";
import type { NamePattern } from "./types.js";
import { type CallbackSemantics } from "./callbacks.js";
export { isFacadeDeclared, resolveSymbol } from "./sites-labels.js";
/**
 * The site table: the raw substrate the taint pass builds on. One walk over the
 * wrapped script body collects every facade call site (resolved via the checker,
 * never by name), keeps their `ts.Node` references, and records iteration
 * candidates and top-level returns. This module owns the table type; it is
 * deliberately NOT re-exported from the package index — only `analyzeWorkflowScript`
 * and the graph types are public.
 *
 * Ordinal ids are per-kind source-order counters (`ask#1`, `join#2`, …); `order`
 * is a single global discovery sequence used to merge the per-kind lists back into
 * source order for serialization. Source order = pre-order AST traversal, which is
 * `ts.forEachChild` order.
 */
export interface AskSite {
    id: string;
    order: number;
    label: string;
    /** `label` 落到兜底串时，内联 `agent()` receiver 的模板形状；见 `askLabelPattern`。 */
    labelPattern?: NamePattern;
    loc: ScriptLoc;
    /** The `x.ask(...)` call. */
    call: ts.CallExpression;
    /** The receiver of `.ask` (the actor expression). Read for actor/context labels. */
    receiver: ts.Expression;
    /** The instruction argument, if present. The taint pass reads it as a sink. */
    instructions: ts.Expression | undefined;
}
export interface ActorSite {
    id: string;
    order: number;
    name: string | undefined;
    /** `name` 缺席而首参是模板字符串时的静态形状；见 `actorNamePattern`。 */
    namePattern?: NamePattern;
    loc: ScriptLoc;
    /** The `agent(...)` call. */
    call: ts.CallExpression;
}
/**
 * A `report(...)` call site. A site that becomes **no node in either graph**: lowering
 * needs an id, the journal keys report nodes by site × ordinal for replay dedupe, and
 * the facade-siting rule needs something to point at — but a report emits progress, not
 * order, and nothing can wait for it, so there is nothing for an edge to mean. Its
 * argument is likewise **not a taint sink**.
 *
 * `report#N` is its own per-kind counter, so every existing `ask#N` / `actor#N` /
 * `world-read#N` id stays bit-for-bit unchanged — the invariant the site-id stability
 * rule actually protects. Report sites DO consume the global `order` discovery sequence,
 * which shifts serialization interleaving in text snapshots and nothing else: `order` is
 * a merge key for output, per-kind counters are journal keys.
 */
export interface ReportSite {
    id: string;
    order: number;
    loc: ScriptLoc;
    /** The `report(...)` call. */
    call: ts.CallExpression;
    /**
     * The reported item expression, if present. Read by the compile-side serializability
     * check (schema/synthesize.ts) — NOT by the taint pass.
     */
    item: ts.Expression | undefined;
    /**
     * The artifact tag (`report(item, "perf")`), set only when the second argument is a
     * string literal without holes. It routes the item to a preset artifact. Absent means
     * either "no tag" or "a tag the compiler could not read"; {@link artifactIdExpr} tells
     * those apart, and the artifacts pass rejects the second case.
     */
    artifactId?: string;
    /**
     * The tag argument, if present. Kept raw so the diagnostics pass can position a
     * rejection on the offending expression rather than on the call (same reason
     * {@link PhaseMarkerSite.nameExpr} is kept).
     */
    artifactIdExpr: ts.Expression | undefined;
}
/**
 * An `artifact.*(...)` call site: one publish (`file` / `markdown`) or one preset
 * declaration (`chart` / `table` / `metrics` / `board`).
 *
 * ⚠ 术语：这里的 artifact 是**用户面产物**（脚本发布给用户看的产出），不是同名的引擎内部
 * 概念（顶层返回值 / 站点的类型化输出值，见 `analysis/artifact-types.ts`）。
 *
 * Like {@link ReportSite} it is **sited but drawn in neither graph**: a publish is a
 * deliverable, not a step other steps can wait for, so there is nothing an edge could
 * mean; and its arguments are **not taint sinks** for the same reason `report`'s are not.
 * What it does need an id for is the journal (`artifact#N` × ordinal keys the replay
 * dedupe) and the facade-siting rule.
 *
 * `artifact#N` is its own per-kind counter, so every existing `ask#N` / `actor#N` /
 * `report#N` / `world-read#N` id stays bit-for-bit unchanged. It DOES consume the global
 * `order` discovery sequence, exactly as report sites do.
 */
export interface ArtifactSite {
    id: string;
    order: number;
    /** The registry op (`file`, `chart`, …), resolved by DECLARING CONTAINER, never by name. */
    op: ArtifactOp;
    loc: ScriptLoc;
    /** The `artifact.file(...)` / `artifact.chart(...)` call. */
    call: ts.CallExpression;
    /** The artifact id — set only when the first argument is a string literal without holes. */
    artifactId?: string;
    /**
     * The id argument, if present. Kept raw so the diagnostics pass can position a rejection
     * on the offending expression.
     */
    artifactIdExpr: ts.Expression | undefined;
}
/**
 * A `phase("…")` marker call. The one collected facade call that is **not a site**: no id,
 * no journal row — lowering rewrites it to `__host.enterPhase(name)`, which only makes the
 * engine emit a `phase-entered` event.
 * It is collected so the ordering walk can read the author's grouping, the diagnostics pass
 * can point at a malformed marker, and lowering can find the call by node identity.
 *
 * It therefore consumes **neither the global `order` sequence nor any per-kind counter**:
 * adding markers to a script must not move a single `ask#N` / `report#N` id, nor the
 * serialization interleaving. That is stronger than what `report` needed (which shifts
 * `order` only) and it costs nothing here, because a marker has no id to order.
 */
export interface PhaseMarkerSite {
    /** The phase name — set only when the argument is a string literal without holes. */
    name?: string;
    loc: ScriptLoc;
    /** The `phase(...)` call. */
    call: ts.CallExpression;
    /**
     * The name argument, if present. Kept raw so the diagnostics pass can position a
     * rejection on the offending expression rather than on the call.
     */
    nameExpr: ts.Expression | undefined;
}
export interface WorldReadSite {
    id: string;
    order: number;
    /**
     * Boundary A's op, resolved from the world-read registry by the DECLARING CONTAINER
     * (`files`×`glob` → `"glob"`), never from the bare member name. Not the member name:
     * `git.log` maps to `"git-log"`.
     */
    op: WorldReadOp;
    label: string;
    loc: ScriptLoc;
    /** The `files.glob(...)` / `files.read(...)` call. */
    call: ts.CallExpression;
    /**
     * The call's arguments in source order (`files.glob(p)` → `[p]`). Positional, and
     * plural because ops differ in arity (`files.grep(pattern, glob?)`, `git.status()`);
     * the taint pass treats every one as a sink.
     */
    args: readonly ts.Expression[];
}
export interface JoinSite {
    id: string;
    order: number;
    method: "all" | "allSettled";
    label: string;
    loc: ScriptLoc;
    /** The `Promise.all(...)` / `Promise.allSettled(...)` call. */
    call: ts.CallExpression;
    /** The single argument expression (the iterable); ports come from array literals. */
    arg: ts.Expression | undefined;
}
/**
 * A fan-out candidate — NOT a graph node yet. The taint pass promotes one to a
 * `fan-out` node iff its body reaches a facade site. Two shapes: a per-element callback
 * call per the callback registry (`xs.map(fn)`, `Array.from(xs, fn)`, … — the callback may
 * be an inline literal OR any expression holding a script function), or a `for...of`.
 */
export interface IterationCandidate {
    order: number;
    form: "array-method" | "for-of";
    loc: ScriptLoc;
    /** Registry label (`map`, `reduce`, `from`, …); undefined for `for...of`. */
    method?: string;
    /** The call (array-method form only) — the key both listeners look the candidate up by. */
    call?: ts.CallExpression;
    /** The registry entry that made this call a candidate (array-method form only). */
    semantics?: CallbackSemantics;
    /** The inline callback literal (array-method form, when the argument is one). */
    callback?: ts.FunctionExpression | ts.ArrowFunction;
    /**
     * The callback argument when it is NOT a literal (`xs.map(review)`, `xs.map(this.f)`):
     * the taint pass applies whatever script functions its value holds, per element.
     */
    callbackExpr?: ts.Expression;
    /** The body values flow through: the callback body or the `for...of` statement body.
     * For a non-literal callback this is the argument expression itself (no lexical body). */
    body: ts.Node;
    /** The element binding (array method: first callback parameter; `for...of`: the loop variable). */
    element: ts.BindingName | undefined;
    /** The iterated expression: the array-method receiver, or the `for...of` right-hand side. */
    iterated: ts.Expression;
}
/**
 * A `hole<T>(name, prompt?, body?)` call site: a typed gap the main agent fills with code
 * while the run waits at it (docs/dynamic-workflow/authoring.md「Holes」, docs/analysis.md
 * 「Sites」). Its id is the key of its NAME (`hole#<hash>`, hole-id.ts), the same at any
 * nesting depth, so every existing id stays unchanged when a fill inserts code; it consumes
 * the global `order` like every other site. A hole whose name is not a literal (9012) falls
 * back to a positional `hole#N`, which never reaches a run.
 *
 * 留白的函数体（`body`）在收集时以**全新的一套 per-kind 计数器**走查，体内铸出的 id 一律带
 * `<holeId>/` 前缀（见 {@link SiteCounters}）；体内的 `return` 不是顶层 return——它从留白
 * 返回。补全前后，体外的每个 id 逐字不变，这是活 run 能被补全的全部理由。
 */
export interface HoleSite {
    id: string;
    /** 包着这个留白的那个（已补全的）留白的 id；顶层留白没有。嵌套关系只记在这里，不在 id 里。 */
    fill?: string;
    order: number;
    /** 留白名（也是它的阶段名）——只在首参是无洞字面量时设置。 */
    name?: string;
    /** 名字实参原样保留：9012 的诊断按它定位。 */
    nameExpr: ts.Expression | undefined;
    /** 显式类型实参的源码文本（`hole<Plan>` 的 `Plan`）；缺席即 9012。 */
    typeText?: string;
    typeArg?: ts.TypeNode;
    /** 给主代理的提示（第二实参，非函数体时）；taint 趟把它当 sink。 */
    prompt?: ts.Expression;
    /** 已补全的留白的函数体（最后一个实参的内联函数字面量）；开放的留白没有。 */
    body?: ts.ArrowFunction | ts.FunctionExpression;
    loc: ScriptLoc;
    /** The `hole(...)` call. */
    call: ts.CallExpression;
    /** 调用是顶层 `return` 的（await 过的）操作数：脚本的结尾开着，run 的结果就是补全的返回值。 */
    tail: boolean;
}
/** A `return` in the top-level script body (not inside a nested function). */
export interface TopLevelReturn {
    loc: ScriptLoc;
    /** The returned expression, if any (`return;` has none). Read as the sink. */
    expression: ts.Expression | undefined;
}
export interface SiteTable {
    asks: AskSite[];
    actors: ActorSite[];
    worldReads: WorldReadSite[];
    /** `report(...)` sites — sited but drawn in neither graph (see {@link ReportSite}). */
    reports: ReportSite[];
    /** `artifact.*(...)` sites — sited but drawn in neither graph (see {@link ArtifactSite}). */
    artifacts: ArtifactSite[];
    /** `phase("…")` markers — collected but NOT sited (see {@link PhaseMarkerSite}). */
    phases: PhaseMarkerSite[];
    joins: JoinSite[];
    /** `hole<T>(...)` sites — open and filled, body sites included with prefixed ids (see {@link HoleSite}). */
    holes: HoleSite[];
    iterations: IterationCandidate[];
    topLevelReturns: TopLevelReturn[];
}
/** Collect the site table by walking the wrapped script's `__workflowScript__` body. */
export declare function collectSites(workflow: WorkflowProgram): SiteTable;
/**
 * The authored script body: the wrapper function's block. Exported for the causality
 * pass, which walks the same body in evaluation order. Read-only — it collects nothing
 * into the site table, so site ids stay bit-for-bit identical.
 */
export declare function findWorkflowBody(scriptFile: ts.SourceFile): ts.Block;
/** True iff the node introduces its own function scope (a body that runs only when called). */
export declare function isFunctionLike(node: ts.Node): boolean;
//# sourceMappingURL=sites.d.ts.map