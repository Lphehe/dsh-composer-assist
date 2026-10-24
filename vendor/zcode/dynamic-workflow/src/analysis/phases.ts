/**
 * `phase("…")` 标记的编译期校验。
 *
 * 两条规则，同一个理由——**标记必须在提交前就说清楚它指的是什么**。名字是编译期字面量，
 * 因为阶段集在确认窗上被展示（与 `world.run` 的 cmd 同姿态：运行期才成形的名字没有可展示
 * 的对象）；调用必须是独立语句，因为标记的意义就是「从这里到块尾」，一个待在初始化器/
 * 实参/三元臂里的标记没有可指的范围。两条都是**定位诊断**而不是运行期兜底：教改写发生在
 * 便宜的那一侧。
 *
 * 别名逃逸（`const p = phase`）不在这里——`phase` 是 facade 函数声明，facade-misuse 的
 * pass 1 已经拒绝任何非直接调用位置的引用。
 */

import ts from "typescript";
import type { CompileDiagnostic, ScriptLoc, WorkflowProgram } from "../compiler/compile.js";
import type { SiteTable } from "./sites.js";

/** phase 标记的诊断码（9001 = facade-siting、9002 = schema、9003 = world-run，顺延）。 */
export const PHASE_MARKER_CODE = 9004;

const LITERAL_MESSAGE =
  'phase()\'s argument must be a compile-time string literal ("gate" or a no-substitution ' +
  "template): the script's phase names are fixed when it is submitted, because they label " +
  "the graph the user confirms before anything runs. Write the name inline — a name that " +
  "only exists at run time cannot be drawn.";

const EMPTY_MESSAGE =
  'phase("") has no name to show: the phase label is what the confirmation graph draws. ' +
  'Give the group a word ("preflight", "gate", "wrap-up"), or drop the marker — a script ' +
  "with no markers is perfectly legal and is drawn step by step.";

const STATEMENT_MESSAGE =
  'phase("…") must stand alone as its own statement. The marker claims the rest of the block ' +
  "it stands in, so one in expression position (a variable initializer, an argument, a " +
  "ternary arm) has no rest-of-block to claim. Put the call on its own line at the head of " +
  "the steps it names.";

/**
 * 校验收集到的 phase 标记。非空即脚本不可提交（`analyzeWorkflowScript` 与 misuse /
 * world.run 同席处理）。
 *
 * 一个标记可以同时犯两条（`const x = phase(bad)`），两条都报：作者一次就能看全要改什么。
 */
export function collectPhaseMarkerDiagnostics(
  workflow: WorkflowProgram,
  table: SiteTable,
): CompileDiagnostic[] {
  const diagnostics: CompileDiagnostic[] = [];
  const push = (loc: ScriptLoc, message: string): void => {
    diagnostics.push({ code: PHASE_MARKER_CODE, column: loc.column, line: loc.line, message });
  };

  for (const marker of table.phases) {
    // 名字的诊断落在**出问题的那个表达式**上（缺席时退回调用位置）：作者要改的是那一处。
    const nameLoc =
      marker.nameExpr === undefined
        ? marker.loc
        : workflow.toScriptLoc(marker.nameExpr.getStart(workflow.scriptFile));
    if (marker.name === undefined) {
      push(nameLoc, LITERAL_MESSAGE);
    } else if (marker.name.trim() === "") {
      push(nameLoc, EMPTY_MESSAGE);
    }
    if (!ts.isExpressionStatement(marker.call.parent)) {
      push(marker.loc, STATEMENT_MESSAGE);
    }
  }
  return diagnostics;
}
