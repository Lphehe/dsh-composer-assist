/**
 * resume 分支从 journal 恢复的 run 级状态（docs/execution-engine.md「Resume by replay」与
 * 「Reading the journal」）：结算次序闸、每个 actor 的已记录 ask 数、报告计数、产物状态。
 *
 * 拆出原因：engine.ts 顶到 oxlint max-lines 上限（400 行）。
 *
 * 节点行只读一次、只读要的列：工作行不带结果（次序闸与 ask 计数只看 kind / status / 坐标），
 * 产物行带结果（成员族与版本记录在 `result` 上，且有界），报告行只数条数与字节、不读——一个
 * run 可以有 65,536 条、1 GiB 的 item，恢复它们的计数不需要把任何一条读进内存。
 */
import type { EngineState, ReportTally } from "./engine-state.js";
import { type ReplaySettleOrder } from "./replay-order.js";
import type { AskScheduler } from "./scheduler.js";
export declare function restoreFromJournal(state: EngineState, scheduler: AskScheduler): {
    replaySettleOrder: ReplaySettleOrder;
    reportTally: ReportTally;
};
//# sourceMappingURL=engine-resume.d.ts.map