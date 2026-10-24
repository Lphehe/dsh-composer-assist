/**
 * 修复原因：journal-contract.ts 顶到 oxlint max-lines 上限（400 行），把用户面产物行（kind: "artifact"、artifactId 列、report 标签）的用例拆到本文件；
 * 公开面仍从 journal-contract.ts 导出（`runJournalStoreContract` 按原顺序调用各主题的注册函数）。
 *
 * 注意：这里只登记 `it(...)`，不另开 describe——套件的分组与用例顺序必须与拆分前逐字相同。
 */
import type { JournalStorePort } from "../engine/index.js";
export declare function registerArtifactCases(factory: () => JournalStorePort): void;
//# sourceMappingURL=journal-contract-artifacts.d.ts.map