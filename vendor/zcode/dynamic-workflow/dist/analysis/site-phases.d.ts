import type { AnalysisCore } from "./core.js";
import type { ControlFlowGraph } from "./flow-graph.js";
/**
 * 站点 → 出生阶段**名**的编译期表（docs/analysis.md「Phases」；引擎侧见 execution-engine.md
 * 「Identity: sites, ordinals, phases」）。
 *
 * 引擎给实例打的出生阶段戳原本只看「脚本最近经过的标记」——单线叙事下没错，但两个 future
 * 各自以自己的标记开头并发跑起来后，一个生产者在首次 await 之后发出的第二个 ask，会被戳成
 * 最后一个跑过的标记，也就是消费者那一段。所以戳改成**词法优先**：分析器的时序 walk 早就按
 * 内联语义（helper 内联到调用点、回调放在注册处、future 体放在调用处）给每个 issue 记了当时的
 * 阶段；一个站点的所有 issue（actor 站点则是所有 spawn）都落在**同一个有名阶段**时，那就是它
 * 的出生阶段，与确认窗画给用户的图一致。落在两个阶段（被两处调用的 helper）或只落在 unphased
 * 的站点不进表，引擎对它退回动态当前阶段。
 *
 * 以 trace 而不是投影图为源：投影会给跨阶段的步做 phase copy，而这里要的恰是「是否唯一」。
 * 名字（不是 phase id）进表，因为引擎的戳与 `phase-entered` 事件都用作者的原词。
 */
/**
 * run 的声明阶段表（execution-engine.md「run-launched」的 `phaseNames` / `holes`）：控制流投影
 * 阶段表里**有名**的阶段按序取名——留白按名字站在它的位置上——外加与之对齐的下标表 `holes`，
 * 指出其中哪些是**开放的留白**，侧栏迷你轨道据此把那些站画成虚线。无阶段词汇表时两张表都是
 * 空数组（提交方据此让字段整个缺席）。
 *
 * 与 `createWorkflowPhaseNames`（contracts）同一份来源（控制流投影的阶段表，含只有标记的阶段），
 * 所以补全后重算的表与 launch 时的表按同一条规则对齐。
 */
export declare function collectPhaseNames(flow: Pick<ControlFlowGraph, "phases" | "holes"> | undefined): {
    phaseNames: string[];
    holes: number[];
};
export declare function collectSitePhases(core: AnalysisCore): ReadonlyMap<string, string>;
//# sourceMappingURL=site-phases.d.ts.map