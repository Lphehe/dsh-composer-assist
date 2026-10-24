/**
 * 修复原因：engine-artifacts.ts 顶到 oxlint max-lines 上限（400 行）。拆出来的是一个完整的
 * 概念——**交付物旗子**（`primary`）：全 run 至多一个 id 带它（docs/dynamic-workflow/authoring.md
 * 「Ids, tags and versions」），内容成员与预置成员两族各自的准入都要问同一组判据，所以它本就
 * 该有自己的模块，而不是散在发布路径里。
 *
 * 三个函数都是**纯**的：只读 `state.artifacts`（由 journal 行派生，resume 后自然一致），
 * 不落库、不发事件——调用方拿到判据之后自己决定是拒绝还是 failRun。
 */
import type { EngineState } from "./engine-state.js";
import type { InstanceRef } from "./types.js";
/** 本 run 目前的 primary id（至多一个）；没有则 undefined。从 `state.artifacts` 派生，resume 后自然一致。 */
export declare function primaryArtifactId(state: EngineState): string | undefined;
/** `id` 想当 primary 而**别的** id 已经是 ⇒ 返回那个 id；否则 undefined（不想当 / 就是它自己）。 */
export declare function primaryConflict(state: EngineState, id: string, primary: boolean): string | undefined;
export declare function primaryConflictMessage(id: string, holder: string, fix: string, instance: InstanceRef | undefined): string;
//# sourceMappingURL=engine-artifacts-primary.d.ts.map