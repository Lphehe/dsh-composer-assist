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
import type { CompileDiagnostic, WorkflowProgram } from "../compiler/compile.js";
import type { SiteTable } from "./sites.js";
/** phase 标记的诊断码（9001 = facade-siting、9002 = schema、9003 = world-run，顺延）。 */
export declare const PHASE_MARKER_CODE = 9004;
/**
 * 校验收集到的 phase 标记。非空即脚本不可提交（`analyzeWorkflowScript` 与 misuse /
 * world.run 同席处理）。
 *
 * 一个标记可以同时犯两条（`const x = phase(bad)`），两条都报：作者一次就能看全要改什么。
 */
export declare function collectPhaseMarkerDiagnostics(workflow: WorkflowProgram, table: SiteTable): CompileDiagnostic[];
//# sourceMappingURL=phases.d.ts.map