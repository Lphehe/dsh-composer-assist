/**
 * 子代理模型的编译期规则（docs/dynamic-workflow/authoring.md「Choosing a model per subagent」；
 * docs/analysis.md「Diagnostics」的 9010 行）。
 *
 * 规则只有一句：**一个脚本能交给子代理的模型名，在运行前就是一个封闭集合**。launch 工具据此在确认窗
 * 之前把每个名字对着宿主的模型目录解析一遍（docs/dynamic-workflow/launch.md「Models the script
 * names」），窗上显示的就是将要生效的模型，解不出来的名字作为 9011 退回、什么都不跑。
 *
 * 集合的两个来源：
 *
 * 1. `model("…")` 调用的实参——必须是非空的无洞字符串字面量（9010）。`ModelRef` 只能由它造出
 *    （facade 里是私有构造器 + 私有成员的 class，`new` 与对象字面量都造不出来），所以任何类型为
 *    `ModelRef` 的值都来自某一次 `model()`，名字已经在集合里。
 * 2. 每个 `agent(name, persona)` 站点上 persona 的 `model` 属性的**类型**：必须是 `ModelRef`、
 *    字符串字面量类型，或它们的联合（9010）。联合里的每个字面量成员都进集合。
 *
 * 为什么判**类型**而不是判语法上的字面量：`const FLASH = "…"`、`hard ? "a" : "b"`、`MODELS[k]`
 * 这些写法运行期取哪个值不定，但取值集合 checker 已经算好了——按类型判，一条规则就同时覆盖
 * 内联字面量、const 绑定和三目，而一个被拓宽成 `string` 的值（`let`、参数、带洞模板、先装进
 * 变量的 persona 对象）恰好就是集合不封闭的那一类。
 *
 * 为什么内联的 persona 对象字面量要**按语法取 `model` 的初值表达式**再问它的类型，而不是问整个
 * 对象的类型：对象字面量的属性类型在上下文类型不含字面量类型时会被拓宽（`{ model: "x" }` 在
 * `AgentPersona` 的上下文里，属性类型是 `string`），按对象类型判会把最常见的写法误报掉。初值
 * 表达式自己的类型不受这条拓宽影响。
 *
 * 与 actor-names.ts（9005/9006）不同，本诊断**没有运行期兜底**：下游没有第二处去查「一个子代理的
 * model 可能是什么」。宿主在建会话时查不到绑定只会让那一次 ask 大声失败（只有类型断言能走到那
 * 一步），而那已经是确认窗之后了。所以这里宁可多报，不可漏报。
 *
 * 顺带：`ModelRef` 在运行期不存在（lowering 把 `model("x")` 抹成 `"x"`，沙箱里没有这个 class），
 * 所以脚本在**值位置**引用 `ModelRef`（`x instanceof ModelRef`）也在这里以 9010 报出，
 * 而不是留成一个运行期 ReferenceError。
 */
import type { CompileDiagnostic, WorkflowProgram } from "../compiler/compile.js";
import { type SiteTable } from "./sites.js";
/** 模型名不封闭（persona 的 `model` 类型、`model()` 的实参、值位置的 `ModelRef`）。 */
export declare const MODEL_REFERENCE_CODE = 9010;
/**
 * 脚本里的模型名在宿主的模型目录里解析不出来（没有、歧义、被停用、档位不对）。**不是**本包产出的
 * 诊断——编译器不知道宿主配了哪些模型——而是 launch 工具（packages/core）在 `resolveInput` 之后
 * 按 {@link ModelReference} 的位置报出来的；码放在这里，好让两处共用一个数、诊断表只有一份。
 */
export declare const MODEL_UNRESOLVED_CODE = 9011;
/** 脚本能交给子代理的一个模型名，及它在脚本里出现的一处位置。 */
export interface ModelReference {
    /** 名字，**逐字**如脚本所写：运行期 persona 里带的就是这个串，launch 的绑定表以它为键。 */
    name: string;
    line: number;
    column: number;
}
export interface ActorModels {
    /** 每处出现一条，按发现顺序（`model()` 调用在前，其后是各 `agent()` 站点）。 */
    references: ModelReference[];
    /** 9010；非空即脚本不可提交。 */
    diagnostics: CompileDiagnostic[];
}
/** 收集模型名集合与 9010 诊断。只在编译干净的程序上调用。 */
export declare function collectActorModels(workflow: WorkflowProgram, table: SiteTable): ActorModels;
//# sourceMappingURL=actor-models.d.ts.map