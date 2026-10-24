/**
 * engine.ts 顶到 oxlint max-lines 上限（400 行），把 run 的三条终态路径
 * （completed / stopped / errored）与它们共用的 finishRun
 * 拆到本文件；公开面仍从 engine.ts 导出。
 *
 * 自由函数经 {@link EngineState} 接缝读写引擎状态；WorkflowEngine 的 complete / stop /
 * failRun 只是薄委托。first-wins 由 `isRunSettled()` 守在每条路径的第一行。
 */
import type { EngineState } from "./engine-state.js";
import type { RunStopReason } from "./types.js";
import { WorkflowError } from "./types.js";
/**
 * 沙箱脚本成功返回顶层 artifact，结算为 completed。
 *
 * 脚本返回时仍可能有在飞 ask（`Promise.race` 的输家、没有 `await` 的 ask）。它们与 cancel
 * 路径同款中止：driver 侧 cancelAsk、deferred 以 Cancelled reject、补发 node-settled(cancelled)。
 * 不中止的后果是三重的：scheduler 的 liveNodes 永远握着节点、driver 侧 turn 继续烧 token、
 * 事件日志里一个 node-dispatched 永远等不到它的 node-settled。
 */
export declare function settleCompleted(state: EngineState, artifact: unknown): void;
/**
 * 外部停止：中止在飞 ask（deferred 以 Cancelled reject、补发 node-settled(cancelled)），run
 * 结算 `stopped(reason)`；已完结的 journal 条目保留（可 resume）。四个 reason 走同一条路：
 * `user` / `model`（cancel 入口传进来的 initiator）、`interrupted`（harness 的沙箱故障）、
 * `provider`（driver 经 `stopRun` 报上来的确定性模型侧错误）。`error` 只对后两者在场。
 */
export declare function settleStopped(state: EngineState, reason: RunStopReason, error?: WorkflowError, supersededBy?: string): void;
/** run 级失败（脚本之错）：中止在飞 ask（以 run 错误 reject），run 结算 errored。 */
export declare function settleFailed(state: EngineState, error: WorkflowError): void;
//# sourceMappingURL=engine-settlement.d.ts.map