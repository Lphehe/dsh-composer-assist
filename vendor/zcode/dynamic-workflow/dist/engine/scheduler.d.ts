/**
 * ask 调度器：把"每 actor FIFO + hold 规则 + 并发上限派发 + ask 结算"从引擎主体拆出，
 * 使两个文件都聚焦、可读（并满足单文件行数上限）。引擎通过 {@link SchedulerHost} 注入其
 * 依赖（driver、caps、序号分配、run 级失败），调度器只负责 ask 生命周期，不管 run 生命周期。
 *
 * 关键规则见 engine.ts 顶部说明：命中短路、actorSeq 准入顺序、replay 的 hold 规则、串行 actor。
 *
 * 内部类型与 SchedulerHost 在 scheduler-types.ts；submit / turn 的向上回报处理在 scheduler-submit.ts
 * （拆分原因：oxlint max-lines 上限 400 行）。SchedulerHost 在此原地再导出，导入路径不变。
 * replay 命中的哈希不一致错误 {@link hashMismatch} 在 hash-mismatch.ts（同一个理由）。
 */
import { type ImportedActorState } from "./imported-cache.js";
import { type Actor, type SchedulerHost } from "./scheduler-types.js";
import type { ActorId, ActorRef, AskSpec, AskStats, InstanceRef, NodeRecord, PersonaSpec } from "./types.js";
import { WorkflowError } from "./types.js";
export type { SchedulerHost } from "./scheduler-types.js";
export declare class AskScheduler {
    private readonly host;
    private readonly actors;
    private readonly actorOrder;
    private readonly liveNodes;
    /**
     * 「转录早于本次派发」的 ask 实例（`siteId@ordinal`）：续跑前驱在飞 ask 的，以及 resume 时
     * 据 running 行重新派发的。它们落 journal 的 stats 要抹掉 `worldToolCalls`，见 {@link journaledStats}。
     * 结算后不清理——迟到的 stats 回填还要查它。
     */
    private readonly priorTranscriptAsks;
    /**
     * 每个 actor 在 journal 里已记录的 ask 行数（`siteId@ordinal` → 行数），由引擎的 resume 分支用它
     * 已经读好的 ask 行一次建好（{@link seedRecordedAsks}）。修复原因：registerActor 原先每建一个
     * actor 就把整张节点表读一遍再过滤——宽扇出下是 O(actor × 行) 次解码，而且解的是每条 ask 的回答
     * 与每条 report item。一次建表是对的：actor 总在它的第一次 ask 之前注册，所以注册那一刻 journal
     * 里属于它的 ask 行只可能来自前几世；全新 run 的表为空。
     */
    private readonly recordedAsks;
    private activeAsks;
    /** scheduler-submit.ts 的自由函数经它查 live 节点、按结果结算（见 {@link SubmitSeam}）。 */
    private readonly submitSeam;
    constructor(host: SchedulerHost);
    private get journal();
    /** resume 时喂入本 run 已落库的 ask 行（可不带结果），建好 {@link recordedAsks}。 */
    seedRecordedAsks(askRows: readonly NodeRecord[]): void;
    hasActor(id: ActorId): boolean;
    /**
     * 注册一个 actor（创建站点 × 序号）。`imported` 是 amend-resume 的导入候选：引擎已在
     * createActor 里按有效名 + 规范化 persona 匹配过，调度器只负责消费它。
     */
    registerActor(ref: ActorRef, id: ActorId, name: string | undefined, persona: PersonaSpec, imported?: ImportedActorState): Actor;
    /** 受理一次 ask：完结命中短路（走 hold 规则），running 命中或未命中则 live 派发。 */
    admitAsk(siteId: string, actorId: ActorId, instructions: string, spec: AskSpec): Promise<unknown>;
    /**
     * 把一个 ask 作为 live 节点准入：建节点、准入即落 running 记录、入队并记事件。
     *
     * `priorTranscript` 为真表示这一条不是从空转录开跑的（续跑前驱在飞 ask，或 resume 据 running
     * 行重新派发）——它只影响 stats 怎么落库，见 {@link journaledStats}。
     */
    private admitLive;
    /**
     * fresh ask 准入时问一次导入缓存（amend-resume）。命中即 **cached settle** 并返回 true
     * （调用方不再 live）；判定与分歧记账全在 {@link ImportedActorState}。
     *
     * 命中写一行**真** dwf_node，只发 `node-settled cached:true`——与 replay 命中的
     * {@link releaseCachedAsk} 同一副姿态：不发 node-queued / node-dispatched，
     * 不入 liveQueue，不建会话，不占 `actor.current`。那条结算因此就是出生事件，重发出生事实，
     * 并点名前驱里持有这段交换的会话（{@link cachedAskFacts}）。
     */
    private tryImportedSettle;
    /** submit_result 到达：方法体在 scheduler-submit.ts 的 handleSubmitAttempted。 */
    submitAttempted(instance: InstanceRef, payload: unknown): void;
    /** turn 结束（无 submit）：方法体在 scheduler-submit.ts 的 handleTurnEnded。 */
    turnEnded(instance: InstanceRef, finalText: string): void;
    noteStats(instance: InstanceRef, stats: AskStats): void;
    /**
     * 落 journal 的 stats：**转录早于本次派发**的 ask 抹掉 `worldToolCalls`。
     *
     * 根因：driver 的工具计数器是内存态、每次 ask 起跑时清零，所以接着一段既有转录跑的 ask 只数
     * 得到自己这几轮，转录里原有的工具调用一个也数不到。少报的后果不是账目不准（那是 tokens 的
     * 事），而是**纯度判据被污染**：一个报 0 的 ask 会被后来的修订当成纯条目，在关门之后仍从缓存
     * 结算——而它其实碰过工作区。缺席这个键本就表示「碰过」（保守读法），所以抹掉才是诚实记录。
     * tokens / toolCalls / turns 照记：它们是用量，不是纯度声明。
     */
    private journaledStats;
    failed(instance: InstanceRef, error: WorkflowError): void;
    /** 该实例是否仍是在飞（已准入、未结算）的 live ask——限流观察事件只对这样的节点有意义。 */
    isLive(instance: InstanceRef): boolean;
    /** 在飞 ask 所属子代理的有效名（关门事件里点名用）；不在飞即 undefined。 */
    liveActorName(instance: InstanceRef): string | undefined;
    /** 中止所有在飞 ask：run 取消/失败时用。emitCancelled 为真时补发 node-settled(cancelled)。 */
    abortInFlight(error: WorkflowError, emitCancelled: boolean): void;
    private drainAdmission;
    /**
     * 命中记录的 ask：按 journal 记下的**结算次序**释放（docs/execution-engine.md
     * 「Replaying the settle order」）。hold 规则定的是同一个 actor 内的准入次序，跨 actor 的
     * 完成次序要这一道闸才回得来——扇出分支在 await 之后的每一次 journal 调用都按它编号。
     */
    private releaseCachedAsk;
    private settleCachedAsk;
    /**
     * 重扫每个 actor 的待派发队列。公开面**只为一个调用方**：引擎在抬高本 run 的并发上界之后
     * 调它（docs/dynamic-workflow/concurrency.md「Two bounds on a run」）。上界本身是
     * {@link pumpActor} 每次派发前现读的，但没有任何别的事件会触发一次重扫——排队的 ask
     * 否则要一直等到下一次结算才动，而「抬高之后立刻多跑几个」正是这条命令买的东西。
     */
    pumpAll(): void;
    private pumpActor;
    private dispatch;
    private ensureSession;
    private settleOk;
    private settleFailed;
    private finishLiveNode;
    private nodeRecordFor;
}
//# sourceMappingURL=scheduler.d.ts.map