/**
 * 父进程 harness（Boundary A 的宿主侧 + 沙箱进程编排）。
 *
 * 职责：把一份 workflow 脚本（或已 lowered 的函数体）在受控子进程里跑起来，用 NDJSON 桥接
 * 子进程的 `__host.*` 调用到一个 {@link WorkflowEngine} 实例，最终返回引擎的 {@link RunSettlement}。
 * 本包**只**依赖 `@zcode/dynamic-workflow` 与 node 内建——证明整条管线 app-free 可跑，
 * 绝不 import `@zcode/core`/`@zcode/contracts`/`@zcode/bootstrap`/`@zcode/adapters`。
 *
 * 时序（happy path）：
 *
 *   parent                         child(vm)
 *     │  write <cwd>/.zcode/workflow-runs/<runId>.mjs（payload: lowered+args 内嵌）
 *     │  spawn(node <entry>)
 *     │──────────────────────────▶│  build __host in context
 *     │◀── create-actor(local#1) ──│  createActor 同步返回 local#1
 *     │  map local#1 → ActorId     │
 *     │◀── request ask(local#1) ───│  await __host.ask(...)
 *     │  engine.ask → driver.startAsk … settle
 *     │── response(value) ────────▶│  resolve
 *     │◀────── complete(ok,value) ──│  脚本 return
 *     │  engine.complete(value) → settled=completed
 *
 * 失败/取消：run 的裁决归引擎所有。终结失败（脚本抛错 error-complete、子进程崩溃/非零退出、
 * 墙钟超时、子进程行 JSON 解析失败）都调 `engine.fail(error)`（结算 failed + journal failure_json）；
 * abort 信号是唯一的"真取消"，调 `engine.stop(initiator)`（结算 stopped；`signal.reason` 为
 * `"model"` 即主代理 TaskStop，`"interrupted"` 即宿主 App 关闭时停下自己拥有的 run，否则算用户）。引擎自身的 run 级失败
 * （reportCap/inputHash/unknownActor）同样经 engine.settled 冒出。harness 侧的 first-wins
 * finalize 只管子进程清理（清 timer、关 stdin、kill child），不自造结算。
 */
import { WorkflowEngine, type AskSpec, type Caps, type ImportedRunCache, type RunSettlement, type ValidateFn, type WorkflowDriver, type WorkflowReportSink } from "@zcode/dynamic-workflow";
import { type HarnessWarning } from "./child-entry-file.js";
/** driver 工厂：harness 先建 sink（引擎的向上回报面），交给工厂造 driver，再以该 driver 建引擎。 */
export type DriverFactory = (sink: WorkflowReportSink) => WorkflowDriver;
/**
 * run 的**活体控制面**：harness 在引擎构造好之后把这一世的引擎交给它，于是持有句柄的那一侧
 * （run service）能够到活着的引擎。两条命令——就地改本 run 的并发上界
 * （docs/dynamic-workflow/concurrency.md「Two bounds on a run」）与补全一处留白
 * （docs/execution-engine.md「Holes」）。
 *
 * 外加两个只读面 `openHoles` / `filledHoles`：run 快照里 `holes[].state === "waiting"` 必须从引擎的
 * 停驻表投影（docs/execution-engine.md「The run snapshot」——进程死过之后没有 promise 在等，光看
 * 事件会把没人问的留白报成在等），而这条绑定是 run service 够到活引擎的唯一接缝。
 *
 * 收窄成 `Pick<…>` 而不是整个引擎：控制面是一条**命令**通道，不是让
 * 宿主绕过 harness 去驱动 run 生命周期的后门（结算仍然只经 complete/stop/fail 那三条路）。
 *
 * 与 `signal` 同规：harness 只做接线，不解释、不校验、不兜底；命令的存活判定与 no-op 语义
 * 全在引擎里（`setMaxConcurrency` 返回 false 即这次什么也没发生）。
 */
