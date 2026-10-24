/**
 * 自适应并发控制器：一个 provider key 上的纯 AIMD 状态机。
 *
 * 纯包纪律：不读时钟、不做 I/O——`now`（ms since epoch）一律由调用方传入；本类只回答
 * 「cap 现在是多少、能不能准入、这次信号让 cap 变了没有」。谁喂信号、谁排队（bootstrap 的进程级
 * 治理器）都在包外。
 *
 * 度量单位是**模型请求**（每一次尝试）：`inFlight` = 已准入、尚未 release 的请求数。
 * 没有 ask 级计数——一个子代理同时只有一个请求在飞，「≤ N 个请求」与「≤ N 个子代理在跑」等价。
 *
 * 批次阻尼靠 **epoch**：每次准入记下当时的 epoch，每次限流裁决 epoch += 1。一个 429 只在
 * 它的请求是在**当前** cap 下发出（epoch 相同）时才评价当前 cap；旧 epoch 的 429 评价的是一个已被
 * 砍掉的 cap，只清 streak、刷新 cooldown。成功同理：只有当前 epoch 的成功计入 streak。
 *
 * 信号方法都返回本次信号引起的 cap 变化列表（通常 0 或 1 条；空闲重置紧接着一次限流时会是 2 条），
 * 调用方原样扇出成 `concurrency-changed` 事件。
 */
import type { ConcurrencyChange, ConcurrencyChangeReason } from "./types.js";
/**
 * 限流即 `cap = max(FLOOR, floor(cap × 0.75))`（系数从 0.5 改为 0.75）：
 * 减半对「只多了一两个」的越界反应过猛——闸门是请求级的，一次 429 说明 cap 高了，很少说明高了一倍。
 */
export declare const CONCURRENCY_DECREASE_FACTOR = 0.75;
/** 加性递增步长。 */
export declare const CONCURRENCY_INCREASE_STEP = 1;
/**
 * 每 +1 需要的连续成功模型请求数 K。只有一档。该值从 40 降到 4：
 * 探测失败的代价只是一个请求撞一次 429 然后退回 `lastGood`（已证明可用的水位），不值得用 40 次
 * 成功去换一次试探。
 */
