import ts from "typescript";
import { findWorkflowBody, } from "./sites.js";
import { UNPHASED_ID } from "./constants.js";
import { asScriptFunction, collectRecursiveFunctions, } from "./causality-order-functions.js";
import { innermostOpenStrand } from "./causality-order-strands.js";
/** The script functions the oracle says `node` applies, by `via`, in recording order. */
export function applicationsAt(state, node, via) {
    const out = [];
    for (const [fn, how] of state.oracle.applications.get(node) ?? []) {
        if (how !== via)
            continue;
        const decl = asScriptFunction(fn, state.scriptFile);
        if (decl !== undefined)
            out.push(decl);
    }
    return out;
}
export function openRegion(state, kind, parent, extra) {
    const next = (state.counters.get(kind) ?? 0) + 1;
    state.counters.set(kind, next);
    const id = `${kind}#${next}`;
    state.regions.push({ id, kind, ...(parent === undefined ? {} : { parent }), ...extra });
    return id;
}
/** Build the state and index the site table; `walk` is the node visitor to bind. */
export function createTraceState(workflow, table, oracle, walk) {
    const { program, scriptFile, toScriptLoc } = workflow;
    const checker = program.getTypeChecker();
    const body = findWorkflowBody(scriptFile);
    const askByCall = new Map(table.asks.map((site) => [site.call, site.id]));
    const readByCall = new Map(table.worldReads.map((site) => [site.call, site.id]));
    const actorByCall = new Map(table.actors.map((site) => [site.call, site.id]));
    const holeByCall = new Map(table.holes.map((site) => [site.call, site]));
    // 只有开放的留白是一步（docs/analysis.md「Sites」）：已补全的留白由它的函数体在原地代表。
    const openHoles = table.holes.filter((site) => site.body === undefined);
    const candByCall = new Map();
    const candByCallback = new Map();
    for (const cand of table.iterations) {
        if (cand.call !== undefined)
            candByCall.set(cand.call, cand);
        if (cand.callback !== undefined)
            candByCallback.set(cand.callback, cand);
    }
    const eachCallbackFns = new Set();
    for (const call of candByCall.keys()) {
        for (const fn of applicationsAt({ oracle, scriptFile }, call, "argument"))
            eachCallbackFns.add(fn);
    }
    const recursive = collectRecursiveFunctions(scriptFile, checker, oracle.applications);
    const realSteps = new Set([
        ...table.asks.map((site) => site.id),
        ...table.worldReads.map((site) => site.id),
        ...openHoles.map((site) => site.id),
    ]);
    const callByStep = new Map([
        ...table.asks.map((site) => [site.id, site.call]),
        ...table.worldReads.map((site) => [site.id, site.call]),
        ...openHoles.map((site) => [site.id, site.call]),
    ]);
    const markerByStatement = new Map();
    for (const marker of table.phases) {
        if (ts.isExpressionStatement(marker.call.parent))
            markerByStatement.set(marker.call.parent, marker);
    }
    const regions = [];
    const counters = new Map();
    const root = openRegion({ counters, regions }, "seq", undefined, { entered: true });
    const state = {
        actorByCall,
        askByCall,
        body,
        callByStep,
        candByCall,
        candByCallback,
        checker,
        controls: [],
        counters,
        currentPhase: UNPHASED_ID,
        eachCallbackFns,
        events: [],
        fillStack: [],
        fnStack: [],
        frames: [{ region: root, settled: new Set() }],
        holeByCall,
        holePhases: new Set(),
        issued: new Set(),
        iterationAncestorCache: new Map(),
        joined: new Set(),
        markerByStatement,
        oracle,
        phaseIdByName: new Map(),
        phases: [],
        program,
        readByCall,
        realSteps,
        recursive,
        regionByStatement: new Map(),
        regions,
        returnTargets: [],
        root,
        sccLoopByDecl: new Map(),
        scriptFile,
        stepsBySymbol: new Map(),
        strands: [],
        strandsBySymbol: new Map(),
        throwTargets: [],
        toScriptLoc,
        walk: (node, chain) => walk(state, node, chain),
        walkedFns: new Set(),
    };
    return state;
}
export function locOf(state, node) {
    return state.toScriptLoc(node.getStart(state.scriptFile));
}
export function innermost(state, chain) {
    return chain[chain.length - 1] ?? state.root;
}
export function issue(state, step, chain) {
    state.issued.add(step);
    // The strand this issue happened in owns the step for the LIFT rule: awaiting a promise
    // that carries this step's label is evidence that that activation has completed.
    innermostOpenStrand(state)?.issued.add(step);
    state.events.push({ at: "issue", phase: state.currentPhase, regions: chain, step });
}
export function jump(state, kind, target, chain) {
    state.events.push({ at: "jump", kind, phase: state.currentPhase, regions: chain, target });
}
/** Step ids issued by events at or after `mark`, in issue order, deduped. */
export function issuesSince(state, mark) {
    const out = [];
    for (let i = mark; i < state.events.length; i += 1) {
        const event = state.events[i];
        if (event.at === "issue" && !out.includes(event.step))
            out.push(event.step);
    }
    return out;
}
/**
 * The id a marker names. Same name → same id (names are the key, unlike an actor's);
 * a new name mints `phase#N` at FIRST REACH, so numbering follows evaluation order and
 * a marker in dead code the walk never reaches mints nothing.
 *
 * A marker whose name the collector could not read (non-literal, empty) mints nothing
 * and leaves the current phase alone: those are diagnostics (9004) and the script never
 * reaches this pass, so this is the invariant written down rather than a fallback.
 */
export function phaseIdOf(state, marker) {
    const name = marker.name?.trim();
    if (name === undefined || name === "")
        return undefined;
    const existing = state.phaseIdByName.get(name);
    if (existing !== undefined)
        return existing;
    // 编号只数标记铸出的阶段：留白的阶段以站点 id 为 id、不进 phaseIdByName，所以夹在中间的留白
    // 不会让 `phase#N` 跳号。
    const id = `phase#${state.phaseIdByName.size + 1}`;
    state.phaseIdByName.set(name, id);
    const fill = state.fillStack[state.fillStack.length - 1];
    state.phases.push({ id, loc: marker.loc, name, ...(fill === undefined ? {} : { fill }) });
    return id;
}
