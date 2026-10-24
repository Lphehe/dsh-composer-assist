const SOURCE = "source";
const SINK = "sink";
const WORKSPACE = "workspace";
/** Project a site graph to its derived actor graph (pure). */
export function toActorGraph(graph) {
    const kindOf = new Map(graph.nodes.map((node) => [node.id, node.kind]));
    const actorsOf = new Map(graph.nodes.filter((node) => node.kind === "ask").map((node) => [node.id, node.actors ?? []]));
    // The lane(s) a site projects onto. The virtual source/sink pass through UNMERGED
    // (two roles of the orchestrator, kept apart so the graph reads as a pipeline
    // rather than a hub with back-edges into its start); world-reads -> the single
    // workspace node; asks -> their actor set (empty when unresolved); join/fan-out
    // relays -> nothing (dropped: additive relay labels guarantee a direct
    // producer -> consumer edge already exists, so no transitive composition is lost).
    const project = (id) => {
        if (id === SOURCE || id === SINK)
            return [id];
        const kind = kindOf.get(id);
        if (kind === "world-read")
            return [WORKSPACE];
        if (kind === "ask")
            return actorsOf.get(id) ?? [];
        return [];
    };
    // Aggregate contributed edges by (from, to): count them, OR their exactness, and
    // collect the deduped producer types in contribution order.
    const agg = new Map();
    const contribute = (from, to, exact, type) => {
        const key = `${from}|${to}`;
        const existing = agg.get(key);
        if (existing === undefined) {
            agg.set(key, { count: 1, exact, from, to, ...(type === undefined ? {} : { types: [type] }) });
            return;
        }
        existing.count += 1;
        existing.exact = existing.exact || exact;
        if (type !== undefined) {
            const types = (existing.types ??= []);
            if (!types.includes(type))
                types.push(type);
        }
    };
    for (const edge of graph.edges) {
        if (edge.kind !== "data")
            continue; // context edges dissolve (same actor = same node)
        // source -> world-read drops: the workspace is itself an origin, not fed by source.
        if (edge.from === SOURCE && kindOf.get(edge.to) === "world-read")
            continue;
        const fromNodes = project(edge.from);
        const toNodes = project(edge.to);
        if (fromNodes.length === 0 || toNodes.length === 0)
            continue; // a relay endpoint: drop
        // A non-singleton (may) projection on either side forces every contributed edge
        // inexact — the ask might run in any of its candidate lanes.
        const exact = edge.exact && fromNodes.length === 1 && toNodes.length === 1;
        for (const from of fromNodes)
            for (const to of toNodes)
                contribute(from, to, exact, edge.type);
    }
    // Agent-relevance filter: an actor edge must touch at least one actor, so
    // endpoint-to-endpoint plumbing (e.g. `workspace -> sink`, a world read flowing
    // untouched into the result) is dropped — honest in the site graph, noise in a
    // collaboration view. We filter the aggregated set (one pass) rather than skipping
    // at contribution, so the rule sits in one place next to the pruning it feeds.
    const isEndpoint = (id) => id === SOURCE || id === SINK || id === WORKSPACE;
    const kept = [...agg.values()].filter((edge) => !(isEndpoint(edge.from) && isEndpoint(edge.to)));
    // Prune any endpoint node the filter (or the projection) leaves with no incident
    // edge — a dangling source/workspace/sink bubble is as noisy as the edge was. Actor
    // nodes always render, even edge-less.
    const incident = new Set();
    for (const edge of kept) {
        incident.add(edge.from);
        incident.add(edge.to);
    }
    // Node order: source first, workspace second, actors in site order (graph.actors is
    // already source-ordered), sink LAST — so `flowchart LR` reads as a pipeline.
    const nodes = [];
    if (incident.has(SOURCE))
        nodes.push({ id: SOURCE });
    if (incident.has(WORKSPACE))
        nodes.push({ id: WORKSPACE });
    for (const actor of graph.actors) {
        nodes.push({
            id: actor.id,
            loc: actor.loc,
            ...(actor.name === undefined ? {} : { name: actor.name }),
            ...(actor.within === undefined ? {} : { family: actor.within }),
        });
    }
    if (incident.has(SINK))
        nodes.push({ id: SINK });
    const position = new Map(nodes.map((node, index) => [node.id, index]));
    const rank = (id) => position.get(id) ?? Number.MAX_SAFE_INTEGER;
    const edges = kept.sort((a, b) => rank(a.from) - rank(b.from) || rank(a.to) - rank(b.to));
    return { edges, nodes };
}
