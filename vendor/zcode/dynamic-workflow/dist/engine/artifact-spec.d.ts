/**
 * 预置产物 spec 的形状校验。
 *
 * ⚠ 术语：artifact = **用户面产物**（脚本发布给用户看的看板），不是 `RunSettlement.artifact`
 * 那个顶层返回值。
 *
 * 为什么校验在**引擎核心**而不是 driver：预置声明根本不过 driver（它没有可执行的效应），
 * 而一个形状不合法的 spec 必须在落 journal 之前被拦下——journal 里的记录是投影与冷恢复的
 * 唯一真相，一条画不出来的 spec 落了库就会在每个读面上重新炸一次。
 *
 * 为什么是手写而不是 zod：本包零运行时依赖（facade / 编译 / 引擎全部只靠 typescript），
 * 而 spec 的形状小到一屏。加一个 schema 库来校验四个对象，代价是把整条纯包的依赖前提改掉。
 *
 * 返回**人可读的一句话**而不是 boolean：这条消息会经 `ArtifactSpecInvalid` 落进 run 的
 * failure_json，读者（模型或作者）要据它改脚本，"invalid spec" 帮不上任何忙。
 */
import type { ArtifactPresetOp } from "../facade/registry.js";
/** 一条不合法的理由；`undefined` 即通过。 */
type ArtifactSpecProblem = string | undefined;
/**
 * 校验一个预置 spec。`op` 决定必填字段，公共部分（title / description 的长度）四种都查。
 * 通过的 spec 保证：是普通对象、必填字段在场且形状正确、规范化后不超 8KB。
 */
export declare function validateArtifactSpec(op: ArtifactPresetOp, spec: unknown): ArtifactSpecProblem;
export {};
//# sourceMappingURL=artifact-spec.d.ts.map