import ts from "typescript";
import type { CompileDiagnostic, WorkflowProgram } from "../compiler/compile.js";
import { collectSites, type SiteTable } from "../analysis/sites.js";
import { createWorkflowProgram, collectDiagnostics } from "../compiler/compile.js";
// AskSpec 是引擎的入参词汇表，这里只 import type（编译期抹除，无运行时边）。engine 侧
// 同样只以 type 形式引 schema 的 Violation——两个方向都是纯类型，不存在导入环。
import type { AskSpec } from "../engine/types.js";
import { SchemaEmitter, SchemaRejection } from "./emit.js";
import { harvestConstraints, mergeConstraints } from "./jsdoc.js";
import type { JsonSchema } from "./types.js";
import { SCHEMA_DIAGNOSTIC_CODE } from "./types.js";

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
 * ask 站点的结果类型 T，若为「无类型」ask 则返回 undefined。这是 typed-ask 判定的
 * 唯一真源：站点表（analysis/sites.ts）只保留 `call: ts.CallExpression`，不带 typed 标记，
 * 故在此从 checker 解析。无类型 = T 解析为原始 `string`（`ask()` 的默认实参与显式
 * `ask<string>()` 都属此列；`type A = string; ask<A>()` 也会被 checker 解析为原始 string）。
 *
 * 保持模块内私有：下游（lowering/引擎/驱动）不需要独立谓词——一次成功启动的 run 必然零
 * 诊断，故 `siteId in schemas` 就是 typed-ask 的判定式。但**不要**据此就用 schemas 的键去
 * 构造引擎的 askSpecs：那样 untyped 站点会整个缺席，而引擎把缺席当接线错误硬失败。
 * 构造 askSpecs 一律走 {@link buildAskSpecs}（按站点表遍历）。
 */
function askResultType(checker: ts.TypeChecker, call: ts.CallExpression): ts.Type | undefined {
  const typeNode = call.typeArguments?.[0];
  if (typeNode === undefined) return undefined;
  const type = checker.getTypeFromTypeNode(typeNode);
  return (type.flags & ts.TypeFlags.String) !== 0 ? undefined : type;
}

/**
 * 核心入口：在构建站点表的同一 checker 上，为每个有类型 ask 发射 schema。与
 * docs 中 `synthesizeAskSchemas(program, siteTable)` 对应，这里取 {@link WorkflowProgram}
 * 以便拿到 `toScriptLoc` 做定位诊断。
 */
export function synthesizeAskSchemas(
  workflow: WorkflowProgram,
  table: SiteTable,
): SchemaSynthesisResult {
  const checker = workflow.program.getTypeChecker();
  const schemas: Record<string, JsonSchema> = {};
  const diagnostics: CompileDiagnostic[] = [];

  for (const site of table.asks) {
    const type = askResultType(checker, site.call);
    if (type === undefined) continue; // 无类型 ask：结果即最终文本，不发射 schema

    try {
      const typeNode = site.call.typeArguments![0]!;
      const emitter = new SchemaEmitter(checker, typeNode);
      schemas[site.id] = attachTopDoc(emitter.emitTop(type), type, checker);
    } catch (error) {
      if (!(error instanceof SchemaRejection)) throw error;
      diagnostics.push({
        code: SCHEMA_DIAGNOSTIC_CODE,
        column: site.loc.column,
        line: site.loc.line,
        message: rejectionMessage(error, "ask result type"),
      });
    }
  }

  for (const site of table.reports) diagnostics.push(...reportItemDiagnostics(checker, site));

  return { diagnostics, schemas };
}

/**
 * `report(item)` 的实参可序列化性检查。
 *
 * 为什么与 ask 的 schema 合成走**同一趟 checker walk、同一个发射器、同一条诊断通道**：
 * 被 report 的 item 与一个 artifact 因为完全相同的理由跨越 journal 与协议边界，所以判定
 * "什么算可序列化"必须是同一个答案。另建一个平行的检查器，等于开始维护第二份真相——
 * 而两份真相分歧的那天，只会在某个 run 的 Results 面板上显示成一个 `{}`。
 *
 * 与 ask 的两点差别：
 *   1. **不产出 schema**。report 没有校验对象——没有模型要按它提交什么，item 是脚本自己
 *      算出来的值。这里只要"能不能序列化"这个是非判断，发射出的 schema 直接丢掉。
 *   2. 类型取自**实参表达式**而非类型实参。facade 把参数声明成 `unknown`（`unknown` 在
 *      发射器里是合法的 any-JSON），所以问的是"你实际递进来的那个值是什么类型"。
 *      `report(x)` 中 x 若是 `unknown` 或普通 JSON 形状则通过，是 `Date`/函数/类实例
 *      /Promise 则在调用点被定位拒绝。
 */
function reportItemDiagnostics(
  checker: ts.TypeChecker,
  site: SiteTable["reports"][number],
): CompileDiagnostic[] {
  // 实参缺席由 typecheck 负责报错（facade 的 `item` 是必填参数），这里无事可做。
  if (site.item === undefined) return [];
  try {
    new SchemaEmitter(checker, site.item).emitTop(checker.getTypeAtLocation(site.item));
    return [];
  } catch (error) {
    if (!(error instanceof SchemaRejection)) throw error;
    return [
      {
        code: SCHEMA_DIAGNOSTIC_CODE,
        column: site.loc.column,
        line: site.loc.line,
        message: rejectionMessage(error, "report item type"),
      },
    ];
  }
}

/**
 * 便捷入口：从脚本文本一站式合成（typecheck → 站点表 → 合成）。给包内/引擎侧一个不必
 * 自己拼装 program+table 的调用点；analyzeWorkflowScript 归 analysis 域所有，这里不触碰。
 * 若脚本本身 typecheck 不通过，返回其编译诊断且不合成。
 */
export function synthesizeWorkflowSchemas(scriptText: string): SchemaSynthesisResult {
  const workflow = createWorkflowProgram(scriptText);
  const compileDiagnostics = collectDiagnostics(workflow.program);
  if (compileDiagnostics.length > 0) return { diagnostics: compileDiagnostics, schemas: {} };
  return synthesizeAskSchemas(workflow, collectSites(workflow));
}

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
export function buildAskSpecs(table: SiteTable, schemas: Record<string, JsonSchema>): Map<string, AskSpec> {
  const specs = new Map<string, AskSpec>();
  for (const site of table.asks) {
    const schema = schemas[site.id];
    specs.set(site.id, schema === undefined ? { typed: false } : { typed: true, schema });
  }
  return specs;
}

/** 顶层类型的 description/约束：源自其别名或符号（具名 interface/type alias）。 */
function attachTopDoc(schema: JsonSchema, type: ts.Type, checker: ts.TypeChecker): JsonSchema {
  const symbol = type.aliasSymbol ?? type.getSymbol();
  if (symbol === undefined) return schema;
  return mergeConstraints(schema, harvestConstraints(symbol, checker));
}

function rejectionMessage(error: SchemaRejection, subject: string): string {
  const where = error.path !== "$" && error.path.length > 0 ? ` (at ${error.path})` : "";
  return `unsupported ${subject}: ${error.reason}${where}`;
}
