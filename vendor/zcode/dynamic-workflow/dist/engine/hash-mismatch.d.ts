/**
 * replay 命中但 inputHash 不一致时的 run 级错误。ask、世界读取、报告、产物四条 replay 路径共用它。
 *
 * 原本住在 scheduler.ts；dwf-report-limit 与 dwf-model-selection 合并后 scheduler.ts 到了 402 行
 * （oxlint max-lines 上限 400），而这个构造器本就不属于 ask 调度，于是拆出来。
 */
import { WorkflowError, type InstanceRef } from "./types.js";
/** replay 命中但 inputHash 不一致——纯度契约被破坏，run 大声失败。 */
export declare function hashMismatch(instance: InstanceRef, expected: string, got: string): WorkflowError;
//# sourceMappingURL=hash-mismatch.d.ts.map