export interface RunControlBinding {
    bind(engine: Pick<WorkflowEngine, "setMaxConcurrency" | "fillHole" | "openHoles" | "filledHoles">): void;
}
/**
 * {@link runWorkflowScript} 的入参。执行体来自 `scriptText` 或 `lowered`（后者优先）；
 * 两者同时给出正是「编译一次」的形态——调用方自己编译得到 `lowered`，同时把作者写的
 * `scriptText` 交下来落库。
 *
 * **harness 绝不校验这一对是否自洽**：它无法校验（判断 `lowered` 是否真由 `scriptText`
 * 降级而来，等于把编译再跑一遍，而那正是「编译一次」要省掉的那次）。递进来一份对不上的
 * 组合，落库的 `script_text` 就会与实际执行的代码不符，resume 的比对基准随之失真——
 * 这份自洽性归调用方所有。
 */
export interface RunWorkflowOptions {
    /**
     * 作者写的 workflow 脚本源码，两个用途：
     * 1. `lowered` 缺省时由 harness lower 它得到执行体；
     * 2. **始终**作为 run 元数据落 `dwf_run.script_text`（resume 的比对基准是作者原文，
     *    不是 lowered 函数体）。
     */
    scriptText?: string;
    /**
     * 已 lowered 的 async 函数体（自由标识符仅 `__host`）。绕过编译器，直接喂沙箱——
     * 安全测试用它投喂手写 lowered 体（vm 契约本身才是被测对象），编译一次的路径用它
     * 交出自己那一次编译的产物。给出时优先于 `scriptText` 作为执行体。
     */
    lowered?: string;
    runId?: string;
    /** driver 工厂（见 {@link DriverFactory}）。driver 自带 journal 与 emit。 */
    makeDriver: DriverFactory;
    caps: Caps;
    /** 每 ask 站点的静态规格。**必须覆盖脚本里的每个 ask 站点**——引擎把缺席当接线错误硬失败。 */
    askSpecs: ReadonlyMap<string, AskSpec>;
    /**
     * 站点 → 词法出生阶段名（`collectSitePhases`）；verbatim 转交 `EngineConfig.sitePhases`。
     * 缺席即空表：引擎对每个站点都退回动态当前阶段（老编译产物、snippet、直接投喂 lowered 体）。
     */
    sitePhases?: ReadonlyMap<string, string>;
    /** 注入的 schema 校验器（引擎不 import schema 实现）。 */
    validate: ValidateFn;
    /** 外部取消信号：中止在飞 ask 并 kill 子进程，run 结算 cancelled。 */
    signal?: AbortSignal;
    /**
     * 活体控制面的绑定口（见 {@link RunControlBinding}）。与 `signal` 同一条缝递进来：
     * 那个是「停下这个 run」的通道，这个是「改这个 run 的一项设置」的通道。缺席即本次启动
     * 没有控制面（集成测试、snippet 执行）。
     */
    control?: RunControlBinding;
    /** 墙钟超时（ms）：到点 kill 子进程，run 结算 failed。缺省不限。 */
    timeoutMs?: number;
    /** 子进程堆上限（MB），映射为 `--max-old-space-size`。缺省 256。 */
    maxOldSpaceSizeMb?: number;
    /**
     * 子进程 spawn 策略的替代形态：给出时 spawn `process.execPath [...argsPrefix, <entry path>]`，
     * **不带任何 Node CLI 旗标**。
     *
     * 存在理由：SEA 单文件二进制不解释 Node CLI 旗标，缺省路径的 `--max-old-space-size` 会作为
     * 普通 token 落进 CLI 的严格 parseArgs 而必然报错退出（每个 workflow run 在 SEA 下都失败）。SEA 下
     * 由 bootstrap 传入隐藏子命令名作为 argsPrefix，子进程自 re-exec 本二进制并在 parseArgs 之前
     * `import()` 入口文件、调它的 `start`。
     *
     * 代价：堆上限只能由入口文件自己 `v8.setFlagsFromString` best-effort。
     */
    childSpawn?: {
        argsPrefix: readonly string[];
    };
    /**
     * 非致命状况的上报口（今日只有一种：入口文件写不进项目 `.zcode/`，回落到了 OS 临时目录）。
     * harness 是 app-free 的，没有 logger；bootstrap 把它接到自己的 warn 日志。
     */
    onWarning?: (warning: HarnessWarning) => void;
    /** 子进程工作目录，缺省 process.cwd()；同时作为 run 元数据落 dwf_run.cwd。 */
    cwd?: string;
    /**
     * run 元数据，**原样**转交 `EngineConfig`（createRun 落 dwf_run）。全可选，harness
     * 不加工也不推断：`scriptHash` **由调用方计算**。harness 若哈希"它看到的文本"，在
     * lowered 路径上落库的就是 lowered 函数体的哈希——resume 校验会拿到一个静默错误的
     * 比对对象。脚本原文走上面的 `scriptText`。
     */
    scriptHash?: string;
    parentSessionId?: string;
    /** run 的展示名（宿主枚举面的标签来源）。与 `scriptText` 同路，harness 只转交。 */
    name?: string;
    /**
     * 本次 run 的实参（saved workflow 的声明式参数，已由调用方校验并回填默认值）。
     *
     * **两个去处**，这是它与其余元数据的不同之处：既随 `EngineConfig` 落 `dwf_run.args_json`
     * （resume 从那里读回重放），也进 spawn payload 注入沙箱成为冻结的 `args` 全局。harness
     * 不校验、不加工——声明与校验都在调用方（工具侧）。缺席即 `{}`。
     */
    args?: Record<string, unknown>;
    /** 发起 run 的 CreateWorkflow 工具调用 id（重启后 join/通知锚点）；verbatim 转交 EngineConfig。 */
    toolCallId?: string;
    /**
     * 修订续跑（amend-resume）的一对入参，与其余元数据同规：**verbatim 转交 EngineConfig**，
     * harness 不读、不加工、不推断。`resumedFrom` 是落 `dwf_run.resumed_from` 的 lineage 指针，
     * `importedCache` 是注入引擎的纯数据缓存表。
     *
     * 与 `scriptText`/`lowered` 那一对同样的分工：**两者的一致性归调用方所有**。harness 无从判断
     * 这张表是否真由那个前驱 run 构建而来（那要求它自己去读 journal，而本包连存储都不认识）。
     * 递进来一张对不上的表，得到的就是一个把别人的答案当成自己缓存的 run。构建与门都在 run
     * service（bootstrap 的 dynamic-workflow-import.ts）。
     */
    resumedFrom?: string;
    /**
     * 发起 run 那一轮的锚点；verbatim 转交 EngineConfig。
     * `subagentModel` 与锚点、阶段表同车：本 run 子代理的规范 picker 串
     * （`providerId/modelId[$reasoningLevel]`），harness 同样不读、不解析、不加工——它零 SQL 地
     * 活在 `run-launched` 事件里，解析与优先级都在宿主侧（bootstrap 的 workflow-actor-model.ts）。
     * `phaseAlongside` 与 `phaseNames` 按位置对齐（下标指向同一张表），同车同规。
     */
    launch?: {
        inputId: string;
        phaseNames?: string[];
        subagentModel?: string;
        /** 脚本点名的模型 → 规范串（docs/dynamic-workflow/launch.md「Models the script names」），同车同规。 */
        modelBindings?: Record<string, string>;
        phaseAlongside?: number[][];
        /** `phaseNames` 里未补全留白的下标（docs/execution-engine.md「Holes」），同车同规。 */
        holes?: number[];
    };
    importedCache?: ImportedRunCache;
    /**
     * 建 run 时的用量起点（前驱 run 的 `spentTokens`）；与其余元数据同规：**verbatim 转交
     * EngineConfig**，harness 不读、不加工。读前驱的行发生在 run service。
     */
    inheritedTokens?: number;
}
/**
 * 跑一份 workflow 脚本至结算。返回引擎的 {@link RunSettlement}。
 * 失败一等公民，但分两类：脚本抛错是脚本之错，
 * 归一成 `{status:"errored", error}`；子进程无法启动 / 崩溃 / 墙钟超时 / 协议损坏是宿主侧故障，
 * 重跑很可能就好，归一成 `{status:"stopped", reason:"interrupted", error}`（可 resume）。
 * 两者都绝不静默吞掉。
 */
export declare function runWorkflowScript(options: RunWorkflowOptions): Promise<RunSettlement>;
//# sourceMappingURL=harness.d.ts.map