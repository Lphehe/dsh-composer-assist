import { type CompileDiagnostic, type WorkflowProgram } from "../compiler/compile.js";
import { type SiteTable } from "../analysis/sites.js";
/**
 * Lowering（instrumentation emit step）：把已 typecheck + analyze 干净的 workflow 脚本降级为沙箱可跑的
 * **JavaScript**。两件事：
 *
 *   1. 剥离类型——程序已经 typecheck 过，这里是对同一份源码做 transpile 级别的类型擦除。
 *   2. 用站点表里的**静态 site id** 给每个 facade 调用打桩，改写成 Boundary A 的 `__host.*`：
 *        agent(name, persona)        -> __host.createActor("actor#2", name, persona)
 *        planner.ask<Plan>(text)     -> __host.ask("ask#3", planner, text)
 *        maybe?.ask<Plan>(text)      -> maybe === null || maybe === undefined
 *                                         ? undefined : __host.ask("ask#3", maybe, text)
 *                                       （可选链的短路保留：receiver 为 nullish 时跳过 ask、
 *                                        实参不求值；非标识符 receiver 经临时变量求值一次）
 *        files.glob(p) / files.read(p)
 *                                    -> __host.worldRead("world-read#1", "glob", [p])
 *                                       __host.worldRead("world-read#2", "read", [p])
 *        report(x)                   -> __host.report("report#1", x)
 *        report(x, "perf")           -> __host.report("report#1", x, "perf")
 *        artifact.file(id, p, o)     -> __host.publishArtifact("artifact#1", "file", [id, p, o])
 *        artifact.chart(id, spec)    -> __host.declareArtifact("artifact#2", "chart", [id, spec])
 *        log(msg)                    -> __host.log(msg)
 *        phase("gate")               -> __host.enterPhase("gate")（无站点；引擎只发一条事件）
 *        model("GLM-5.3-Flash")      -> "GLM-5.3-Flash"（无站点、无 host 调用：ModelRef 运行期即名字）
 *        channel<T>("facts")         -> __host.channel("facts")（无站点；队列在 cell 内构造）
 *        future(async () => {...})   -> __host.future(async () => {...})（无站点；cell 立即调用）
 *        hole<T>(n, p?, body?)       -> __host.hole("hole#1", n, p ?? void 0, (__src) => eval(__src), body?)
 *                                       （lower-hole.ts；已补全的函数体另以文本形式进 holeBodies）
 *      Join（Promise.all）与 fan-out 是沙箱内的普通 promise 机制，不是 host 调用，原样保留。
 *
 * ————————————————————————————————————————————————————————————————
 * 输出契约（harness 契约，沙箱负责 wrap）：
 * ————————————————————————————————————————————————————————————————
 * {@link LoweredWorkflow.code} 是 lowered 脚本的 **async 函数体**：顶层 `await` 与末尾
 * `return <artifact>` 都合法，因为 harness 会把它包进一个 async 函数里执行，形如
 *
 *     const __run = async (__host) => { <code> };
 *
 * 也就是说 code 里唯一的自由标识符是 `__host`（见 {@link HOST_BINDING}）——facade 的
 * `agent` / `log` / `files` / `phase` 都已改写掉，沙箱 vm 的 globals
 * 只需提供 ES intrinsics 加一个 `__host` 即可。
 * schema 从不跨沙箱边界：引擎按 site id 从编译产物里查 schema，code 里不含任何 schema。
 *
 * {@link LoweredWorkflow.siteIds} 是被打桩的全部 facade site id，按源码顺序排列（asks /
 * actors / world-reads / reports / artifacts；`log`/`phase` 不占 site id，故不在其中）——供
 * harness 与测试断言"每个 site id 恰好出现一次"。
 *
 * 确定性：printer + transpile 都是纯函数，同一份输入 → 逐字节相同的输出。
 */
/** harness 必须为 lowered code 绑定的自由标识符（Boundary A 的 host 句柄）。 */
export declare const HOST_BINDING = "__host";
/** lowering 的产物：sandbox 输入的 JS 体 + 打桩到的 site id 清单。 */
export interface LoweredWorkflow {
    /** lowered 脚本的 async 函数体（顶层 await / 末尾 return 合法；自由标识符仅 `__host`）。 */
    code: string;
    /** 被打桩的 facade site id，按源码顺序（不含 log，它无 site id；留白与其函数体内的站点在内）。 */
    siteIds: string[];
    /**
     * 每个**已补全**留白的函数体文本 `(async () => {\n…\n})`，按站点 id：与主体同一趟 transform
     * 打印、同一套参数擦除（execution-engine.md「The text that runs」）。开放的留白不在其中。
     */
    holeBodies: Record<string, string>;
}
/** {@link lowerWorkflowScript} 的结果：与 analyze 同构——脏脚本不降级，`lowered` 仅在 `ok` 时给出。 */
export interface LowerResult {
    diagnostics: CompileDiagnostic[];
    ok: boolean;
    lowered?: LoweredWorkflow;
}
/**
 * 便捷入口：编译 + facade-siting 校验 + 收集站点表 + 降级，与 `analyzeWorkflowScript` 同构。
 * 脏脚本（typecheck 或 facade-siting 报错）不降级——降级只在干净程序上运行。
 */
export declare function lowerWorkflowScript(scriptText: string): LowerResult;
/**
 * 核心：把一个已分析干净的 workflow 降级为 {@link LoweredWorkflow}。
 * 站点调用（ask/actor/world-read）一律按 **ts.Node 身份**（站点表持有的 raw call 引用）匹配，
 * 绝不按名字/形状重新识别——那会制造第二份真相。`log` 不入站点表，按 checker 的
 * 签名解析（解析进 facade .d.ts，与 sites.ts 同一机制）识别，属于身份判定而非名字启发。
 */
export declare function lowerWorkflow(workflow: WorkflowProgram, table: SiteTable): LoweredWorkflow;
//# sourceMappingURL=lower.d.ts.map