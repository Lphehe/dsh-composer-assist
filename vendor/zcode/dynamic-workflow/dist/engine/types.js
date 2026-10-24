/**
 * 执行引擎的边界类型（boundary types）。
 *
 * 这个模块是纯类型 + 结构化错误 + 常量的词汇表，三条边界都以它为契约：
 * - Boundary A（host API）：沙箱脚本的 facade shim 调用 {@link WorkflowHostApi}。
 * - Boundary B（driver port）：引擎核心（确定性状态机）向下驱动 {@link WorkflowDriver}，
 *   driver 通过 {@link WorkflowReportSink} 向上回报进度。
 * - Journal：{@link JournalStorePort} 以仓储式方法暴露 run/actor/node/event 记录，
 *   内存实现与未来 SQLite 实现都能自然落位（同步方法契合 node:sqlite 的 DatabaseSync，且让核心保持确定性）。
 */
/** 把 InstanceRef / ActorRef 渲染为稳定字符串 `site@ordinal`，用于日志与句柄。 */
export function refToString(ref) {
    return `${ref.siteId}@${ref.ordinal}`;
}
export { WorkflowError } from "./errors.js";
/** `WorldReadInput` 序列化后的字节上限（4 KB）。 */
export const WORLD_READ_INPUT_MAX_BYTES = 4096;
// driver 对 ask 的观察词汇表（用量 + 进度）住在 ask-observation-types.ts（同上），此处转出口以保持引用路径。
export { INSTRUCTIONS_HEAD_MAX_CHARS, LAST_TOOL_NAME_MAX_CHARS, LAST_TOOL_TARGET_MAX_CHARS, } from "./ask-observation-types.js";
// ————————————————————————————————————————————————————————————————
// 策略常量（此契约的一部分）
// ————————————————————————————————————————————————————————————————
/** 节点内 repair（拒绝重试）次数上限：3 次。 */
export const REPAIR_ATTEMPTS = 3;
/** turn 结束未提交时的 nudge 次数上限：1 次。 */
export const NUDGE_ATTEMPTS = 1;
