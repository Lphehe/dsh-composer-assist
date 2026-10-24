// ============================================================
// run 终态的结构化明细
// ============================================================
// 从 types.ts 拆出（那份文件抵 400 行 lint 门）：`ProviderStop` 错误码的明细与 run 级停滞观察
// 事件的载荷。词汇（RunStatus / RunStopReason / WorkflowErrorCode）仍在 types.ts，这里只有
// 「明细」——它们不参与联合类型，拆走不影响穷举消费者。

/**
 * `ProviderStop` 的结构化明细：通知与
 * GetWorkflowRun 据此选文案，绝不从 message 反向解析。`reason` 是 contracts 的
 * `ModelFailureReason` 值（`auth_failed` / `invalid_request` / `rate_limited` …），纯包不 import
 * contracts 故为 string；`kind` 是策略表的判定键（认证 / 未配置 / 模型不可用 / 请求无效 /
 * 配额 / 兜底），读文案表时用它而不是 reason。
 */
export interface ProviderStopDetails {
  kind: "auth" | "not_configured" | "model_unavailable" | "invalid_request" | "quota" | "other";
  reason: string;
  providerId?: string;
  providerLabel?: string;
  modelId?: string;
  providerCode?: string;
  /** 触发停止的子代理（`refToString(instance)`）与它的名字 / 出生阶段（有则带）。 */
  subagent?: string;
  subagentName?: string;
  phase?: string;
  /** provider 的原文，逐字（有界，由 driver 截断）。 */
  rawMessage?: string;
  /** 配额类：provider 给出的重置时刻（epoch ms），能解析出来才在场。 */
  resetAt?: number;
}

/**
 * run 级停滞：driver 观察到本 run 连续
 * `sinceMs` 毫秒没有任何一次成功的模型请求、期间至少排定过一次重试。纯观察事件，引擎只
 * `record()`；core 据它发一条 run 中通知。`reason` 是期间占多数的重试原因（`ModelRetryReason`
 * 值，开放字符串），`cap` 是此刻该 provider 桶的 cap。
 */
export interface RunStallInfo {
  sinceMs: number;
  reason?: string;
  cap?: number;
}
