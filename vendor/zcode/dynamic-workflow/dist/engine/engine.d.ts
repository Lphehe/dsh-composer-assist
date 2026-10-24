/**
 * 执行引擎的确定性状态机（Boundary A 的实现 + 向下驱动 Boundary B + 向上回报 sink）。
 *
 * 核心不做任何 I/O、不读时钟、不用随机数：随时间/调度变化的决策要么被 journal 记录、要么被
 * "每站点序号 + 每 actor FIFO 的 actorSeq"这套确定性规则固定，从而首次执行与 replay 逐字一致。
 *
 * 关键不变量：
 * - 实例身份 = 站点 id × 每站点执行序号（第 n 次 ask#3 = ask#3@n）。actor 身份 = 创建站点 × 序号。
 * - journal 决策：每次 host 调用先查 (siteId, ordinal)；命中即短路（无 driver 调用），并防御性
 *   校验 inputHash——不一致则整个 run 大声失败（结构化错误，绝不静默偏移）。
 * - 每 actor FIFO + actorSeq 准入顺序 + replay 的 hold 规则：见 scheduler.ts（本文件把 ask 生命周期委托给它）。
 *
 * 本文件聚焦 run 生命周期：host API 入口、用量记账、run 结算与事件记录。用户面产物、report、
 * world 节点与导入缓存、run 终态三条路径的方法体各在兄弟模块（engine-artifacts.ts / engine-report.ts /
 * engine-world.ts / engine-settlement.ts），经 engine-state.ts 的 {@link EngineState} 接缝读写这里的
 * 私有状态；本类上只留薄委托（拆分原因：oxlint max-lines 上限 400 行）。出生阶段坐标的两个
 * 打戳函数（事件与 ProviderStop）是纯函数，住在 engine-phase-stamp.ts，只读本类拥有的
 * `instancePhases` 表。
 */