export declare const CONCURRENCY_INCREASE_AFTER_SUCCESSES = 4;
/** 永远至少有一个探针在跑。 */
export declare const CONCURRENCY_FLOOR = 1;
/** 某 key 空闲这么久（且无在飞）后遗忘学到的 cap，回起点 `initial`（决策 20）。 */
export declare const CONCURRENCY_IDLE_RESET_MS = 300000;
/** 会令 cap 减少的限流类原因。 */
export type ConcurrencyThrottleReason = Extract<ConcurrencyChangeReason, "rate_limited" | "provider_overloaded" | "offpeak_queued">;
/** 控制器的只读快照（供测试断言与治理器投影 run 头的 `concurrency`）。 */
export interface ConcurrencyControllerSnapshot {
    readonly key: string;
    /** 起点与空闲重置的落点：默认并发 D。 */
    readonly initial: number;
    /** 自动增长的上界（治理器定，可随时挪动；恒 ≥ initial）。 */
    readonly growthLimit: number;
    readonly cap: number;
    /** 限流裁决计数；准入时发给请求，请求结束时带回来比对。 */
    readonly epoch: number;
    readonly inFlight: number;
    readonly waiters: number;
    readonly successStreak: number;
    readonly cooldownUntil?: number;
    readonly lastRequestAt?: number;
    readonly lastGood?: number;
    readonly lastBad?: number;
    /** 最近一次被拒（不论 epoch）的时刻；五分钟内有它就不起跳（{@link ConcurrencyController.seed}）。 */
    readonly lastThrottledAt?: number;
}
export declare class ConcurrencyController {
    readonly key: string;
    readonly initial: number;
    private cap;
    private growthLimit_;
    private epoch;
    private inFlight;
    private waiters_;
    private successStreak;
    private cooldownUntil?;
    private lastRequestAt?;
    private lastGood?;
    private lastBad?;
    private lastThrottledAt?;
    /**
     * @param key provider key（`${providerId}/${modelId}`），只用于填进 change 事件——控制器自己
     *   对它无感。放在构造参数而不是每次信号传入：一个控制器只服务一个 key，这是身份不是参数。
     * @param initial 默认并发 D（docs/dynamic-workflow/concurrency.md「Two bounds on a run」）：cap 的
     *   起点，也是空闲重置的落点。它**不是**上界。
     * @param growthLimit 自动增长的上界；缺省即 `initial`（只回落、不越过起点的旧行为）。治理器按
     *   `max(2D, 用过这个 key 的在飞 run 的最大上界)` 给出并随时经 {@link setGrowthLimit} 挪动。
     */
    constructor(key: string, initial: number, growthLimit?: number);
    snapshot(): ConcurrencyControllerSnapshot;
    /**
     * 闸门（准入条件）：在飞请求数低于 cap 且不在 Retry-After 冷却中。纯查询，不做空闲重置——
     * 调用方（治理器）在准入路径上先调 {@link observe}（准入也是一次「信号」，空闲一小时后的第一个
     * run 要立刻从起点 `initial` 起步，决策 20）。
     */
    canAdmit(now: number): boolean;
    /** 只做空闲重置检查的「空信号」（准入前、observer 放行前用）。 */
    observe(now: number): ConcurrencyChange[];
    /**
     * 一个请求被准入：`inFlight++`、刷新 `lastRequestAt`，返回它所属的 epoch（请求结束时带回来）。
     * 不做空闲重置——调用方已在 {@link observe} 里做过；这里若再做，一个刚被 observe 判定「不空闲」
     * 的准入不可能变成空闲。
     */
    admitted(now: number): number;
    /**
     * 一个请求成功结束：`inFlight--`；只有**当前 epoch** 的成功使
     * `successStreak++`——旧 epoch 的成功证明的是旧 cap 下退避压低后的负载，不是新 cap 可以更高。
     * `successStreak ≥ K` 即**证明**当前 cap 可用：`lastGood = max(lastGood, cap)`（决策 40：只有
     * 完成的 streak 能设 lastGood，减少 cap 不能）。再满足有等待者 **且** `cap < growthLimit` → +1。
     * 无等待者时 streak 照累积但不兑现（决策 15）。
     */
    succeeded(now: number, epoch: number): ConcurrencyChange[];
    /**
     * 被限流/过载。一律 `inFlight--`、清 streak、带 Retry-After 则把 cooldown
     * 推到更晚者。
     *
     * 只有 `epoch === 当前 epoch` 的 429 才动 cap：它是在当前 cap 下发出的请求，是对当前 cap 的评价；
     * 旧 epoch 的 429 忽略（不发事件）。当前 epoch 的分两档：在 `lastGood` **之上**探测被限流 → 退回
     * `lastGood`（记 `lastBad`，不按系数减）；否则（`lastGood` 缺席或 `cap ≤ lastGood`：墙下移了）→
     * `cap = max(FLOOR, floor(cap × 0.75))`，记 `lastBad = 旧 cap`，并**清掉** `lastGood`——它刚被
     * 证伪，而新 cap 还没被任何 streak 证明（减 cap 不设 lastGood）。两档之后 `epoch += 1`——
     * 即便 cap 已在地板、数值没变，也翻一页：同一批请求只能触发一次裁决。
     */
    throttled(now: number, epoch: number, reason: ConcurrencyThrottleReason, retryAfterMs?: number): ConcurrencyChange[];
    /** 瞬态但非限流的失败（timeout / 5xx / 网络）：`inFlight--`、清 streak，cap 不动。 */
    failedTransient(now: number): ConcurrencyChange[];
    /** 一个请求以永久失败 / 取消终结，或 ticket 只见 release 没见终结事件：只做 `inFlight--`。 */
    ended(now: number): ConcurrencyChange[];
    /** 治理器在队列变化时喂入的等待者数（有需求才加 cap）。 */
    waiters(now: number, count: number): ConcurrencyChange[];
    /**
     * 挪动自动增长的上界（docs/dynamic-workflow/concurrency.md「Increase」）。这是控制器里唯一一个
     * 不归它自己管的数：治理器按「2D 与用过这个 key 的在飞 run 的最大上界取大」算出来，run 来去、
     * retune 都会让它变。恒夹到 ≥ initial。
     *
     * 抬高什么都不立刻改：cap 照旧一级一级爬。压低到 cap 之下则当场把 cap 拉到新上界并发一条
     * `limit_lowered`——否则一个为大 run 学到的高 cap 会留给之后的默认 run 共用，直到空闲重置。
     * 同时夹 `lastGood`、清 streak、翻 epoch：旧 cap 下发出的请求撞的 429 不是对新 cap 的裁决。
     */
    setGrowthLimit(now: number, limit: number): ConcurrencyChange[];
    /**
     * 起跳（docs/dynamic-workflow/concurrency.md「Seeding」）：用户把一个 run 的上界调高时，治理器请
     * cap 直接跳到 `min(target, growthLimit)`，而不是每 K 次成功爬一级——从 8 爬到 32 要约 96 次
     * 成功，用户看到的是「设置没生效」。
     *
     * 清 `lastGood`：起跳点是新的起点，不是在已证明水位之上的探测；否则第一次 429 会一路退回旧的
     * 已证明水位，而不是按系数减（32 → 24 → 18 …）。同时清 `lastBad`、清 streak、翻 epoch。
     *
     * 两种情况不跳：目标不高于 cap；五分钟内（空闲重置同一窗口）有过任何一次拒绝——那时起跳就是
     * 明知故犯地对着刚撞过的墙再冲一波，cap 改为照常一级一级爬。
     */
    seed(now: number, target: number): ConcurrencyChange[];
    /**
     * 空闲重置（决策 20）：`now − lastRequestAt ≥ IDLE_RESET_MS` 且无在飞 → cap 回起点 `initial`，
     * 清 streak / cooldown / lastGood / lastBad，epoch += 1。惰性发生在任一信号到达时（无定时器）。
     */
    private idleReset;
    private change;
}
//# sourceMappingURL=concurrency.d.ts.map