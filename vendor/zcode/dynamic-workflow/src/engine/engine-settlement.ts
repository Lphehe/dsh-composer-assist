/**
 * engine.ts 顶到 oxlint max-lines 上限（400 行），把 run 的三条终态路径
 * （completed / stopped / errored）与它们共用的 finishRun
 * 拆到本文件；公开面仍从 engine.ts 导出。
 *
 * 自由函数经 {@link EngineState} 接缝读写引擎状态；WorkflowEngine 的 complete / stop /
 * failRun 只是薄委托。first-wins 由 `isRunSettled()` 守在每条路径的第一行。
 */

import type { EngineState } from "./engine-state.js";
import type { RunSettlementRecord, RunStatus, RunStopReason } from "./types.js";
import { WorkflowError } from "./types.js";

/**
 * 沙箱脚本成功返回顶层 artifact，结算为 completed。
 *
 * 脚本返回时仍可能有在飞 ask（`Promise.race` 的输家、没有 `await` 的 ask）。它们与 cancel
 * 路径同款中止：driver 侧 cancelAsk、deferred 以 Cancelled reject、补发 node-settled(cancelled)。
 * 不中止的后果是三重的：scheduler 的 liveNodes 永远握着节点、driver 侧 turn 继续烧 token、
 * 事件日志里一个 node-dispatched 永远等不到它的 node-settled。
 */
export function settleCompleted(state: EngineState, artifact: unknown): void {
  if (state.isRunSettled()) return;
  state.markSettled();
  state.abortInFlight(
    new WorkflowError("Cancelled", "Run completed; in-flight subagent tasks were abandoned."),
    true,
  );
  // 产物随终态一笔落库。分两笔写会造出「completed 但产物丢失」的崩溃窗口，而 journal
  // 行是产物唯一的持久化家（`run-settled` 事件刻意不加宽）。
  finishRun(state, "completed", { result: artifact });
  state.resolveSettled({ status: "completed", artifact });
}

/**
 * 外部停止：中止在飞 ask（deferred 以 Cancelled reject、补发 node-settled(cancelled)），run
 * 结算 `stopped(reason)`；已完结的 journal 条目保留（可 resume）。四个 reason 走同一条路：
 * `user` / `model`（cancel 入口传进来的 initiator）、`interrupted`（harness 的沙箱故障）、
 * `provider`（driver 经 `stopRun` 报上来的确定性模型侧错误）。`error` 只对后两者在场。
 */
export function settleStopped(
  state: EngineState,
  reason: RunStopReason,
  error?: WorkflowError,
  supersededBy?: string,
): void {
  if (state.isRunSettled()) return;
  state.markSettled();
  state.abortInFlight(new WorkflowError("Cancelled", "Run stopped."), true);
  // `superseded` 的后继 id 与原因**同一笔**落库：
  // stopped 信封整体重写，分两笔写就有一个「已 superseded 却不知道被谁替代」的窗口。
  finishRun(state, "stopped", {
    stopReason: reason,
    ...(supersededBy === undefined ? {} : { supersededBy }),
    ...(error === undefined ? {} : { failure: error.toJSON() }),
  });
  state.resolveSettled({
    status: "stopped",
    reason,
    ...(supersededBy === undefined ? {} : { supersededBy }),
    ...(error === undefined ? {} : { error }),
  });
}

/** run 级失败（脚本之错）：中止在飞 ask（以 run 错误 reject），run 结算 errored。 */
export function settleFailed(state: EngineState, error: WorkflowError): void {
  if (state.isRunSettled()) return;
  state.markSettled(error);
  state.abortInFlight(error, false);
  finishRun(state, "errored", { failure: error.toJSON() });
  state.resolveSettled({ status: "errored", error });
}

/**
 * `run-settled` 事件只带 {status, stopReason?, error?}：产物不上高频进度管线，只落 journal。
 *
 * 三条终态路径都经这里，所以 driver 的 dispose 恰好一次、first-wins 自然成立。放在
 * `run-settled` **之后**：dispose 是结算之后的资源释放（actor runtime 的关闭链），不是结算
 * 的一部分，事件日志不因它多一条。
 */
function finishRun(state: EngineState, status: RunStatus, settlement?: RunSettlementRecord): void {
  state.journal.updateRunStatus(state.runId, status, settlement);
  state.record({
    type: "run-settled",
    status,
    ...(settlement?.stopReason === undefined ? {} : { stopReason: settlement.stopReason }),
    ...(settlement?.supersededBy === undefined ? {} : { supersededBy: settlement.supersededBy }),
    ...(settlement?.failure === undefined ? {} : { error: settlement.failure }),
  });
  state.driver.dispose?.();
}
