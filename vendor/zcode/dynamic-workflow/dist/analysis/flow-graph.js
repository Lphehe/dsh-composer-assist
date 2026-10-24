import { collectFlowHoles, collectFlowPhases, quotientFlow } from "./flow-phase.js";
import { createStrandPark } from "./flow-strands.js";
import { buildTree } from "./flow-tree.js";
/** Terminal node ids. `sink` is the causality graph's sink: the script completed normally. */
export const FLOW_ENTRY = "entry";
export const FLOW_SINK = "sink";
export const FLOW_ABORT = "abort";
/**
 * One edge stands for the whole path from its source node to its target node, and that path
 * may cross several boundaries (leave a choice arm, exit an inner loop, close the outer
 * loop). The edge takes the MOST SIGNIFICANT transition on the path, by this rank: a plain
 * successor < entering a branch or fan-out < leaving a loop / fan-out / call < closing a
 * loop < an exception. `via` names the jump statement behind the kind and survives only
 * while the kind does.
 */
const RANK = {
    next: 0,
    branch: 1,
    fork: 1,
    exit: 2,
    join: 2,
    jump: 2,
    loop: 3,
    throw: 4,
    "may-throw": 4,
};
function retype(srcs, kind, via) {
    return srcs.map((src) => RANK[kind] > RANK[src.kind] ? { from: src.from, kind, ...(via === undefined ? {} : { via }) } : src);
}
/** Force a kind regardless of rank: where a construct RESOLVES a jump (a `return` reaching its call). */
function settle(srcs, kind, via) {
    return srcs.map((src) => ({ from: src.from, kind, ...(via === undefined ? {} : { via }) }));
}
function dedupeSrcs(srcs) {
    const seen = new Set();
    return srcs.filter((src) => {
        const key = `${src.from}|${src.kind}|${src.via ?? ""}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
/** The edge a jump of `kind` makes at its target. `return` into a fan-out is decided there. */
function jumpEdge(kind) {
    switch (kind) {
        case "continue":
            return { kind: "loop", via: "continue" };
        case "recur":
            return { kind: "loop", via: "recur" };
        case "break":
            return { kind: "exit", via: "break" };
        case "return":
            return { kind: "jump", via: "return" };
        case "throw":
            return { kind: "throw" };
    }
}
export function projectControlFlow(core) {
    const trace = core.trace;
    const { byId, root } = buildTree(trace);
    const nodes = [];
    const edges = [];
    const edgeKeys = new Set();
    const pending = [];
    const occurrences = new Map();
    const park = createStrandPark(trace.phases);
    let placeholders = 0;
    const emit = (from, to, kind, via) => {
        const key = `${from}|${to}|${kind}|${via ?? ""}`;
        if (edgeKeys.has(key))
            return;
        edgeKeys.add(key);
        edges.push({ from, kind, to, ...(via === undefined ? {} : { via }) });
    };
    const connect = (srcs, to) => {
        for (const src of srcs)
            emit(src.from, to, src.kind, src.via);
    };
    /** Remove and return the registered jumps of these kinds aimed at `target`. */
    const take = (target, kinds) => {
        const out = [];
        for (let i = pending.length - 1; i >= 0; i -= 1) {
            const entry = pending[i];
            if (entry.target !== target || !kinds.includes(entry.kind))
                continue;
            out.unshift(...entry.srcs);
            pending.splice(i, 1);
        }
        return out;
    };
    /** The nearest enclosing `attempt` of a region: where an exception escaping it lands. */
    const enclosingAttempt = (region) => {
        let parent = region.parent === undefined ? undefined : byId.get(region.parent)?.region;
        while (parent !== undefined) {
            if (parent.kind === "attempt")
                return parent.id;
            parent = parent.parent === undefined ? undefined : byId.get(parent.parent)?.region;
        }
        return undefined;
    };
    const raiseOutward = (from, srcs) => {
        if (srcs.length === 0)
            return;
        const attempt = enclosingAttempt(from);
        if (attempt === undefined)
            connect(srcs, FLOW_ABORT);
        else
            pending.push({ kind: "throw", srcs: [...srcs], target: attempt });
    };
    const subtreeIds = (node, into = new Set()) => {
        into.add(node.region.id);
        for (const child of node.children)
            if (child.type === "region")
                subtreeIds(child, into);
        return into;
    };
    const leaf = (node, incoming) => {
        const { event } = node;
        if (event.at === "actor")
            return [...incoming];
        // A barrier is transparent to the main line and is where the strands it awaits rejoin
        // it: their parked exits continue from here, beside the sources that arrived.
        if (event.at === "settle")
            return [...incoming, ...park.join(event.joins ?? [])];
        if (event.at === "jump") {
            const { kind, via } = jumpEdge(event.kind);
            pending.push({ kind: event.kind, srcs: retype(incoming, kind, via), target: event.target });
            return [];
        }
        const key = event.at === "issue" ? event.step : event.phase;
        const k = (occurrences.get(key) ?? 0) + 1;
        occurrences.set(key, k);
        const id = `${key}@${k}`;
        const alongside = event.at === "mark" ? park.alongside(event.phase, event.regions) : [];
        nodes.push({
            id,
            kind: event.at,
            ...(event.at === "issue" ? { site: event.step } : {}),
            phase: event.phase,
            ...(alongside.length === 0 ? {} : { alongside }),
        });
        connect(incoming, id);
        return [{ from: id, kind: "next" }];
    };
    /** Flow children in order: a sequential container. */
    const sequence = (children, incoming) => {
        let cur = [...incoming];
        for (const child of children)
            cur = flow(child, cur);
        return cur;
    };
    /**
     * Flow a body while learning its ENTRY nodes: the body is fed a placeholder source, the
     * nodes the placeholder reached are the entries, and the real incoming sources are then
     * connected to them — each edge ranked between what the source already carried and what
     * the body's first construct assigned. Incoming sources that came out the other end
     * without meeting a node are returned separately as `passed`: a path through the body
     * that touched nothing is not an iteration anyone can see, so it must not close a loop.
     */
    const withEntries = (children, incoming) => {
        placeholders += 1;
        const ph = `$entry${placeholders}`;
        const pendingMark = pending.length;
        const exits = sequence(children, [{ from: ph, kind: "next" }]);
        const entries = [];
        for (let i = edges.length - 1; i >= 0; i -= 1) {
            const edge = edges[i];
            if (edge.from !== ph)
                continue;
            edges.splice(i, 1);
            edgeKeys.delete(`${edge.from}|${edge.to}|${edge.kind}|${edge.via ?? ""}`);
            if (!entries.includes(edge.to))
                entries.unshift(edge.to);
            connect(retype(incoming, edge.kind, edge.via), edge.to);
        }
        // A jump as the body's first leaf registered the placeholder as its source.
        for (const entry of pending.slice(pendingMark)) {
            entry.srcs = entry.srcs.flatMap((src) => src.from === ph ? incoming.map((real) => ({ ...src, from: real.from })) : [src]);
        }
        return {
            entries,
            exits: exits.filter((src) => src.from !== ph),
            passed: exits.some((src) => src.from === ph) ? [...incoming] : [],
        };
    };
    const choice = (node, incoming) => {
        const { region } = node;
        let cur = [...incoming]; // a case-clause expression that issues runs before the arms
        const exits = [];
        let carried = []; // switch fallthrough: the previous arm's normal completion
        let sawArm = false;
        for (const child of node.children) {
            if (child.type !== "region" || child.region.kind !== "branch") {
                cur = flow(child, cur);
                continue;
            }
            sawArm = true;
            const armExits = sequence(child.children, [...retype(cur, "branch"), ...carried]);
            if (region.fallthrough)
                carried = armExits;
            else
                exits.push(...armExits);
        }
        if (region.fallthrough)
            exits.push(...carried);
        if (!region.exhaustive || !sawArm)
            exits.push(...retype(cur, "branch"));
        // `break` out of a switch is just choosing the successor: a `branch`, not a loop exit.
        exits.push(...settle(take(region.id, ["break"]), "branch"));
        return exits;
    };
    const loop = (node, incoming) => {
        const { region } = node;
        const { entries, exits: bodyExits, passed } = withEntries(node.children, incoming);
        const breaks = take(region.id, ["break"]);
        const jumpsBack = take(region.id, ["continue", "recur"]);
        if (region.recursive) {
            // A recursion SCC: only the re-entrant calls close the loop. The body completing
            // normally is the helper RETURNING — that is the exit, and nothing is skipped.
            for (const src of jumpsBack)
                for (const entry of entries)
                    emit(src.from, entry, src.kind, src.via);
            return [...bodyExits, ...passed, ...breaks];
        }
        const back = [...retype(bodyExits, "loop"), ...jumpsBack];
        for (const src of back)
            for (const entry of entries)
                emit(src.from, entry, src.kind, src.via);
        if (entries.length === 0) {
            // No node inside: the loop is invisible, except that a `break` may have consumed the
            // incoming sources and a never-entered loop still lets them pass.
            return dedupeSrcs([...bodyExits, ...passed, ...breaks, ...(region.entered ? [] : incoming)]);
        }
        const exits = [...retype(bodyExits, "exit"), ...retype(passed, "exit"), ...breaks];
        if (!region.entered)
            exits.push(...retype(incoming, "exit"));
        return dedupeSrcs(exits);
    };
    const fanout = (node, incoming) => {
        const { entries, exits: bodyExits, passed } = withEntries(node.children, retype(incoming, "fork"));
        const returns = settle(take(node.region.id, ["return"]), "join", "return");
        if (entries.length === 0)
            return dedupeSrcs([...bodyExits, ...passed, ...returns]);
        return dedupeSrcs([...retype(bodyExits, "join"), ...retype(passed, "join"), ...returns]);
    };
    /**
     * A STRAND: one asynchronous activation that runs alongside the body that spawned it.
     * Control forks into it here, where the trace records it, but leaves it at the barrier
     * that awaits its promise — so its exits (the body's, and its `return`s, all `join`) are
     * parked under its region id for that barrier to collect, and the spawner carries on
     * with exactly the sources it arrived with.
     *
     * `passed` is dropped, and so is any exit still standing on one of the strand's own
     * incoming sources: both are the spawner's control, not the strand's, and they leave
     * with `incoming`. Parking one would draw a second, `join`-kinded copy of the
     * pass-through edge the spawner already makes. A strand left with nothing to park is
     * invisible and parks nothing.
     *
     * "Nothing" is judged on the EXITS, never on `entries`. Both corners that rule out the
     * tempting `entries.length === 0` test are in the corpus, and both were measured:
     *  - a body that meets no node of its own can still have real exits. The `.finally` of
     *    `async-promise-then-both-callbacks` holds no call, but its barrier joins the two
     *    `.then` strands and their exits surface in `bodyExits`. `entries` is built from
     *    the edges leaving the entry PLACEHOLDER, which never reached a node here, so the
     *    entries test drops them and leaves two ask nodes with no outgoing edge at all.
     *  - a body full of nodes can still carry an exit that met none. A `return` whose path
     *    touched nothing stands on whatever `withEntries` rewrote the placeholder to; on
     *    `functions-summaries-mutual-recursion` that is an enclosing body's placeholder,
     *    and parking it emitted `$entry1 -> sink`, an edge out of a node that never was.
     */
    const strandRegion = (node, incoming) => {
        const nodeMark = nodes.length;
        const spawner = new Set(incoming.map((src) => src.from));
        const { exits: bodyExits } = withEntries(node.children, retype(incoming, "fork"));
        const returns = settle(take(node.region.id, ["return"]), "join", "return");
        const all = dedupeSrcs([...retype(bodyExits, "join"), ...returns]);
        const exits = all.filter((src) => !spawner.has(src.from));
        const phases = new Set(nodes.slice(nodeMark).map((inner) => inner.phase));
        if (exits.length > 0 || phases.size > 0)
            park.park(node.region.id, exits, [...phases]);
        return [...incoming];
    };
    // A `return` reaching its call resumes at the call site: from the caller's point of view a
    // plain successor. (`return` to the root is a `jump` to the sink; see the root below.)
    const call = (node, incoming) => [
        ...sequence(node.children, incoming),
        ...settle(take(node.region.id, ["return"]), "next"),
    ];
    const tryGroup = (node, incoming) => {
        const part = (kind) => node.children.find((child) => child.type === "region" && child.region.kind === kind);
        const attempt = part("attempt");
        const handler = part("catch");
        const finalizer = part("finally");
        if (attempt === undefined)
            return sequence(node.children, incoming);
        const inside = subtreeIds(node);
        const pendingMark = pending.length;
        const nodeMark = nodes.length;
        let normal = sequence(attempt.children, incoming);
        // Every issue lexically inside the try body may reject there; explicit throws targeting
        // this attempt join them. Nothing outside a try body gets an implicit exception edge.
        // (An issue inside a NESTED try also lands here — its own catch may rethrow, so the
        // outer handler stays reachable; over-approximating is the licensed direction.)
        let raised = [
            ...nodes.slice(nodeMark).filter((n) => n.kind === "issue").map((n) => ({ from: n.id, kind: "may-throw" })),
            ...take(attempt.region.id, ["throw"]),
        ];
        if (handler !== undefined) {
            normal = [...normal, ...sequence(handler.children, raised)];
            raised = [];
        }
        if (finalizer === undefined) {
            raiseOutward(node.region, raised);
            return normal;
        }
        // Jumps out of the try body / catch block pass through finally first: they are pulled
        // off the pending list, fed into finally, and re-registered from finally's exits.
        const escaping = [];
        for (let i = pending.length - 1; i >= pendingMark; i -= 1) {
            const entry = pending[i];
            if (inside.has(entry.target))
                continue;
            escaping.unshift(entry);
            pending.splice(i, 1);
        }
        const finallyExits = sequence(finalizer.children, [
            ...normal,
            ...raised,
            ...escaping.flatMap((entry) => entry.srcs),
        ]);
        for (const entry of escaping) {
            const { kind, via } = jumpEdge(entry.kind);
            pending.push({ kind: entry.kind, srcs: retype(finallyExits, kind, via), target: entry.target });
        }
        if (raised.length > 0)
            raiseOutward(node.region, retype(finallyExits, "throw"));
        return normal.length > 0 ? finallyExits : [];
    };
    // A source list is a SET: `connect` dedups the edges it makes, so duplicates carry no
    // information — but they multiply. A skippable choice with nothing inside returns its
    // incoming sources twice (once through the arm, once past it), and a helper inlined a
    // hundred times contributes thousands of such leafless regions in sequence: the multiset
    // doubled at each one until `push(...exits)` overflowed the call stack with 135,200 copies
    // of ONE source. Dedup at the one seam every construct flows through, so no list ever
    // exceeds |nodes| × |kinds| entries whatever the shape.
    const flow = (node, incoming) => dedupeSrcs(flowRaw(node, incoming));
    const flowRaw = (node, incoming) => {
        if (node.type === "leaf")
            return leaf(node, incoming);
        // `strand` rides on a `call` or a `fanout` and overrides both: what matters is that
        // the body runs concurrently with its spawner, not how it was written.
        if (node.region.strand === true)
            return strandRegion(node, incoming);
        switch (node.region.kind) {
            case "choice":
                return choice(node, incoming);
            case "loop":
                return loop(node, incoming);
            case "fanout":
                return fanout(node, incoming);
            case "call":
                return call(node, incoming);
            case "try":
                return tryGroup(node, incoming);
            default:
                return sequence(node.children, incoming);
        }
    };
    // --- Root: entry, the main sequence, the terminals, then the detached bodies ------------
    const detached = root.children.filter((child) => child.type === "region" && child.region.detached === true);
    const main = root.children.filter((child) => !detached.includes(child));
    const exits = sequence(main, [{ from: FLOW_ENTRY, kind: "next" }]);
    connect(exits, FLOW_SINK);
    connect(take(trace.root, ["return"]), FLOW_SINK);
    connect(take(trace.root, ["throw"]), FLOW_ABORT);
    // No barrier ever awaited these strands. All that is known is that the script did not
    // outlive them, so they join the sink — the same terminal the main line reaches.
    connect(park.drain(), FLOW_SINK);
    for (const body of detached) {
        const pendingMark = pending.length;
        const nodeMark = nodes.length;
        sequence(body.children, []);
        for (const node of nodes.slice(nodeMark))
            node.detached = true;
        // A detached body has no position, so nothing it jumps to can be drawn — and neither
        // can the strands it spawns, which go the same way as its pending jumps.
        pending.splice(pendingMark);
        park.discard();
    }
    sortEdges(nodes, edges);
    const phases = collectFlowPhases(trace, nodes);
    const holes = collectFlowHoles(core, nodes);
    return {
        edges,
        nodes,
        ...(trace.phases.length === 0 ? {} : { phaseEdges: quotientFlow(nodes, edges, phases), phases }),
        ...(holes.length === 0 ? {} : { holes }),
    };
}
function sortEdges(nodes, edges) {
    const rank = new Map(nodes.map((node, index) => [node.id, index]));
    rank.set(FLOW_ENTRY, -1);
    rank.set(FLOW_SINK, nodes.length);
    rank.set(FLOW_ABORT, nodes.length + 1);
    const at = (id) => rank.get(id) ?? nodes.length + 2;
    edges.sort((a, b) => at(a.from) - at(b.from) ||
        at(a.to) - at(b.to) ||
        a.kind.localeCompare(b.kind) ||
        (a.via ?? "").localeCompare(b.via ?? ""));
}
