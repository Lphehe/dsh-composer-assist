import type { CompileDiagnostic, WorkflowProgram } from "../compiler/compile.js";
import { type SiteTable } from "../analysis/sites.js";
import type { AskSpec } from "../engine/types.js";
import type { JsonSchema } from "./types.js";
/**
 * Schema 合成（编译侧）：为每个「有类型」的 ask 站点，用 checker 的结构化视图把结果
 * 类型 T 发射成纯 JSON Schema，按站点 id（如 `ask#1`）归档。
 *
 * 「有类型」判定：ask 显式带类型实参 `x.ask<T>(...)` 且 T 解析后不是原始 `string`。
 * `ask()` 与 `ask<string>()` 都是「无类型」ask（结果即最终文本，不发射 schema）。
 * 不可序列化的 T 以定位到 ask 站点的诊断拒绝（复用分析管线的 CompileDiagnostic 形状）。
 *
 * 同一趟里还检查 `report(item)` 的实参可序列化性——同一个发射器、同一条诊断通道，
 * 理由见 {@link reportItemDiagnostics}。report 站点**不产出 schema**，只贡献诊断。
 */
export interface SchemaSynthesisResult {
    /** 每个有类型 ask 站点的 JSON Schema，按站点 id 归档。 */
    schemas: Record<string, JsonSchema>;
    /** 拒绝性诊断，定位在对应 ask 站点。 */
    diagnostics: CompileDiagnostic[];
}
/**
 * 核心入口：在构建站点表的同一 checker 上，为每个有类型 ask 发射 schema。与
 * docs 中 `synthesizeAskSchemas(program, siteTable)` 对应，这里取 {@link WorkflowProgram}
 * 以便拿到 `toScriptLoc` 做定位诊断。
 */
export declare function synthesizeAskSchemas(workflow: WorkflowProgram, table: SiteTable): SchemaSynthesisResult;
/**
 * 便捷入口：从脚本文本一站式合成（typecheck → 站点表 → 合成）。给包内/引擎侧一个不必
 * 自己拼装 program+table 的调用点；analyzeWorkflowScript 归 analysis 域所有，这里不触碰。
 * 若脚本本身 typecheck 不通过，返回其编译诊断且不合成。
 */
export declare function synthesizeWorkflowSchemas(scriptText: string): SchemaSynthesisResult;
/**
 * 把站点表与合成出的 schemas 组装成引擎的 `askSpecs`。
 *
 * **为什么按 `table.asks` 遍历而不是按 `schemas` 的键**：schemas 只为 typed 站点发射
 * （untyped ask 的结果就是末轮文本，不发射 schema），而引擎要求 askSpecs 覆盖**每一个**
 * ask 站点——站点缺席被当作接线错误硬失败（`MissingAskSpec`），因为站点表与 schema 合成
 * 出自同一次编译，缺席只可能是两份产物被拼在了一起。所以 untyped 站点必须显式记为
 * `{ typed: false }`，而不是靠"查不到就当 untyped"的兜底：那条兜底会把 typed ask 静默
 * 降级——不注册 submit_result、拿末轮文本当结果、schema 校验整个消失。
 *
 * 这个构造是正确性关键且只有一种写法，因此收在这里一处：调用方（run service、测试装配）
 * 一律用它，不要各自实现。站点表是身份的唯一真源——schemas 里对不上任何站点的键被忽略。
 */
export declare function buildAskSpecs(table: SiteTable, schemas: Record<string, JsonSchema>): Map<string, AskSpec>;
//# sourceMappingURL=synthesize.d.ts.map