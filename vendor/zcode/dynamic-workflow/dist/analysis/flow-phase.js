import { UNPHASED_ID } from "./constants.js";
import { FLOW_ABORT, FLOW_ENTRY, FLOW_SINK, } from "./flow-graph.js";
/**
 * The phase quotient of the control-flow graph — the control-flow counterpart of
 * phase-graph.ts (which quotients the CAUSALITY graph). Same vocabulary, same all-or-nothing
 * contract, different question: this one says where execution can go between phases.
 *
 * `alongside` is folded here too, but it is not an edge and so not part of the quotient:
 * it is the union of the mark nodes' own `alongside` lists, because a phase entered twice
 * with different strands running is entered alongside both.
 */
/** Phases some node carries, in first-reach order, {@link UNPHASED_ID} first when present. */
export function collectFlowPhases(trace, nodes) {
    const present = new Set(nodes.map((node) => node.phase));
    const rank = new Map(trace.phases.map((phase, index) => [phase.id, index + 1]));
    rank.set(UNPHASED_ID, 0);
    const at = (id) => rank.get(id) ?? rank.size;
    const running = new Map();
    for (const node of nodes) {
        if (node.alongside === undefined)
            continue;
        const into = running.get(node.phase) ?? new Set();
        for (const id of node.alongside)
            if (id !== node.phase)
                into.add(id);
        running.set(node.phase, into);
    }
    const alongsideOf = (id) => {
        const ids = [...(running.get(id) ?? [])].sort((a, b) => at(a) - at(b));
        return ids.length === 0 ? {} : { alongside: ids };
    };
    const out = [];
    if (present.has(UNPHASED_ID))
        out.push({ id: UNPHASED_ID, ...alongsideOf(UNPHASED_ID) });
    for (const phase of trace.phases) {
        if (present.has(phase.id)) {
            out.push({
                id: phase.id,
                loc: phase.loc,
                name: phase.name,
                ...alongsideOf(phase.id),
                ...(phase.fill === undefined ? {} : { fill: phase.fill }),
            });
        }
    }
    return out;
}
/**
 * The open holes for the display (docs/dynamic-workflow/presentation.md, `holes`), in source
 * order. `phase` is the phase of the hole's FIRST issue node — where it stands; a hole the
 * walk never reached (none in practice: the sweep issues every step) carries none.
 */
export function collectFlowHoles(core, nodes) {
    const phaseOf = new Map();
    for (const node of nodes) {
        if (node.kind === "issue" && node.site !== undefined && !phaseOf.has(node.site)) {
            phaseOf.set(node.site, node.phase);
        }
    }
    return [...core.sites.holes]
        .sort((a, b) => a.order - b.order)
        .map((hole) => {
        const phase = phaseOf.get(hole.id);
        return {
            siteId: hole.id,
            name: hole.name,
            type: hole.type,
            ...(phase === undefined ? {} : { phase }),
            ...(hole.tail ? { tail: true } : {}),
        };
    });
}
/**
 * Each occurrence edge projected onto the phases of its endpoints. Same-phase edges dissolve
 * unless they are `loop` back edges (a loop living inside one phase is a self-loop);
 * terminals project to themselves. Kinds are kept apart — the renderer merges arrows, the
 * model does not. No transitive reduction: a CFG never is.
 */
export function quotientFlow(nodes, edges, phases) {
    const phaseOf = new Map(nodes.map((node) => [node.id, node.phase]));
    const rank = new Map(phases.map((phase, index) => [phase.id, index]));
    rank.set(FLOW_ENTRY, -1);
    rank.set(FLOW_SINK, phases.length);
    rank.set(FLOW_ABORT, phases.length + 1);
    const at = (id) => rank.get(id) ?? phases.length + 2;
    const seen = new Set();
    const out = [];
    for (const edge of edges) {
        const from = phaseOf.get(edge.from) ?? edge.from;
        const to = phaseOf.get(edge.to) ?? edge.to;
        if (from === to && edge.kind !== "loop")
            continue;
        const key = `${from}|${to}|${edge.kind}|${edge.via ?? ""}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push({ from, kind: edge.kind, to, ...(edge.via === undefined ? {} : { via: edge.via }) });
    }
    out.sort((a, b) => at(a.from) - at(b.from) ||
        at(a.to) - at(b.to) ||
        a.kind.localeCompare(b.kind) ||
        (a.via ?? "").localeCompare(b.via ?? ""));
    return out;
}
