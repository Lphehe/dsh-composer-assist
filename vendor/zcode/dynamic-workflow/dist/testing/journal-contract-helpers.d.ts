/**
 * 修复原因：journal-contract.ts 顶到 oxlint max-lines 上限（400 行），把各主题模块共用的
 * 夹具（CAPS / baseRun / logs）拆到本文件；公开面仍从 journal-contract.ts 导出。
 */
import type { RunRecord, StoredEvent } from "../engine/index.js";
export declare function baseRun(runId: string): RunRecord;
/** 取出一页 log 事件的正文，用于逐页比对（事件种类无关的分页断言用它读得更直白）。 */
export declare function logs(events: StoredEvent[]): string[];
//# sourceMappingURL=journal-contract-helpers.d.ts.map