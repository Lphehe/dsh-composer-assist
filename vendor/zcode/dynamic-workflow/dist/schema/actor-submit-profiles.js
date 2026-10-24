import { interpret } from "../analysis/interpret.js";
import { projectSiteGraph } from "../analysis/graph.js";
import { canonicalJson } from "../engine/hash.js";
/** 缺席 / 无法判定时的 profile：今天的行为。 */
export const GENERIC_SUBMIT_PROFILE = { kind: "generic" };
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
export function deriveActorSubmitProfiles(graph, askSpecs) {
    const profiles = new Map();
    const actorIds = graph.actors.map((actor) => actor.id);
    // 每个 actor 收集到的 typed schema，按规范 JSON 去重（同一份 schema 对象在不同 ask 站点上各合成
    // 一次，引用不同但内容相同，必须按内容比较）。
    const schemasByActor = new Map();
    for (const id of actorIds)
        schemasByActor.set(id, new Map());
    for (const node of graph.nodes) {
        if (node.kind !== "ask")
            continue;
        const actors = node.actors ?? [];
        const spec = askSpecs.get(node.id);
        if (actors.length === 0 || spec === undefined) {
            for (const id of actorIds)
                profiles.set(id, GENERIC_SUBMIT_PROFILE);
            return profiles;
        }
        if (!spec.typed)
            continue;
        const schema = spec.schema;
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
        if (bucket.size === 0)
            profiles.set(actorId, { kind: "untyped" });
        else if (bucket.size === 1)
            profiles.set(actorId, { kind: "mono", schema: [...bucket.values()][0] });
        else
            profiles.set(actorId, GENERIC_SUBMIT_PROFILE);
    }
    return profiles;
}
/**
 * 「编译一次」的便捷入口：在构建站点表与合成 schema 的**同一个** {@link WorkflowProgram} 上做解释
 * 与站点图投影（analyzeWorkflowScript 跑的正是这两步），然后推导 profile。供 run 提交路径调用，
 * 不必自己拼装 interpret + projectSiteGraph（两者不在包的公开面上）。
 */
export function deriveActorSubmitProfilesFor(workflow, table, askSpecs) {
    return deriveActorSubmitProfiles(projectSiteGraph(interpret(workflow, table)), askSpecs);
}
