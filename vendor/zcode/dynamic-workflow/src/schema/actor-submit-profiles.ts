import type { SiteGraph } from "../analysis/types.js";
import { interpret } from "../analysis/interpret.js";
import { projectSiteGraph } from "../analysis/graph.js";
import type { SiteTable } from "../analysis/sites.js";
import type { WorkflowProgram } from "../compiler/compile.js";
import type { AskSpec } from "../engine/types.js";
import { canonicalJson } from "../engine/hash.js";
import type { JsonSchema } from "./types.js";

/**
 * 每个 actor 站点的 **submit profile**：决定该 actor 的子代理会话拿到哪一种 `submit_result` 工具。
 *
 * - `untyped`：能落到这个 actor 的 ask 全是 untyped（或它根本没有 ask）→ 不注册 submit_result。
 * - `mono`：能落到这个 actor 的 typed ask 的 schema **全部相同**（规范 JSON 相等；untyped ask 可以
 *   混在其中）→ 工具声明就是 `{ result: schema }`，对该 actor 冻结、跨 ask 不变，因此缓存中性。
 * - `generic`：typed ask 的 schema 不止一种 → 今天的通用工具 + 每个 ask 的 schema 尾注。
 *
 * 为什么是编译期而不是运行期：工具块渲染在 prompt 最前面，一旦按 ask 换 schema 就打掉该 actor
 * 的整个缓存前缀。只有「整个 actor 生命周期里 schema 不变」这件事
 * 在编译期可判定时，typed 工具才是免费的；判定不了就退回 generic，行为逐字节保持等价。
 */
export type ActorSubmitProfile =
  | { kind: "untyped" }
  | { kind: "mono"; schema: JsonSchema }
  | { kind: "generic" };

/** 缺席 / 无法判定时的 profile：今天的行为。 */
export const GENERIC_SUBMIT_PROFILE: ActorSubmitProfile = { kind: "generic" };

/**
 * 由站点图与 ask 规格推导每个 actor 站点的 submit profile。纯函数。
 *
 * **可靠性规则**：ask→actor 的绑定取站点图上的 may-set（`SiteNode.actors`）。只要有**任何一个**
 * ask 站点的 actor 集为空（receiver 没解析出来），分析就说不出那个 ask 会落到谁头上——于是
 * **所有** actor 都记 `generic`。这是有意的保守：一个 typed ask 若落到一个 `untyped` 子代理上，
 * 它没有工具可提交，只能耗尽 nudge 失败；宁可少省一点缓存，也不能凭一个不完整的图把工具拿掉。
 * 同理，一个 ask 的 actor 集有多个成员（条件分支上的 receiver）时，它的 schema 计入每一个成员。
 *
 * askSpecs 缺少某个 ask 站点时同样整体退回 generic：站点表与规格出自同一次编译，缺席只可能是
 * 接线错误，此处不猜（引擎侧对此以 MissingAskSpec 硬失败，这里只需不放大它）。
 *
 * 返回表覆盖 `graph.actors` 里的每一个 actor 站点。
 */
export function deriveActorSubmitProfiles(
  graph: SiteGraph,
  askSpecs: ReadonlyMap<string, AskSpec>,
): Map<string, ActorSubmitProfile> {
  const profiles = new Map<string, ActorSubmitProfile>();
  const actorIds = graph.actors.map((actor) => actor.id);

  // 每个 actor 收集到的 typed schema，按规范 JSON 去重（同一份 schema 对象在不同 ask 站点上各合成
  // 一次，引用不同但内容相同，必须按内容比较）。
  const schemasByActor = new Map<string, Map<string, JsonSchema>>();
  for (const id of actorIds) schemasByActor.set(id, new Map());

  for (const node of graph.nodes) {
    if (node.kind !== "ask") continue;
    const actors = node.actors ?? [];
    const spec = askSpecs.get(node.id);
    if (actors.length === 0 || spec === undefined) {
      for (const id of actorIds) profiles.set(id, GENERIC_SUBMIT_PROFILE);
      return profiles;
    }
    if (!spec.typed) continue;
    const schema = spec.schema as JsonSchema;
    const key = canonicalJson(schema);
    for (const actorId of actors) {
      // 站点图里的 actor id 必然在 graph.actors 内；防御性地补一个桶，而不是静默跳过。
      let bucket = schemasByActor.get(actorId);
      if (bucket === undefined) {
        bucket = new Map();
        schemasByActor.set(actorId, bucket);
      }
      bucket.set(key, schema);
    }
  }

  for (const [actorId, bucket] of schemasByActor) {
    if (bucket.size === 0) profiles.set(actorId, { kind: "untyped" });
    else if (bucket.size === 1)
      profiles.set(actorId, { kind: "mono", schema: [...bucket.values()][0]! });
    else profiles.set(actorId, GENERIC_SUBMIT_PROFILE);
  }
  return profiles;
}

/**
 * 「编译一次」的便捷入口：在构建站点表与合成 schema 的**同一个** {@link WorkflowProgram} 上做解释
 * 与站点图投影（analyzeWorkflowScript 跑的正是这两步），然后推导 profile。供 run 提交路径调用，
 * 不必自己拼装 interpret + projectSiteGraph（两者不在包的公开面上）。
 */
export function deriveActorSubmitProfilesFor(
  workflow: WorkflowProgram,
  table: SiteTable,
  askSpecs: ReadonlyMap<string, AskSpec>,
): Map<string, ActorSubmitProfile> {
  return deriveActorSubmitProfiles(projectSiteGraph(interpret(workflow, table)), askSpecs);
}