import type { ArtifactContentOp, ArtifactPresetOp } from "../facade/registry.js";
import type { RunSettlement } from "./engine-state.js";
import type { EngineConfig } from "./engine-config.js";
import { type FilledHole, type FillHoleResult, type HoleFill, type OpenHole } from "./engine-holes.js";
import type { ActorId, ArtifactRef, AskProgress, AskStats, AskWaitInfo, ConcurrencyChange, InstanceRef, PersonaSpec, RunStallInfo, RunStatus, RunStopReason, WorkflowHostApi, WorkflowReportSink, WorldReadOp } from "./types.js";
import { WorkflowError } from "./types.js";
/** 引擎构造配置（定义迁到 engine-config.ts，这里原地再导出）。 */
export type { EngineConfig } from "./engine-config.js";
/** run 的最终结算（定义随结算模块的接缝迁到 engine-state.ts，这里原地再导出）。 */
export type { RunSettlement } from "./engine-state.js";
export declare class WorkflowEngine implements WorkflowHostApi, WorkflowReportSink {
    private readonly runId;
    private readonly driver;
    private readonly journal;
    /**
     * 本 run 的并发上界。**可变**（见 {@link setMaxConcurrency}）：一次只改 `max_concurrency`
     * 的修订就地作用在活着的 run 上。整份替换而不是原地改字段——已记进事件与 journal 的那几份
     * caps 必须保持它们被记下时的样子（调用方递进来的那个对象同理不被回写）。
     */
    private caps;
    /**
     * 每 ask 站点的静态规格。**可变**（见 {@link fillHole}）：一次补全把它整份换成有效脚本的表
     * （原表的超集）。整份替换而不是原地改，与 caps 同一条纪律。
     */
    private askSpecs;
    private readonly validate;
    private readonly scheduler;
    /** 每站点执行序号计数器（ask / world-read / actor 共用，站点 id 互不相同）。 */
    private readonly ordinals;
    /**
     * 阶段进入次数，按名字。**不与**
     * `ordinals` 共表：阶段名是作者的任意字符串，一个恰好叫 `report#1` 的阶段不能挪动那个
     * 站点的节点序号（site-id stability），反之亦然。
     */
    private readonly phaseOrdinals;
    /**
     * 控制流当前所在的阶段名（`enterPhase` 维护；第一个标记之前为 undefined）。只在铸造点被
     * 读取——见 {@link nextOrdinal}。
     */
    private currentPhase;
    /** 站点 → 词法出生阶段（见 {@link EngineConfig.sitePhases}）。可变，与 `askSpecs` 同一条路换表。 */
    private sitePhases;
    /** 留白的停驻表与本世的补全记忆（engine-holes.ts）。 */
    private readonly holes;
    /**
     * 实例（`siteId@ordinal`）→ 它**出生时**的阶段名。写在铸造点、读在 {@link record} 的打戳漏斗：静态因果图按阶段拷贝
     * 站点，运行时实例必须带同一个坐标，否则一条车道上的实例会被那个站点的每一份阶段拷贝
     * 同时认领（本 bug 的形状：五个阶段各 20 个子代理，五张卡各显示 100 个）。
     */
    private readonly instancePhases;
    /**
     * 本 run 内已被认领的**非空有效 actor 名** → 认领它的 actor（用于失败信息里指认前一处）。
     * 见 {@link createActor} 的查重与 replay 安全性说明。
     */
    private readonly actorNames;
    /** amend-resume 的导入缓存（纯数据，缺席即本次不是修订续跑）。 */
    private readonly importedCache?;
    /** world 导入队列的消费游标（第 n 次出现对第 n 条）。 */
    private readonly importedWorld;
    /**
     * 导入缓存是否已**关闭**：第一笔写入之前置真、永不重开
     * ——某个 live 子代理即将执行改写工具（driver 上报 askMutating），或一条 world.run live 执行。
     * 关闭后 world 节点与带工具的 ask 不再问导入表（哈希只比对文本，比不出工作区已被改写）；
     * 纯 ask（toolCalls 0）照常命中。resume 时从 `import-cache-closed` 事件恢复，见 {@link recoverImportClosure}。
     */
    private importClosed;
    /**
     * replay 的结算次序闸（docs/execution-engine.md「Replaying the settle order」）：命中缓存的
     * 结算按 journal 记下的**首生结算次序**释放，而不是按准入次序——join 之后的每一个站点序号
     * 都由那个次序决定。非 resume 恒为空闸（人人放行）。
     */
    private replaySettleOrder;
    /** resume 时从事件恢复的「崩溃前曾 live 的 ask 实例」（`siteId@ordinal`）；非 resume 为空。 */
    private liveAskInstances;
    /** resume 时从事件次序恢复的「准入早于关门的 ask 实例」；续跑在飞 ask 的判定据此复原。 */
    private queuedBeforeImportClose;
    /**
     * 本 run 已发布的报告条数与 item 字节数（REPORT_CAPS 两个 run 级上限的计数器）。resume 时从
     * journal 的 kind:"report" 行恢复——上限是 run 级的，跨 resume 必须连续计数，否则一个反复
     * resume 的 run 可以无限报告。
     */
    private reportTally;
    /**
     * 本 run 每个**用户面产物** id 的状态。与 `reportTally`
     * 同一条恢复法：resume 时从 journal 的 `kind: "artifact"` 行重建，此后在内存里维护——
     * 上限（32 个 id / 每 id 16 版）与版本号都是 run 级的事实，跨 resume 必须连续，否则一个
     * 反复 resume 的 run 可以无限发布。
     *
     * ⚠ 术语：artifact = 用户面产物，不是 `RunSettlement.artifact`（顶层返回值）。
     */
    private readonly artifacts;
    /** 累计 token 用量（观察面：只记账、只广播，永远不会让 run 失败）。 */
    private spentTokens;
    private runSettled;
    private runFailure?;
    private readonly settledDeferred;
    /** 兄弟模块自由函数读写私有状态的接缝（构造函数里用箭头闭包装配，见 engine-state.ts）。 */
    private readonly state;
    constructor(config: EngineConfig);
    /** run 结算 promise：完成/失败/取消时兑现。 */
    get settled(): Promise<RunSettlement>;
    /** 当前 run 状态。 */
    status(): RunStatus;
    /**
     * 建一个 actor。**有效名**是 `normalizePersona` 之后的 `spec.name`（persona.name 压过 name
     * 实参），非空即必须在本 run 内唯一——重名让整个 run 大声失败（DuplicateActorName）。
     *
     * 为什么是 run 级失败而不是改名/警告：具名 actor 是 amend-resume 缓存导入的身份键，而任何
     * run 都是未来修订的潜在前驱，前驱里重名会让导入匹配歧义。
     * 规则因此对所有 run 生效，不只是修订 run。匿名（缺席或空串）从不查、任意多个合法——
     * 代价已裁决：没有缓存资格。
     *
     * **replay 安全**：查重表是纯内存的、随引擎实例而生。逐字节相同脚本的 resume 在一个**全新**
     * 引擎实例里从头重跑同一串 createActor 调用，每个名字因此恰好被登记一次，不会把上一轮
     * 自己的登记当成重名。这也是它不能落 journal 的理由——落库的表会在 resume 时与自己撞车。
     *
     * **导入缓存的附着也在这里**（amend-resume）：按有效名查 `importedCache.actors`，
     * persona 规范化后一致才把候选挂到调度器的 actor 态上。比对之所以在**运行期**而不是
     * 提交时静态比对两份脚本：名字与 persona 都是运行期值（`agent()` 的实参可以是动态表达式），
     * 静态比对是第二份真相，恰是本包处处要防的（判定见 imported-cache.ts 的 `matchImportedActor`）。
     */
    createActor(siteId: string, name?: string, persona?: string | PersonaSpec): ActorId;
    ask(siteId: string, actorId: ActorId, instructions: string): Promise<unknown>;
    /** world 节点（world-read / world-run）：方法体在 engine-world.ts 的 readWorld。 */
    worldRead(siteId: string, op: WorldReadOp, args: unknown[]): Promise<unknown>;
    log(message: string): void;
    /**
     * 控制流经过了一个 `phase("…")` 标记（Boundary A 的 `enterPhase`）。与 `log` 同一副姿态：同步、无返回值、
     * 结算后 no-op、**不落 journal 行**——标记不是站点，没有 `dwf_node` 可写。
     *
     * ordinal 按名字计数，用自己的表（{@link phaseOrdinals}）：阶段名与 site id 互不消耗对方的
     * 序号（site-id stability）。
     * **每次求值都发**：`for { phase("B"); ask }` 的第二轮就是 B 的第二次进入；若「与当前阶段
     * 同名即不发」，单阶段循环体的轮次就丢了。resume 重跑会把前缀再发一遍——这里刻意不去重
     * （去重需要引擎读事件表），reducer 以 `rounds = max(rounds, ordinal)` 单调归约。
     */
    enterPhase(name: string): void;
    /** 脚本到达一处未补全的留白（Boundary A 的 `hole`）：方法体在 engine-holes.ts 的 reachHole。 */
    hole(siteId: string, name: string, prompt?: string): Promise<{
        code: string;
    }>;
    /**
     * 主代理补全一处留白（docs/execution-engine.md「The engine's part」）：一个同步步骤里换掉规格表
     * 与阶段表、写回有效脚本、记 `hole-filled`、记住代码、放行停驻的每一个分支。方法体在
     * engine-holes.ts 的 fillHole；两条 no-op（`not_waiting` / `settled`）不写不发。
     */
    fillHole(fill: HoleFill): FillHoleResult;
    /** 仍在等的留白（快照投影：事件之外还要问引擎，进程死过之后没有 promise 在等）。 */
    openHoles(): OpenHole[];
    /** 本世已补全的留白。 */
    filledHoles(): FilledHole[];
    /** 发布一条中间结果（Boundary A 的 `report`）：方法体在 engine-report.ts 的 publishReport。 */
    report(siteId: string, item: unknown, artifactId?: string): void;
    /**
     * 发布一个**内容产物**（`artifact.file` / `artifact.markdown`）：方法体在 engine-artifacts.ts
     * 的 publishContentArtifact。
     */
    publishArtifact(siteId: string, op: ArtifactContentOp, args: unknown[]): Promise<ArtifactRef>;
    /**
     * 声明一个**预置产物**（`artifact.chart` / `table` / `metrics` / `board`）：方法体在
     * engine-artifacts.ts 的 declarePresetArtifact。
     */
    declareArtifact(siteId: string, op: ArtifactPresetOp, args: unknown[]): void;
    /** 沙箱脚本成功返回顶层 artifact，结算为 completed：方法体在 engine-settlement.ts 的 settleCompleted。 */
    complete(artifact: unknown): void;
    /**
     * 外部停止：中止在飞 ask（deferred 以 Cancelled reject、补发 node-settled(cancelled)），run
     * 结算 `stopped(reason)`；已完结的 journal 条目保留（可 resume）。四个 reason 走同一条路：
     * `user` / `model`（cancel 入口传进来的 initiator）、`interrupted`（harness 的沙箱故障）、
     * `provider`（driver 经 `stopRun` 报上来的确定性模型侧错误）。`error` 只对后两者在场。
     * first-wins：已结算即忽略。方法体在 engine-settlement.ts 的 settleStopped。
     */
    stop(reason: RunStopReason, error?: WorkflowError, supersededBy?: string): void;
    /**
     * 外部失败：complete 的失败对偶。harness 用它把子进程 `{complete, ok:false, error}`（脚本抛出）、
     * 子进程崩溃、墙钟超时、NDJSON 解析失败等都归为 run 失败，
     * 而非伪装成 cancel——否则 journal 的 failure 与调用方看到的结果会分叉。
     * 走内部 failRun 路径：first-wins（对 complete/cancel/内部失败）、driver 侧取消在飞 ask、
     * journal run 状态 failed + failure_json、发 run-failure 事件、settled 结算为 failed。
     */
    fail(error: WorkflowError): void;
    /**
     * 就地改本 run **自己**的并发上界（docs/dynamic-workflow/concurrency.md「Two bounds on a run」）。
     * 一次只带 `max_concurrency` 的修订作用在活着的 run 上：同一个 runId、不铸后继、不 supersede、
     * 在飞 ask 一个不丢——这正是它与 AmendWorkflow 的全部差别，也是它存在的唯一理由。
     *
     * 返回**这次是否真的改了**。两条 no-op 都返回 false 且不写库、不发事件：run 已结算（宿主的
     * 存活判定与本调用之间的竞态——调用方据此回落到一次真正的 amend），以及新值与当前值相同。
     *
     * 改成时三件事在同一个同步步骤里发生，于是三者永远一致：整份换掉 caps（调度器现读）、写
     * `dwf_run.caps_max_concurrency`（resume 沿用行里的 caps，不落库就恢复成旧上界）、记一条
     * `run-caps-changed`。**抬高**还多一次 `pumpAll()`——上界是派发前现读的，但没有别的事件会
     * 触发重扫，排队的 ask 否则要等到下一次结算。调低不召回在飞 ask：它们照常跑完，上界只管
     * 「还能不能再放一个」。
     *
     * 钳到 `[1, 天花板]` 归调用方——天花板是宿主事实（机器核数），引擎既看不见也不该看见。
     * 这里只做落库归一，与构造函数里的 `inheritedTokens` 同一条纪律：这个数要落
     * `caps_max_concurrency`（integer not null），一个 NaN 会同时毒化列值与派发判据。
     */
    setMaxConcurrency(maxConcurrency: number): boolean;
    askSubmitAttempted(instance: InstanceRef, payload: unknown): void;
    askTurnEnded(instance: InstanceRef, finalText: string): void;
    /**
     * ask 内进度观察：**纯透传**，
     * 与 askStats → usage-updated 同一副姿态——不改调度、不进 inputHash、replay 不比对它。
     * 与用量同理，结算后到达的迟到观察只丢事件（这里没有账要入），不给已完结的 run 长尾巴。
     */
    askProgress(instance: InstanceRef, progress: AskProgress): void;
    askStats(instance: InstanceRef, stats: AskStats): void;
    askFailed(instance: InstanceRef, error: WorkflowError): void;
    /**
     * 确定性的模型侧错误：不结算节点，
     * 整个 run 以 `stopped(provider)` 停下。run 已结算后到达的调用被 `stop` 的 first-wins 忽略。
     */
    stopRun(error: WorkflowError): void;
    /** run 级停滞观察：只 record；run 已结算后到达的调用忽略。 */
    runStalled(info: RunStallInfo): void;
    askWaiting(instance: InstanceRef, info: AskWaitInfo): void;
    askExecuting(instance: InstanceRef): void;
    /**
     * 唯一一个引擎据以做决策的 driver 观察：在飞 ask 的子代理
     * 即将改写工作区 ⇒ 关导入缓存。迟到的观察（run 或节点已结算）忽略，与上面两个同一姿态。
     */
    askMutating(instance: InstanceRef): void;
    concurrencyChanged(change: ConcurrencyChange): void;
    /** run 级失败（first-wins）：方法体在 engine-settlement.ts 的 settleFailed。 */
    private failRun;
    /**
     * 站点序号的**唯一**铸造点（createActor / admitAsk 第一行 / worldRead / report / artifact 全
     * 同步经它），因此也是实例出生阶段的唯一记录点：这一行总在脚本调用的同一个 tick 里执行，
     * 而事件未必——ask 的 `node-queued` 会被 hold 规则推迟到下一个标记之后才发出。
     */
    private nextOrdinal;
    private assertRunning;
    private runError;
    /**
     * 每个事件既落 journal（dwf_event，持久）又经 driver.emit 扇出（Boundary C，实时）。
     *
     * 所有事件的唯一漏斗，出生阶段也就在这里补上（{@link stampBirthPhase}）。两条路线拿到的
     * 必须是**同一个对象**：bootstrap 的 `createJournalSequenceCapture` 按引用相等核对序号。
     */
    private record;
}
//# sourceMappingURL=engine.d.ts.map