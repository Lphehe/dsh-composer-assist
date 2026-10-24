/**
 * engine.ts 顶到 oxlint max-lines 上限（400 行），把**用户面产物**（`artifact.*`）的
 * 发布 / 声明 / 准入 / 结算 / resume 恢复拆到本文件；公开面仍从 engine.ts 导出。
 *
 * ⚠ 术语：以下一律指**用户面产物**（脚本发布给用户看的产出），不是 RunSettlement.artifact。
 * 自由函数经 {@link EngineState} 接缝读写引擎状态；WorkflowEngine 上的同名方法只是薄委托。
 */
import { type ArtifactContentOp, type ArtifactPresetOp } from "../facade/registry.js";
import type { EngineState } from "./engine-state.js";
import type { ArtifactRef } from "./types.js";
/**
 * 发布一个**内容产物**（`artifact.file` / `artifact.markdown`）。效应族：经 driver 拷字节进
 * store，成功兑现 {@link ArtifactRef}，失败**可 catch 地拒绝**——脚本的门控习语是
 * `try { await artifact.file(...) } catch { …让子代理补写… }`。
 *
 * 顺序：
 * 1. `nextOrdinal` → journal 命中？命中即短路：比 inputHash，成功记录返回它的 ArtifactRef，
 *    **失败记录按记录重新拒绝**（resume 是崩溃恢复，不是复验：一次失败的发布在恢复后仍然
 *    是那次失败，重跑它会让脚本的 catch 分支走两次不同的路）。命中一律**不重发事件**（同 report）。
 * 2. 未命中：种类归属 → id 数上限 → 版本数上限，三条都是节点级拒绝（有 promise 可拒）。
 * 3. 版本号在 dispatch **之前**算好并传给 driver（store 的 toolCallId 里要带它，每版一份字节）。
 * 4. `putNode(running)` → driver → 成功 `putNode(completed)` + `artifact-published`；
 *    失败 `putNode(failed)` + `artifact-failed` → reject。
 *
 * 两条路都**不发任何节点生命周期事件**（node-queued / dispatched / settled）：产物站点在两张
 * 图里都不是节点，一条 node-settled 落在这样的站点上会被投影归约进 `nodes[]`，在 run 面板里
 * 变成一个无从解释的未知节点。
 */
export declare function publishContentArtifact(state: EngineState, siteId: string, op: ArtifactContentOp, args: unknown[]): Promise<ArtifactRef>;
/**
 * 声明一个**预置产物**（`artifact.chart` / `table` / `metrics` / `board`）。声明族：同步、
 * 无返回值、**不经 driver**——一个声明没有可等的东西。
 *
 * 顺序：`nextOrdinal` → 命中即返回 → spec 形状校验
 * → 同 id 既有声明？相同 canonical ⇒ 幂等 no-op（不落新行、不发事件）；不同 ⇒ failRun
 * → 上限 → `putNode(completed)` + `artifact-published`。
 *
 * 三种失败（spec 非法 / 同 id 异 spec / 超上限）全是 failRun 而不是拒绝：void 返回没有拒绝
 * 通道，与 `report` 的两个上限同一条论证。
 */
export declare function declarePresetArtifact(state: EngineState, siteId: string, op: ArtifactPresetOp, args: unknown[]): void;
/**
 * resume 恢复：把 journal 里一行**已完成**的产物记录并进内存状态。
 *
 * **只有 completed 行才认领 id**：失败的发布不占 id、不占种类、不占版本。这不只是图简洁——
 * 失败行的 `result` 是空的，种类无从恢复，若让 live 那一侧认领而 resume 那一侧认领不了，
 * 同一个脚本在崩溃前后就会得到两套上限账。种类冲突另有编译期诊断把守，运行期这条
 * （`ArtifactKindMismatch`）管的是真正发布成功过的那些 id。
 */
export declare function rememberArtifactRow(state: EngineState, id: string | undefined, result: unknown): void;
/** 该 id 是否已被声明为**预置**产物（`report` 标签的合法目标）。 */
export declare function isDeclaredPreset(state: EngineState, id: string): boolean;
/** 已声明的预置 id（字典序）——只用于把 `ArtifactUndeclared` 的消息写得能照做。 */
export declare function declaredPresetIds(state: EngineState): string[];
//# sourceMappingURL=engine-artifacts.d.ts.map