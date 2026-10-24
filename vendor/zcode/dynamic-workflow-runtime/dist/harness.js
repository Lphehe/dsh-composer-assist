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
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { lowerWorkflowScript, WorkflowEngine, WorkflowError, } from "@zcode/dynamic-workflow";
import { renderChildEntry } from "./child-source.js";
import { writeChildEntryFile } from "./child-entry-file.js";
const DEFAULT_MAX_OLD_SPACE_MB = 256;
const STDERR_LIMIT = 64 * 1024;
/**
 * 跑一份 workflow 脚本至结算。返回引擎的 {@link RunSettlement}。
 * 失败一等公民，但分两类：脚本抛错是脚本之错，
 * 归一成 `{status:"errored", error}`；子进程无法启动 / 崩溃 / 墙钟超时 / 协议损坏是宿主侧故障，
 * 重跑很可能就好，归一成 `{status:"stopped", reason:"interrupted", error}`（可 resume）。
 * 两者都绝不静默吞掉。
 */
export async function runWorkflowScript(options) {
    const lowered = resolveLowered(options);
    const runId = options.runId ?? "run";
    // sink 晚绑定：引擎在 driver 之后构造，但 driver 需要 sink 回报——用转发代理打破环依赖。
    let engine;
    const sink = {
        askSubmitAttempted: (instance, payload) => engine.askSubmitAttempted(instance, payload),
        askTurnEnded: (instance, finalText) => engine.askTurnEnded(instance, finalText),
        askProgress: (instance, progress) => engine.askProgress(instance, progress),
        askStats: (instance, stats) => engine.askStats(instance, stats),
        askFailed: (instance, error) => engine.askFailed(instance, error),
        // 确定性模型侧错误 → 整个 run 停下，同样只是转发。
        stopRun: (error) => engine.stopRun(error),
        // 自适应并发的三个纯观察与 run 级停滞观察，同样只是转发。
        askWaiting: (instance, info) => engine.askWaiting(instance, info),
        askExecuting: (instance) => engine.askExecuting(instance),
        // 唯一会让引擎做决策的观察（关导入缓存），同样只是转发。
        askMutating: (instance) => engine.askMutating(instance),
        concurrencyChanged: (change) => engine.concurrencyChanged(change),
        runStalled: (info) => engine.runStalled(info),
    };
    const driver = options.makeDriver(sink);
    engine = new WorkflowEngine({
        runId,
        driver,
        caps: options.caps,
        askSpecs: options.askSpecs,
        validate: options.validate,
        ...(options.sitePhases === undefined ? {} : { sitePhases: options.sitePhases }),
        // 元数据 verbatim 转交，缺省保持缺席（不落成 undefined 键）。cwd 与子进程实际使用的
        // 是同一个值，所以这里也记 process.cwd() 的兜底——落库的 cwd 就是 run 真正跑的目录。
        ...(options.scriptText === undefined ? {} : { scriptText: options.scriptText }),
        ...(options.name === undefined ? {} : { name: options.name }),
        ...(options.args === undefined ? {} : { args: options.args }),
        ...(options.scriptHash === undefined ? {} : { scriptHash: options.scriptHash }),
        ...(options.parentSessionId === undefined ? {} : { parentSessionId: options.parentSessionId }),
        ...(options.toolCallId === undefined ? {} : { toolCallId: options.toolCallId }),
        ...(options.resumedFrom === undefined ? {} : { resumedFrom: options.resumedFrom }),
        ...(options.launch === undefined ? {} : { launch: options.launch }),
        ...(options.importedCache === undefined ? {} : { importedCache: options.importedCache }),
        ...(options.inheritedTokens === undefined ? {} : { inheritedTokens: options.inheritedTokens }),
        cwd: options.cwd ?? process.cwd(),
    });
    // 控制面一构造好就绑：run 从第一条事件起就可被改设置，而**不必**等子进程起来——下面那条
    // spawn 失败路径也经引擎结算，句柄在那之后照样安全（命令自己的 settled 判定负责收口）。
    options.control?.bind(engine);
    const maxOldSpaceSizeMb = options.maxOldSpaceSizeMb ?? DEFAULT_MAX_OLD_SPACE_MB;
    const cwd = options.cwd ?? process.cwd();
    const payload = {
        lowered,
        // 实参只在启动时过界一次（run 生命周期内是常量）。
        ...(options.args === undefined ? {} : { args: options.args }),
        // 堆上限随 payload 进入口文件，只为 argsPrefix 路径服务：那条路上没有 Node 旗标可传，
        // 入口文件只能自己 best-effort 设。缺省路径由真旗标生效，入口文件看到旗标就跳过。
        maxOldSpaceSizeMb,
    };
    // payload 不过命令行：Windows 的命令行上限 32,767 字符，整份 lowered 脚本放上去一过约 18 KB
    // 就 `spawn ENAMETOOLONG`。写成入口文件，
    // argv 只剩一条路径，长度与脚本大小无关。
    let child;
    try {
        const entry = writeChildEntryFile({
            cwd,
            runId,
            source: renderChildEntry(payload, { runId }),
            ...(options.onWarning === undefined ? {} : { onWarning: options.onWarning }),
        });
        child = spawn(process.execPath, options.childSpawn === undefined
            ? [`--max-old-space-size=${maxOldSpaceSizeMb}`, entry.path]
            : [...options.childSpawn.argsPrefix, entry.path], {
            cwd,
            stdio: ["pipe", "pipe", "pipe"],
            // 桌面端 agent 由 Electron Helper 运行（process.execPath 指向 Helper），而 CLI
            // 启动时会把 ELECTRON_RUN_AS_NODE 从自身 env sanitize 掉。不显式带上它，子进程会按完整
            // Electron/Chromium 应用启动并卡在 GPU 初始化——永远沉默也不退出，run 卡死在 run-started。
            // 纯 Node 的 execPath 下该变量无效，无副作用（同 official-plugin-runtime.ts 的处理）。
            // 两条 spawn 策略都要带：桌面打包态同样可能走 argsPrefix 路径。
            env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
        });
    }
    catch (cause) {
        // Node 只把 EACCES/EAGAIN/EMFILE/ENFILE/ENOENT 转成 error
        // 事件，其余 spawn 失败（ENAMETOOLONG、E2BIG…）**同步抛**。此时引擎已构造、journal 行已以
        // running 落库；让异常直接冒出去会绕过引擎结算——注册表记成终态，journal 行却永远
        // running，随后的 resume_from 被「has not settled yet」拒绝。入口文件写不下（两个目录都
        // 失败）同理。一律经引擎结算 stopped(interrupted)：宿主侧故障，可 resume。
        const message = cause instanceof Error ? cause.message : String(cause);
        engine.stop("interrupted", new WorkflowError("Interrupted", `Could not start the workflow sandbox process: ${message}`, {
            cause,
        }));
        return engine.settled;
    }
    return bridge({ child, engine, runId, signal: options.signal, timeoutMs: options.timeoutMs });
}
/** 解析 lowered 体：优先 `lowered`，否则 lower `scriptText`（脏脚本抛错，不启动子进程）。 */
function resolveLowered(options) {
    if (options.lowered !== undefined)
        return options.lowered;
    if (options.scriptText === undefined) {
        throw new Error("runWorkflowScript: pass either scriptText or lowered");
    }
    const result = lowerWorkflowScript(options.scriptText);
    if (!result.ok || result.lowered === undefined) {
        const detail = result.diagnostics.map((d) => `${d.line}:${d.column} ${d.message}`).join("; ");
        throw new Error(`runWorkflowScript: the script failed compilation/analysis and is not run degraded: ${detail}`);
    }
    return result.lowered.code;
}
/**
 * NDJSON 桥接 + 生命周期收敛。single-writer finalize：无论从引擎结算、子进程退出、超时还是
 * abort 触达，第一个到达者胜出，随后 kill 子进程并兑现结果。
 */
