import type { AnalysisCore } from "./core.js";
import type { CausalityGraph } from "./causality-graph.js";
import type { SiteGraph } from "./types.js";
/**
 * 交接图：板面第二层的主体。每个阶段
 * 的**参与者**是一张卡——该阶段里有 step 的每条车道一张（子代理、工作区、未解析），fan-out
 * 家族在基数已知时按成员出卡；卡之间的**交接**边是因果图（已按类型归约）的阶段内边按卡取商、
 * 去自环、再做无类型贪心不可约归约的结果。与其他每一种箭头同义：runs after。
 *
 * 一个 PURE 投影：只读 core（fan-out 基数与 actor 的 `within` 链）、因果图（step 的车道、
 * 阶段、边的 kind）与站点图（`data` 边的产物类型，检视器素材）。不 import `typescript`。
 */
export interface HandoffParticipant {
    /** `${phase}:${lane}`，家族成员 `${phase}:${lane}[${index}]`。 */
    id: string;
    /** 阶段 id；脚本无阶段词汇时恒为 `unphased`。 */
    phase: string;
    /** 车道 id：actor 站点 id、`workspace` 或 `unknown`。 */
    lane: string;
    /** 该阶段内落在这条车道上的 step id，源码序，至少一个。 */
    steps: string[];
    /** 字面量基数展开出的成员。 */
    member?: {
        index: number;
        of: number;
    };
    /** 基数未知（或超过展开上限）的家族：一张卡代表全部成员。 */
    many?: true;
}
export interface Handoff {
    from: string;
    to: string;
    /** 全部贡献边都是循环回边（carry）。 */
    back?: true;
    /** 阶段内 from 卡的站点 → to 卡的站点的 `data` 边产物类型，按贡献序去重。 */
    types?: string[];
}
export interface HandoffGraph {
    participants: HandoffParticipant[];
    handoffs: Handoff[];
}
/** 无阶段词汇时的唯一阶段 id；与因果图的兜底阶段同名。 */
export declare const UNPHASED = "unphased";
/** 家族按成员出卡的上限：多重性超过它按 `many` 处理。 */
export declare const FANOUT_EXPAND_CAP = 8;
/** Project the hand-off graph off the core, the causality graph and the site graph. */
export declare function projectHandoffGraph(core: AnalysisCore, causality: CausalityGraph, sites: SiteGraph): HandoffGraph;
//# sourceMappingURL=handoff-graph.d.ts.map