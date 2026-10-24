/**
 * 修复原因：journal-contract.ts 顶到 oxlint max-lines 上限（400 行），把actor 记录与节点记录（ask / world / report 行、缺席键、messageBoundary 回填）的用例拆到本文件；
 * 公开面仍从 journal-contract.ts 导出（`runJournalStoreContract` 按原顺序调用各主题的注册函数）。
 *
 * 注意：这里只登记 `it(...)`，不另开 describe——套件的分组与用例顺序必须与拆分前逐字相同。
 */
import type { JournalStorePort } from "../engine/index.js";
export declare function registerNodeCases(factory: () => JournalStorePort): void;
//# sourceMappingURL=journal-contract-nodes.d.ts.map