function bridge(deps) {
    const { child, engine, runId, signal, timeoutMs } = deps;
    // local#N（child-local 句柄）→ engine ActorId 的映射；stdio FIFO + 同步 create-actor 处理保证
    // 任何引用某句柄的 ask 到达前，该映射已就绪。
    const actorMap = new Map();
    let stderr = "";
    let finalized = false;
    let timer;
    let reader;
    return new Promise((resolve) => {
        const finalize = (settlement) => {
            if (finalized)
                return;
            finalized = true;
            if (timer !== undefined)
                clearTimeout(timer);
            if (signal !== undefined)
                signal.removeEventListener("abort", onAbort);
            reader?.close();
            if (child.exitCode === null && child.signalCode === null)
                child.kill();
            resolve(settlement);
        };
        // 终结失败（脚本抛错 / 子进程崩溃 / 超时 / 协议损坏）都是 run 失败：交给引擎的公有 fail()，
        // 由它 first-wins 结算、driver 侧取消在飞 ask、journal 记 failed + failure_json——run 的裁决
        // 归引擎所有，journal 与调用方看到的结果不分叉。子进程清理由 finalize（经 engine.settled）负责。
        const failRun = (error) => {
            if (finalized)
                return;
            engine.fail(error);
        };
        // 宿主侧故障（沙箱崩溃 / 超时 / 协议损坏）：stopped(interrupted)，可 resume。
        const interruptRun = (message, cause) => {
            if (finalized)
                return;
            engine.stop("interrupted", new WorkflowError("Interrupted", message, cause === undefined ? undefined : { cause }));
        };
        // abort 是唯一的"真取消"：走 engine.stop(initiator)，结算 stopped。initiator 经
        // `AbortController.abort(reason)` 过来：字面 "model"、amend 路径的
        // `{ superseded: newRunId }`（后继 id 随原因同一笔落库）、字面 "interrupted"（宿主 App
        // 关闭，见下），其余一律 "user"。
        function onAbort() {
            if (finalized)
                return;
            const reason = signal?.reason;
            const supersededBy = readSupersededBy(reason);
            if (supersededBy !== undefined) {
                engine.stop("superseded", undefined, supersededBy);
                return;
            }
            // 宿主主动停下自己拥有的 run（run service 的 close()）。它不是用户取消：带 Interrupted 失败编码落库，与超时 /
            // 沙箱崩溃同一族——stopped(interrupted) 可 resume，而 stopped(user) 在 UI 上读作
            // 「用户按了停止」。错误文本指名 run 与成因，下一次激活时详情页据它解释这一行。
            if (reason === "interrupted") {
                engine.stop("interrupted", new WorkflowError("Interrupted", `dynamic workflow run ${runId} was interrupted: the owning session closed before the run settled`));
                return;
            }
            engine.stop(reason === "model" ? "model" : "user");
        }
        // 一切结算（complete / fail / stop / 引擎内部 cap 失败）都经 engine.settled 冒出到 finalize。
        void engine.settled.then(finalize);
        if (signal !== undefined) {
            if (signal.aborted) {
                onAbort();
                return;
            }
            signal.addEventListener("abort", onAbort, { once: true });
        }
        if (timeoutMs !== undefined) {
            timer = setTimeout(() => {
                interruptRun(`The workflow sandbox process exceeded its wall-clock timeout of ${timeoutMs}ms`);
            }, timeoutMs);
            timer.unref?.();
        }
        child.stderr?.on("data", (chunk) => {
            stderr = trimTail(stderr + chunk.toString("utf8"), STDERR_LIMIT);
        });
        // 子进程退出后仍可能有 response 待写：给 stdin 挂 error 监听，避免 EPIPE 冒成未捕获异常。
        child.stdin?.on("error", () => undefined);
        reader = createInterface({ input: child.stdout });
        reader.on("line", (line) => {
            if (line.trim().length === 0)
                return;
            let message;
            try {
                message = JSON.parse(line);
            }
            catch (cause) {
                // 子进程行 JSON 损坏：暴露而非吞掉。
                interruptRun(`The workflow sandbox process emitted a line that is not valid NDJSON: ${line}`, cause);
                return;
            }
            handleChildMessage(message, { engine, actorMap, child, failRun });
        });
        child.on("error", (error) => {
            interruptRun(`Could not start the workflow sandbox process: ${error.message}`, error);
        });
        child.on("close", (code, sig) => {
            if (finalized)
                return;
            // 子进程退出但引擎未结算：崩溃/被杀而无 complete。以 stderr 归因。
            const reason = stderr.trim().length > 0
                ? stderr.trim()
                : `The workflow sandbox process exited (code=${code}, signal=${sig}) before completing`;
            interruptRun(reason);
        });
    });
}
/** 分发一条 child→parent 消息。ask/world-read 异步桥接到引擎并回 response（搭载最新预算）。 */
function handleChildMessage(message, deps) {
    const { engine, actorMap, child, failRun } = deps;
    switch (message.kind) {
        case "create-actor": {
            // 同步处理：在任何引用该句柄的 ask 之前把映射建好（stdio FIFO 前提）。createActor 是纯同步的，
            // 若 run 已结算会同步抛错——此时没有 response 通道，捕获后归为 run 失败（多为无害的收尾竞态）。
            try {
                const actorId = engine.createActor(message.siteId, message.name, message.persona);
                actorMap.set(message.localId, actorId);
            }
            catch (cause) {
                failRun(cause instanceof WorkflowError
                    ? cause
                    : new WorkflowError("DriverError", `createActor failed at site ${message.siteId}`, {
                        cause,
                    }));
            }
            return;
        }
        case "event":
            // 同步分派，与 log 一致：事件通道的 FIFO 顺序对 report 与 declare-artifact 都是承重的
            // （父进程 journal 的就是到达的东西，而一条打了标签的 report 必须晚于它的声明落库），
            // 异步化会让到达顺序与 journal 顺序脱钩。
            if (message.type === "report") {
                engine.report(message.siteId, message.item, message.artifactId);
            }
            else if (message.type === "declare-artifact") {
                engine.declareArtifact(message.siteId, message.op, message.args);
            }
            else if (message.type === "phase-entered") {
                engine.enterPhase(message.name);
            }
            else {
                engine.log(message.message);
            }
            return;
        case "complete":
            if (message.ok) {
                engine.complete(message.value);
            }
            else {
                // 脚本抛错：run 失败（错误明细来自沙箱）。
                const err = message.error;
                failRun(new WorkflowError("DriverError", err?.message ?? "The workflow script threw an error", {
                    cause: err?.stack ?? err?.name,
                }));
            }
            return;
        case "request":
            handleRequest(message, { engine, actorMap, child, failRun });
            return;
        default: {
            const _exhaustive = message;
            void _exhaustive;
        }
    }
}
/** 桥接一次需应答的 host 调用（ask / world-read / publish-artifact / hole）到引擎，settle 后回 response。 */
function handleRequest(message, deps) {
    const { engine, actorMap, child } = deps;
    const respond = (ok, value, error) => {
        const response = {
            kind: "response",
            id: message.id,
            ok,
            ...(ok ? { value } : { error: toWireError(error) }),
        };
        // 子进程可能已退出（取消/失败收尾）：仅在可写时写，EPIPE 等 I/O 竞态吞在此边界（run 已在结算）。
        const stdin = child.stdin;
        if (stdin === null || !stdin.writable)
            return;
        stdin.write(`${JSON.stringify(response)}\n`, () => undefined);
    };
    let promise;
    if (message.type === "ask") {
        const actorId = actorMap.get(message.actor ?? "");
        if (actorId === undefined) {
            // 映射缺失（理应不会发生：FIFO 保证）——归一成 UnknownActor 结构化拒绝，不静默。
            respond(false, undefined, new WorkflowError("UnknownActor", `Unknown subagent handle: ${message.actor}`));
            return;
        }
        promise = engine.ask(message.siteId, actorId, message.instructions ?? "");
    }
    else if (message.type === "publish-artifact") {
        const op = message.artifactOp;
        if (op === undefined) {
            // 缺 op 是接线错误（lowering 恒填它）。**不编一个默认值**：一个被当成 file 处理的
            // markdown 发布，错误会出现在离故障点很远的地方。归一成结构化拒绝，脚本看得见。
            respond(false, undefined, new WorkflowError("DriverError", `publish-artifact request is missing artifactOp (site ${message.siteId})`));
            return;
        }
        promise = engine.publishArtifact(message.siteId, op, message.args ?? []);
    }
    else if (message.type === "hole") {
        // 留白：引擎把 promise 停在站点下，主代理经控制面 fillHole 放行后才有 `{code}` 可答；
        // 在此之前它就是一条在飞请求（docs/execution-engine.md「The vm cell」）。
        promise = engine.hole(message.siteId, message.name ?? "", message.prompt);
    }
    else {
        // op/args 原样转交引擎：本层不看 op、不校验元数（那是 driver 的职责）。缺失 args 归一为空数组，
        // 让 driver 的实参校验大声拒绝，而不是在这里悄悄编一个默认值。
        promise = engine.worldRead(message.siteId, message.op ?? "read", message.args ?? []);
    }
    promise.then((value) => respond(true, value), (cause) => {
        const error = cause instanceof WorkflowError
            ? cause
            : new WorkflowError("DriverError", cause instanceof Error ? cause.message : String(cause), { cause });
        respond(false, undefined, error);
    });
}
/** WorkflowError → 线形态（保留 code/violations/finalText，供沙箱脚本 try/catch 结构化处理）。 */
function toWireError(error) {
    if (error === undefined)
        return { name: "Error", message: "unknown error" };
    const wire = {
        name: error.name,
        message: error.message,
        code: error.code,
    };
    if (error.violations !== undefined)
        wire.violations = error.violations;
    if (error.finalText !== undefined)
        wire.finalText = error.finalText;
    return wire;
}
/** 保留字符串尾部 limit 字节内的内容（stderr 截断）。 */
function trimTail(value, limit) {
    if (Buffer.byteLength(value, "utf8") <= limit)
        return value;
    return value.slice(-limit);
}
/** abort reason 是 `{ superseded: <runId> }` 时取出后继 id；其余形状返回 undefined。 */
function readSupersededBy(reason) {
    if (typeof reason !== "object" || reason === null)
        return undefined;
    const value = reason.superseded;
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
