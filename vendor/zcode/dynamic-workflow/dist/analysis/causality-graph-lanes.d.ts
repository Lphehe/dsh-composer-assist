import { type CausalityGraph, type Certainty, type Fact } from "./causality-graph-types.js";
/**
 * The LAST pass: rewrite a may-set step into one copy per candidate lane.
 *
 * `(cond ? a : b).ask(p)` is the same program as `cond ? a.ask(p) : b.ask(p)`, and the
 * analyzer already draws the second form as one `maybe` step per lane. Drawing the first
 * form as a single card made the picture depend on where the ternary sits, and on a
 * script whose every ask is a may-set it left candidate lanes with no homed step at all —
 * which the mermaid emitter culls, erasing an actor from the workflow.
 *
 * This runs AFTER ordering and reduction by contract: reduction never sees copies, so
 * every reduction rule and its corpus behaviour are unchanged and this stays a mechanical
 * rewrite of the finished graph.
 */
export declare function expandMaySetLanes(graph: CausalityGraph): CausalityGraph;
/** Collapse facts to one edge per ordered pair, keeping the strongest claim. */
export declare function dedupeFacts(facts: readonly Fact[]): Fact[];
export declare function weakest(values: readonly Certainty[]): Certainty;
/**
 * 写下这个站点的那次补全：站点 id 的 `hole#<hash>/` 前缀（只有一层，hole-id.ts）；体外的站点
 * 没有。留白自己的 id 不带前缀——它属于哪个留白记在站点表的 `fill` 上，调用方自己查
 * （docs/analysis.md「Sites」）。
 */
export declare function fillOf(siteId: string): string | undefined;
//# sourceMappingURL=causality-graph-lanes.d.ts.map