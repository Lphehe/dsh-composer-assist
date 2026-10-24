/**
 * 读面选项的契约用例（docs/execution-engine.md「Reading the journal」）：kinds / withResult /
 * limit / maxResultBytes / countNodes / sumResultBytes / types / reportItems / 按名取子代理。两个实现（内存、SQLite）必须逐字同
 * 语义——读者按这些选项把过滤下推到存储层，任何一侧偷偷退回「读全表」或给出不同的顺序，
 * 冷回放与 GetWorkflowRun 就会在两种部署上归约出不同的状态。
 *
 * 注意：这里只登记 `it(...)`，不另开 describe（与兄弟模块同规）。
 */
import type { JournalStorePort } from "../engine/index.js";
export declare function registerReadCases(factory: () => JournalStorePort): void;
//# sourceMappingURL=journal-contract-reads.d.ts.map