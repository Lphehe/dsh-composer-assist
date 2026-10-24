import type { OrderEvent, PhaseInfo } from "./causality-order.js";
import { type OrderKind } from "./causality-reduce.js";
import type { CausalityGraph, Certainty } from "./causality-graph.js";
/** 认领关系：谁属于哪个阶段，以及该认领有多确定。全部按**站点 id** 键。 */
interface PhaseClaims {
    /** 站点 -> 认领它的阶段，按 issue 顺序去重。 */
    bySite: Map<string, string[]>;
    /** `${site}|${phase}` -> 该阶段内部的认领 certainty。 */
    certainty: Map<string, Certainty>;
    /** 阶段 -> 首个成员 issue 的时钟位置；商图事实的排序键。 */
    position: Map<string, number>;
    /** `${site}|${phase}` -> 该站点在该阶段的首次 / 末次 issue 位置（时间可行性判定）。 */
    firstIssue: Map<string, number>;
    lastIssue: Map<string, number>;
}
/** 商图的输入：归约后的 step 边（sink 边已剔除），certainty 已按端点继承过。 */
export interface PhaseSourceFact {
    from: string;
    to: string;
    kind: OrderKind;
    certainty: Certainty;
    /** carry 边改型前的底层 kind；carry 最小化按它判见证强度。 */
    carryOf?: Exclude<OrderKind, "carry">;
    /**
     * 见证这条事实的 issue 事件所在的阶段集（只有 await 屏障产生的 seq 事实带它；见
     * causality-graph.ts 的 `Fact.toPhases`）。头端收窄按 {@link headPhasesOf}。
     */
    toPhases?: ReadonlySet<string>;
}
/**
 * 从 issue 事件读出认领关系。issue 是 step 的身份时刻，所以这一趟就是全部的归属逻辑。
 *
 * 每个 (站点, 阶段) 的 certainty 单独推导：该阶段内**存在**一次区域链确定的 issue，且该
 * step 不是 control 边的目标。逐字对应 causality-graph.ts 的 `certaintyOf`，只是把「所有
 * issue」换成「该阶段的 issue」——共享 helper 在 preflight（顶层）与 gate（循环+分支内）
 * 各一份拷贝时，两份的 certainty 因此可以不同，这正是拷贝要单独推导的理由。
 */
export declare function collectPhaseClaims(events: readonly OrderEvent[], steps: ReadonlySet<string>, certainChain: (chain: readonly string[]) => boolean, controlled: ReadonlySet<string>): PhaseClaims;
/**
 * 把阶段词汇表加到完成的因果图上：拷贝、`Step.phase`、阶段表、阶段边。
 *
 * 在 `expandMaySetLanes` **之后**运行（对车道拷贝逐份认领），且与它同为「对成品图的机械
 * 改写」：步骤集、车道、region、step 边的既有内容都不重算。
 */
export declare function projectPhaseGraph(graph: CausalityGraph, phases: readonly PhaseInfo[], claims: PhaseClaims, facts: readonly PhaseSourceFact[], sharesIteration: (a: string, b: string) => boolean): CausalityGraph;
export {};
//# sourceMappingURL=phase-graph.d.ts.map