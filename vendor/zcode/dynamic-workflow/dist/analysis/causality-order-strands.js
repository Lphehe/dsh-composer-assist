import ts from "typescript";
import { isGlobalLibValue } from "./callbacks.js";
import { boundIdentifiers } from "./causality-order-functions.js";
/** The frame a fresh settle lands in: the innermost open one. */
export function currentFrame(state) {
    return state.frames[state.frames.length - 1];
}
/** True iff some frame on the stack has settled `step` — the freshness test. */
export function isVisiblySettled(state, step) {
    return state.frames.some((frame) => frame.settled.has(step));
}
/** The strand an `issue` belongs to: the innermost one still being walked. */
export function innermostOpenStrand(state) {
    for (let i = state.strands.length - 1; i >= 0; i -= 1) {
        const record = state.strands[i];
        if (!record.closed)
            return record;
    }
    return undefined;
}
/** Spawn a strand on `region`: record it and push its frame. */
export function openStrand(state, region) {
    const record = {
        at: state.strands.length,
        closed: false,
        issued: new Set(),
        region,
        summary: new Set(),
    };
    state.strands.push(record);
    state.frames.push({ region, settled: new Set() });
    return record;
}
/** Close a strand: pop its frame and keep what it awaited as the strand's summary. */
export function closeStrand(state, record) {
    const frame = state.frames.pop();
    record.summary = frame?.settled ?? new Set();
    record.closed = true;
}
/** The walk's strand counter: the mark a caller takes before evaluating an expression. */
export function strandMark(state) {
    return state.strands.length;
}
/** Strand regions spawned at or after `mark`, in spawn order. */
export function strandsSince(state, mark) {
    return state.strands.filter((record) => record.at >= mark).map((record) => record.region);
}
/**
 * Bind strand regions to the identifiers a declaration or assignment introduces — the
 * syntactic half of the join, the exact shape `bindSteps` gives steps and for the same
 * reason: `const work = ids.map(async …)` issues nothing at the declaration, so only the
 * binding can tell a later `await Promise.all(work)` which strands `work` stands for.
 */
export function bindStrands(state, name, regions) {
    if (regions.length === 0)
        return;
    for (const identifier of boundIdentifiers(name)) {
        const symbol = state.checker.getSymbolAtLocation(identifier);
        if (symbol === undefined)
            continue;
        const set = state.strandsBySymbol.get(symbol) ?? new Set();
        for (const region of regions)
            set.add(region);
        state.strandsBySymbol.set(symbol, set);
    }
}
/** True iff the applied function carries the `async` modifier — what makes a body a strand. */
export function isAsyncFunction(decl) {
    const { modifiers } = decl;
    return modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
}
/** The promise combinators that adopt each argument, so each argument is an awaited position. */
const COMBINATORS = new Set(["all", "allSettled", "race", "any"]);
function isPromiseCombinator(state, node) {
    const callee = node.expression;
    if (!ts.isPropertyAccessExpression(callee) || !COMBINATORS.has(callee.name.text))
        return false;
    return isGlobalLibValue(callee.expression, "Promise", state.checker, state.program);
}
/**
 * The identifiers in an AWAITED POSITION of an awaited expression: the operand itself,
 * each argument of `Promise.all` / `allSettled` / `race` / `any`, each element of an array
 * literal, a spread's operand, and through parentheses and type assertions. Every other
 * expression is OPAQUE — this mirrors how the runtime adopts promises, and it is what
 * keeps `await f(aWork.length)` from joining the strands `aWork` holds.
 */
function awaitedIdentifiers(state, operand) {
    const out = [];
    const scan = (node) => {
        if (ts.isParenthesizedExpression(node) ||
            ts.isAsExpression(node) ||
            ts.isSatisfiesExpression(node) ||
            ts.isNonNullExpression(node) ||
            ts.isSpreadElement(node)) {
            scan(node.expression);
            return;
        }
        if (ts.isIdentifier(node)) {
            out.push(node);
            return;
        }
        if (ts.isArrayLiteralExpression(node)) {
            for (const element of node.elements)
                scan(element);
            return;
        }
        if (ts.isCallExpression(node) && isPromiseCombinator(state, node)) {
            for (const argument of node.arguments)
                scan(argument);
        }
    };
    scan(operand);
    return out;
}
/**
 * The strands a barrier waits for, split by the certainty each one's summary settles with,
 * and MARKED JOINED so a second await of the same promise adds nothing (exactly as a
 * second settle of one step already does).
 *
 * Two ways in. SYNTACTIC — spawned while the operand was evaluated, or bound to an
 * identifier in an awaited position of it — settles the summary certainly: the await
 * provably waits for that activation. LIFTED — a closed, not-yet-joined strand one of whose
 * issued steps this barrier claims — settles it with the certainty the claim came in with:
 * the promise reached the await through a container or a helper, and all we know is that
 * something the strand issued has settled.
 */
export function joinStrands(state, certain, maybe, awaited) {
    const joins = { certain: [], maybe: [] };
    const take = (region, side) => {
        if (state.joined.has(region))
            return;
        state.joined.add(region);
        side.push(region);
    };
    if (awaited !== undefined) {
        for (const region of strandsSince(state, awaited.mark))
            take(region, joins.certain);
        for (const identifier of awaitedIdentifiers(state, awaited.operand)) {
            const symbol = state.checker.getSymbolAtLocation(identifier);
            const bound = symbol === undefined ? undefined : state.strandsBySymbol.get(symbol);
            for (const region of bound ?? [])
                take(region, joins.certain);
        }
    }
    for (const record of state.strands) {
        if (!record.closed || state.joined.has(record.region))
            continue;
        if (certain.some((step) => record.issued.has(step)))
            take(record.region, joins.certain);
        else if (maybe.some((step) => record.issued.has(step)))
            take(record.region, joins.maybe);
    }
    return joins;
}
