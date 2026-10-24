/**
 * 产物（artifact）的编译期收集与诊断。
 *
 * ⚠ 术语：本模块的 artifact 是**用户面产物**——脚本经 `artifact.*` 发布给用户看的文件 /
 * markdown / 预置看板。同目录下的 `artifact-types.ts` 说的是**另一个** artifact：站点的
 * 类型化输出值（给模型看的）。两者不相干。
 *
 * 产物两件：
 *
 * 1. `declaredArtifacts`（编译产物，照 `collectWorldRunCommands` 的 `commands`）：脚本声明的
 *    产物清单 `[{id, kind}]`，去重、按 id 排序。中枢与检视器据它在**运行前**就能说出这个
 *    工作流会产出什么。
 * 2. 定位诊断（facade-misuse 同族）：id 必须是编译期字面量，标签必须指向一个已声明的预置，
 *    同一个 id 不能横跨两个成员种类，预置声明不该长在循环体 / 回调 / 条件分支里。
 *
 * 为什么 id 必须是编译期字面量（与 `world.run` 的 cmd、`phase` 的 name 同一姿态）：一个运行期
 * 才成形的 id 没有可展示的对象——它既进不了「将产出」清单，也让「同 id 两种种类」这类规则
 * 只剩运行期一条路。教改写发生在便宜的那一侧。
 *
 * 与运行期的分工：这一趟只做**字面量能看穿的那一半**。真正的门在引擎——`ArtifactKindMismatch`
 * /`ArtifactRedeclared`/`ArtifactUndeclared`/`ArtifactCapExceeded` 都在运行期兜底，因为
 * 声明的**执行顺序**（哪个先跑到）静态看不出来。所以本模块**只会漏报、不会误报**，
 * 唯一的例外是提升诊断（见 {@link ARTIFACT_HOISTING_CODE}）。
 */
import type { CompileDiagnostic, WorkflowProgram } from "../compiler/compile.js";
import { type ArtifactOp } from "../facade/registry.js";
import { type SiteTable } from "./sites.js";
/**
 * 产物的编译期诊断码（9001 = facade-siting、9002 = schema、9003 = world-run、9004 = phase、
 * 9005/9006 = actor 名，顺延）。覆盖：非字面量 / 空 / 超长 / 非法字符的 id、同 id 跨种类复用、
 * `report` 标签的三种错法。全部是**静态确定**的错误——没有一条会误伤一份合法脚本。
 */
export declare const ARTIFACT_DECLARATION_CODE = 9007;
/**
 * 预置声明长在循环体 / 回调 / 条件分支里（「声明提到顶层，一次即可」），单独一个码而不是
 * 复用 9007，理由与 9005/9006 的分家完全相同：**确定性不同**。
 *
 * 循环里以**相同 spec** 重复声明在运行期其实是幂等 no-op，所以这条子句理论上会误报。接受它
 * 的理由是代价不对称——修复是免费的（把声明挪到脚本顶部），而不报的代价是一个看板声明藏在
 * 第三层回调里，读者要跑一遍才知道它到底声明了没有。读端（fixture 语料、未来的宽松档）
 * 因此需要能把它与 9007 区分开，而按错误文本分流是本仓库处处禁止的。
 */
export declare const ARTIFACT_HOISTING_CODE = 9008;
/**
 * 两个**不同的** id 都写了字面量 `primary: true`。
 * 与 9008 同一种确定性：互斥分支里各标一个在运行期跑得通，但卡与侧板只会带头一个交付物，
 * 说不清哪个是的脚本没写完。只认字面量 `true`；算出来的旗子留给引擎的 `ArtifactPrimaryConflict`。
 */
export declare const ARTIFACT_PRIMARY_CONFLICT_CODE = 9009;
/** 脚本声明的一个产物：id 与它的成员种类。 */
export interface DeclaredArtifact {
    id: string;
    /** 成员种类（`file` / `markdown` / `chart` / `table` / `metrics` / `board`）。 */
    kind: ArtifactOp;
}
export interface ArtifactDeclarations {
    /** 脚本声明的产物清单：去重、按 id 字典序（`declaredCommands` 的同形产物）。 */
    declaredArtifacts: DeclaredArtifact[];
    /** 定位诊断；非空即脚本不可提交。 */
    diagnostics: CompileDiagnostic[];
}
/**
 * 收集产物清单与诊断。非空诊断即脚本不可提交（`analyzeWorkflowScript` 与 world.run / phase /
 * actor 名的编译期规则同席）。
 */
export declare function collectArtifactDeclarations(workflow: WorkflowProgram, table: SiteTable): ArtifactDeclarations;
//# sourceMappingURL=artifacts.d.ts.map