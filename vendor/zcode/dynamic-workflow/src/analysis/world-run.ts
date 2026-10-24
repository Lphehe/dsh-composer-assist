/**
 * world.run 的编译期命令收集。
 *
 * `world.run` 的授权面是**批准 + 钉死**：cmd 必须是编译期字符串字面量，脚本的命令集因此
 * 在提交前就是一个封闭集合——确认窗展示它，driver 执行时复验它。一个运行期才成形的 cmd
 * 没有可展示的授权对象，所以是定位诊断而不是运行期拒绝（教改写发生在便宜的那一侧，
 * 与 facade-siting 规则同一姿态）。
 *
 * 只看第一实参：args 数组与 opts 允许携带运行期值（ask 产物插值进 args 正是数据边的
 * 来源）；被钉住的是「跑哪个命令」，不是「拿什么跑」。
 */

import ts from "typescript";
import type { CompileDiagnostic, WorkflowProgram } from "../compiler/compile.js";
import type { SiteTable } from "./sites.js";

/** world.run 非字面量 cmd 的诊断码（9001 = facade-siting、9002 = schema，顺延）。 */
export const WORLD_RUN_LITERAL_CODE = 9003;

export interface WorldRunCommands {
  /** 脚本声明的命令集：去重、字典序（确认窗与 driver 复验共用的形状）。 */
  commands: string[];
  /** 非字面量 cmd 的定位诊断；非空即脚本不可提交。 */
  diagnostics: CompileDiagnostic[];
}

/**
 * 从站点表收集 world.run 的命令集。cmd 必须是无洞字符串字面量（`"lean"` 或
 * `` `lean` ``——`ts.isStringLiteralLike` 覆盖两者；带洞模板与任意表达式都拒绝）。
 */
export function collectWorldRunCommands(
  workflow: WorkflowProgram,
  table: SiteTable,
): WorldRunCommands {
  const commands = new Set<string>();
  const diagnostics: CompileDiagnostic[] = [];
  for (const site of table.worldReads) {
    if (site.op !== "run") continue;
    const cmd = site.args[0];
    if (cmd !== undefined && ts.isStringLiteralLike(cmd)) {
      commands.add(cmd.text);
      continue;
    }
    // 元数错误（cmd 缺席）由类型检查先拦：能走到这里的缺席意味着调用点连编译都不该过，
    // 但诊断收集不该依赖这条推断——按站点位置报，宁可多一条可定位的错误。
    const loc = cmd === undefined ? site.loc : workflow.toScriptLoc(cmd.getStart());
    diagnostics.push({
      code: WORLD_RUN_LITERAL_CODE,
      column: loc.column,
      line: loc.line,
      message:
        "world.run's first argument must be a compile-time string literal (\"lean\" or a " +
        "no-substitution template): the script's command set is shown to the user at " +
        "confirmation and only those commands are executable. Move the command name out of " +
        "the variable/template, and put runtime values in the args array instead.",
    });
  }
  return { commands: [...commands].sort(), diagnostics };
}
