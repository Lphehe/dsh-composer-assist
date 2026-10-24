/**
 * 留白站点（docs/dynamic-workflow/authoring.md「Holes: `hole<T>()`」，docs/analysis.md「Sites」）：
 * 站点的构造（三个重载的实参分派、tail 判定）与编译期规则 9012。
 *
 * 9012 的每条规则都是「运行期才炸不如现在就教改写」的那一类（与 9003 / 9004 同席）：
 *  - 类型实参必须显式写出：T 是补全被检查的契约，推断出的 `unknown` 不是契约；
 *  - 名字是非空字面量、≤128 字符，且在脚本的留白与阶段标记中**唯一**（嵌套补全也算）：名字
 *    是留白的阶段名与每个界面显示的身份——两个标记同名是一个阶段，两个留白同名却是两个缺口；
 *  - 调用必须被 await：没等值的留白会让脚本越过一个还没有值的缺口；
 *  - 不能落在 fan-out **回调**里（数组方法的回调，提升与否都算）：元素并发跑，补全得在它们
 *    已经在跑的时候写。`for...of` 体**允许**：带 await 的 for...of 是顺序的——第一轮停在留白，
 *    补全到了，后面每轮跑函数体，正是「循环里的留白补全一次、每轮跑一遍」那一条；
 *  - 函数体不得引用留白之后才声明的绑定：函数体是编译器不检查「先用后声明」的闭包，引用
 *    后面的 `const` 到运行期才 TDZ 抛错；
 *  - 函数体必须是内联的函数字面量：lowering 要把它原样打印成补全文本，一个标识符没有文本可打。
 */
import ts from "typescript";
import type { CompileDiagnostic, ScriptLoc, WorkflowProgram } from "../compiler/compile.js";
import type { HoleSite, SiteTable } from "./sites.js";
/** 留白规则的诊断码（9001 = facade-siting、…、9010 = 模型名，顺延）。 */
export declare const HOLE_CODE = 9012;
/** 留白名的长度上限：与阶段名同规（docs/dynamic-workflow/authoring.md「Holes」）。 */
export declare const HOLE_NAME_MAX_CHARS = 128;
/**
 * 从一个已按声明判定为 facade `hole` 的调用构造站点。三个重载的分派只看实参形状：第二实参是
 * 函数字面量即函数体，否则是提示；第三实参（若有）是函数体。非字面量的函数体既不算提示也不算
 * 函数体——留给 9012 报「必须内联」。
 */
export declare function holeSiteOf(call: ts.CallExpression, id: string, order: number, loc: ScriptLoc, funcDepth: number, fill: string | undefined): HoleSite;
/** 校验收集到的留白站点。非空即脚本不可提交（`analyzeWorkflowScript` 与 misuse 同席）。 */
export declare function collectHoleDiagnostics(workflow: WorkflowProgram, table: SiteTable): CompileDiagnostic[];
//# sourceMappingURL=hole-sites.d.ts.map