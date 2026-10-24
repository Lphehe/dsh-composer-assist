/**
 * engine.ts 顶到 oxlint max-lines 上限（400 行），把 world 节点（world-read / world-run）
 * 的准入-结算路径与 amend-resume 导入缓存的关门 / 恢复接缝拆到本文件；公开面仍从 engine.ts 导出。
 *
 * 自由函数经 {@link EngineState} 接缝读写引擎状态；WorkflowEngine.worldRead 只是薄委托，
 * 关门由调度器经 SchedulerHost 触发，恢复在引擎构造函数的 resume 分支里调用。
 */
import type { EngineState } from "./engine-state.js";
import type { InstanceRef, JournalStorePort, WorldReadOp } from "./types.js";
export declare function readWorld(state: EngineState, siteId: string, op: WorldReadOp, args: unknown[]): Promise<unknown>;
/**
 * 关闭导入缓存（幂等）。两个触发点，都是**第一笔写入之前**：
 * driver 上报某个 live 子代理即将执行改写工具（`mutating-tool`），或一条 `world.run` 要 live 执行
 * （`world-run`）。只在本次真是修订 run 时发 `import-cache-closed` 事件——它是 resume 时恢复
 * 「门已关」的唯一事实来源；非修订 run 没有表可关，标志位无害但不发事件。
 */
export declare function closeImportCache(state: EngineState, instance: InstanceRef, cause: "mutating-tool" | "world-run", actorName?: string): void;
/**
 * resume 时恢复关门判定、「曾 live 的 ask 实例」集合，以及「关门之前就已准入的 ask 实例」集合。
 *
 * 事实来源是本 run 自己的事件：live 节点在准入时发 `node-queued`（ask 的带 actor ref），缓存
 * 命中只发 `node-settled cached:true`，所以「哪些 ask 曾 live」是精确集合。门是否已关则由
 * `import-cache-closed` 事件决定——ask 转 live 不再意味着关门（它可能一个文件都没碰），只有
 * 写入才关，而写入这件事只有这条事件记着。零 schema 变更。
 *
 * `queuedBeforeClose` 同样零 schema 变更，靠的是**事件次序**：续跑在飞 ask 的判定与该 ask 的
 * `node-queued` 落在准入的同一个同步片里（见 scheduler 的 admitAsk → tryImportedSettle →
 * admitLive），所以「准入那一刻门开着」⇔「这条 node-queued 早于第一条 import-cache-closed」。
 * 没有关门事件时全体都算在内。
 */
export declare function recoverImportClosure(journal: JournalStorePort, runId: string): {
    live: ReadonlySet<string>;
    queuedBeforeClose: ReadonlySet<string>;
    closed: boolean;
};
//# sourceMappingURL=engine-world.d.ts.map