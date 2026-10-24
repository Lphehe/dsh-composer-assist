/**
 * 留白（docs/execution-engine.md「Holes」）：脚本向主代理要一段代码，run 停在那一处等它。
 *
 * 与 escalation 不同——那个活在 driver 执行一次 ask 的内部，引擎核心看不见——留白是 Boundary A
 * 的调用：脚本自己在等它，所以引擎像拥有一次 ask 那样拥有它，少一个 driver。与 ask 又有一处
 * 根本不同：**没有 journal 行**。留白不是会自己结算出一个结果的节点，补全产出的东西已经以
 * 有效脚本的身份写在 run 行上（`updateRunScript`），resume 重放有效脚本时体内联执行、shim 不过
 * 线、`hole-reached` 不再出现。
 *
 * 本模块持有引擎的留白状态（停驻表 + 本世已补全的代码表），方法体是自由函数，经
 * {@link EngineState} 接缝读写引擎的其余私有状态；WorkflowEngine 上只留薄委托（拆分原因：
 * engine.ts 顶到 oxlint max-lines 上限 400 行）。
 */
/**
 * `hole-reached` 与通知上 prompt 的上限（字符）：与 escalation 通知的 question / context 同一
 * 把尺（docs/dynamic-workflow/transcript-and-notifications.md）。超出的截断并以 `…` 收尾。
 */
export const HOLE_PROMPT_MAX_CHARS = 4000;
/** 截断标记：占最后一个字符的位置，截后总长恰为上限。 */
const ELLIPSIS = "…";
/** 引擎的留白状态：按站点的停驻表与本世的补全记忆。纯内存、随引擎实例而生，resume 从空表起。 */
export class HoleRegistry {
    now;
    /** 站点 → 停在它下面的分支（一个站点可以同时停着好几个序号）。 */
    parked = new Map();
    /** 站点 → 本世记住的补全（后到的 `hole` 直接作答、不停驻）。 */
    filled = new Map();
    constructor(now) {
        this.now = now;
    }
    /** 站点已补全时返回记住的代码，否则 undefined。 */
    remembered(siteId) {
        return this.filled.get(siteId)?.code;
    }
    /** 把一个分支停在站点下，返回它的 promise。 */
    park(instance, name) {
        return new Promise((resolve, reject) => {
            const list = this.parked.get(instance.siteId) ?? [];
            list.push({ instance, name, since: this.now(), resolve, reject });
            this.parked.set(instance.siteId, list);
        });
    }
    /** 这个站点是否有停驻的分支或已记住的补全（`fillHole` 的 not_waiting 判据的反面）。 */
    isWaitingOrFilled(siteId) {
        return (this.parked.get(siteId)?.length ?? 0) > 0 || this.filled.has(siteId);
    }
    /** 现在的时刻（epoch 毫秒）：`hole-filled` 的 `filledAt` 与记忆里的同一个瞬间。 */
    clock() {
        return this.now();
    }
    /** 记住补全并放行站点下的每一个分支。 */
    release(siteId, code, filledAt, filledBy) {
        this.filled.set(siteId, { code, filledAt, ...(filledBy === undefined ? {} : { filledBy }) });
        const list = this.parked.get(siteId) ?? [];
        this.parked.delete(siteId);
        for (const entry of list)
            entry.resolve({ code });
    }
    /** run 结算：停驻的分支一律以结算错误拒绝（与 ask 的取消同姿态）；补全记忆保留。 */
    rejectAll(error) {
        const lists = [...this.parked.values()];
        this.parked.clear();
        for (const list of lists)
            for (const entry of list)
                entry.reject(error);
    }
    open() {
        const out = [];
        for (const list of this.parked.values()) {
            for (const entry of list) {
                out.push({
                    siteId: entry.instance.siteId,
                    ordinal: entry.instance.ordinal,
                    name: entry.name,
                    since: entry.since,
                });
            }
        }
        return out;
    }
    filledList() {
        return [...this.filled.entries()].map(([siteId, fill]) => ({
            siteId,
            filledAt: fill.filledAt,
            ...(fill.filledBy === undefined ? {} : { filledBy: fill.filledBy }),
        }));
    }
}
/** 记录前把 prompt 截到上限（超出的以 `…` 收尾，截后总长恰为上限）。 */
export function boundHolePrompt(prompt) {
    if (prompt.length <= HOLE_PROMPT_MAX_CHARS)
        return prompt;
    return prompt.slice(0, HOLE_PROMPT_MAX_CHARS - ELLIPSIS.length) + ELLIPSIS;
}
/**
 * Boundary A 的 `hole`：铸序号（`nextOrdinal` 同时盖出生阶段）、停驻、记 `hole-reached`。
 * **先停驻再记事件**：事件经 driver.emit 同步扇出，一个在 emit 里同步补全的监听者必须能命中
 * 停驻表，否则它拿到的是 `not_waiting`。已补全的站点以记住的代码立刻作答，不停驻、不记事件
 * ——resume 重放有效脚本时 shim 本就不过线，这里只是引擎侧的同一条规则。
 */
export function reachHole(state, holes, siteId, name, prompt) {
    if (state.isRunSettled())
        return Promise.reject(state.runError());
    const ordinal = state.nextOrdinal(siteId);
    const remembered = holes.remembered(siteId);
    if (remembered !== undefined)
        return Promise.resolve({ code: remembered });
    const instance = { siteId, ordinal };
    const promise = holes.park(instance, name);
    state.record({
        type: "hole-reached",
        instance,
        name,
        ...(prompt === undefined ? {} : { prompt: boundHolePrompt(prompt) }),
    });
    return promise;
}
/**
 * `fillHole` 的方法体（docs/execution-engine.md「The engine's part」）：一个同步步骤里——换规格表
 * 与阶段表（调用方负责，见 `swapTables`）、写有效脚本、记 `hole-filled`、记住代码、放行停驻的
 * 每一个分支。两条 no-op 不写不发。
 */
export function fillHole(state, holes, fill, swapTables) {
    if (state.isRunSettled())
        return { ok: false, reason: "settled" };
    if (!holes.isWaitingOrFilled(fill.siteId))
        return { ok: false, reason: "not_waiting" };
    swapTables(fill.askSpecs, fill.sitePhases);
    state.journal.updateRunScript(state.runId, fill.script.text, fill.script.hash);
    const filledAt = holes.clock();
    state.record({
        type: "hole-filled",
        siteId: fill.siteId,
        filledAt,
        ...(fill.filledBy === undefined ? {} : { filledBy: fill.filledBy }),
        phaseNames: fill.phaseNames,
        ...(fill.holes === undefined ? {} : { holes: fill.holes }),
        ...(fill.scriptPath === undefined ? {} : { scriptPath: fill.scriptPath }),
    });
    holes.release(fill.siteId, fill.code, filledAt, fill.filledBy);
    return { ok: true };
}
