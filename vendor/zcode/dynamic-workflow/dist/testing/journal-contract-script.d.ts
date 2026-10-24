/**
 * `updateRunScript` 的契约用例（docs/execution-engine.md「Holes」→「The engine's part」）：它是
 * `script_text` / `script_hash` 两列在 `createRun` 之后的**第二个写入者**——一次补全把有效脚本
 * 写回 run 行，resume 拿行里的哈希对行里的文本，所以两列必须同一笔写；行上其余一切（状态、
 * 用量、上界、结算袋、元数据）不在这条写入的范围里，与 `updateRunUsage` 同族。
 *
 * 独立成模块而不是追加到 journal-contract-runs.ts：那个文件已顶到 oxlint max-lines 上限。
 * 这里只登记 `it(...)`，不另开 describe——套件的分组与用例顺序由 journal-contract.ts 决定。
 */
import type { JournalStorePort } from "../engine/index.js";
export declare function registerScriptCases(factory: () => JournalStorePort): void;
//# sourceMappingURL=journal-contract-script.d.ts.map