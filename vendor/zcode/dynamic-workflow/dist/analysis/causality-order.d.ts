import type { WorkflowProgram } from "../compiler/compile.js";
import type { SiteTable } from "./sites.js";
import type { OrderOracle, OrderTrace } from "./causality-order-types.js";
export { UNPHASED_ID, type JumpKind, type StructuralRegionKind, type TraceRegionKind, } from "./constants.js";
export type { ActorEvent, ControlFact, IssueEvent, JumpEvent, MarkEvent, OrderEvent, OrderRegion, OrderTrace, PhaseInfo, SettleEvent, } from "./causality-order-types.js";
/**
 * The ordering trace: one evaluation-order walk over the authored script body that
 * records WHEN each step is issued, WHERE each `await` barrier sits, and which
 * syntactic region encloses each event. It is the only new machinery the causality
 * graph needs.
 *
 * This module reads the site table, the AST, and the taint pass's ORACLE facts. It
 * collects nothing into the site table and the oracle is keyed by source position, so
 * every site id stays bit-for-bit identical.
 *
 * Await resolution has two halves:
 *
 *  - **syntactic** — the steps ISSUED WHILE EVALUATING the awaited expression settle
 *    certainly. That one rule covers `await x.ask(…)`, `await Promise.all(xs.map(…))`
 *    and `await helper()` uniformly, and it is all of phase 1.
 *  - **the oracle** — the step labels the awaited VALUE carries, which is what resolves a
 *    promise stored in a variable, passed into a helper, or joined. Split into certain and
 *    may-claims by the settle-certainty rule; see `claimAt` (causality-order-settle.ts).
 *
 * The barrier covers the union, and widens over everything in flight only when BOTH halves
 * are empty (`await 5`, an unknown call's promise). Widening over-orders, which understates
 * parallelism — the honest direction. UNDER-ordering is the one thing this walk must never
 * do, and phase 1 did: on `await Promise.all([stored, fresh])` the syntactic half found
 * `fresh`, so the barrier never widened and `stored` was left unsettled, inventing
 * concurrency the script does not have (order-mixed-join-stored-promise).
 *
 * Function bodies run only when called, so the walk never descends into a
 * function-like node on its own; it inlines the body at each call site instead. WHICH
 * bodies a call invokes is not guessed from syntax: the walk reads the CALL ORACLE
 * (`OrderOracle.applications`) — the functions
 * the converged taint interpreter applied at that node, as callee (direct, through a
 * parameter, a field, a class member) or as an argument a library may invoke (a registry
 * `each` / `once` entry, or the keystone default). A helper called twice therefore
 * contributes two issue events for the same step id (phase 1 has one step per site;
 * per-call-site specialization is phase 3). Recursion is precomputed as call-graph
 * self-reachability over the same oracle: a recursive function's inlined body gets a
 * `loop` region and re-entry is cut, which is what turns recursion into the same
 * self-arrow any other sequential repetition gets. The end-of-walk sweep is left with
 * bodies no call ever applies — genuine dead code.
 *
 * The trace is also a STRUCTURED CONTROL TREE read in pre-order: besides the ordering regions above it
 * records the structural ones — `choice` grouping the arms of one if / ternary / switch /
 * short-circuit, `call` for each inlined body, `try` / `attempt` / `catch` / `finally` —
 * and two extra leaves, `mark` (a phase marker evaluated) and `jump` (an unstructured
 * transfer with its target region already resolved). The causality projection looks
 * through all of it; the control-flow projection is built from it.
 *
 * 拆分：本文件顶到 oxlint max-lines 上限（400 行），走查按职责拆成兄弟模块——
 * causality-order-types（产物类型）、-state（显式共享状态 + 原语）、-settle（await 屏障与
 * 神谕读取）、-walk（节点访问器）、-loops（循环）、-calls（调用与内联）、-functions（函数
 * 解析）。这里只剩编排：建状态、走根语句表、收尾扫尾。公开面一个不改。
 */
/** Walk the authored body in evaluation order and record the ordering trace. */
export declare function traceOrder(workflow: WorkflowProgram, table: SiteTable, oracle: OrderOracle): OrderTrace;
//# sourceMappingURL=causality-order.d.ts.map