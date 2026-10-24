import ts from "typescript";
import type { TraceState } from "./causality-order-state.js";
/**
 * One open activation's settled set. The root body is the first frame and is never a
 * strand; every strand pushes one more. A step is settled FROM A FRAME'S VIEW when some
 * frame on the stack holds it — which is the whole of the fix: a barrier inside a strand
 * no longer settles anything for the spawner, because the spawner's frame is below it and
 * the strand's frame is popped when the strand closes.
 */
export interface Frame {
    readonly region: string;
    readonly settled: Set<string>;
}
/** One strand the walk spawned, in spawn order. */
export interface StrandRecord {
    /** The `call` / `fanout` region that IS the strand. */
    readonly region: string;
    /**
     * Spawn order: this record's own index in `state.strands`. A barrier joins every strand
     * with `at >= the count it saw when it took its mark`, which is "spawned while the
     * operand was evaluated". Deliberately NOT an event index: a strand that emits no event
     * before the await inside it would then tie with that await's mark, and the barrier
     * would join the very strand it stands in (`await ask()` as the first statement of an
     * `async` helper settled the helper's own summary into its own frame).
     */
    readonly at: number;
    /** Steps issued inside it (the innermost open strand at each issue) — the lift rule. */
    readonly issued: Set<string>;
    /** What the strand itself awaited: its frame's settled set at close. */
    summary: ReadonlySet<string>;
    /** False until the body finished. Only a CLOSED strand can be lifted. */
    closed: boolean;
}
/** The awaited expression a barrier stands over, with the strand count it started at. */
export interface AwaitedOperand {
    /** `state.strands.length` where the operand's evaluation began. */
    mark: number;
    operand: ts.Expression;
}
/** The frame a fresh settle lands in: the innermost open one. */
export declare function currentFrame(state: TraceState): Frame;
/** True iff some frame on the stack has settled `step` — the freshness test. */
export declare function isVisiblySettled(state: TraceState, step: string): boolean;
/** The strand an `issue` belongs to: the innermost one still being walked. */
export declare function innermostOpenStrand(state: TraceState): StrandRecord | undefined;
/** Spawn a strand on `region`: record it and push its frame. */
export declare function openStrand(state: TraceState, region: string): StrandRecord;
/** Close a strand: pop its frame and keep what it awaited as the strand's summary. */
export declare function closeStrand(state: TraceState, record: StrandRecord): void;
/** The walk's strand counter: the mark a caller takes before evaluating an expression. */
export declare function strandMark(state: TraceState): number;
/** Strand regions spawned at or after `mark`, in spawn order. */
export declare function strandsSince(state: TraceState, mark: number): string[];
/**
 * Bind strand regions to the identifiers a declaration or assignment introduces — the
 * syntactic half of the join, the exact shape `bindSteps` gives steps and for the same
 * reason: `const work = ids.map(async …)` issues nothing at the declaration, so only the
 * binding can tell a later `await Promise.all(work)` which strands `work` stands for.
 */
export declare function bindStrands(state: TraceState, name: ts.BindingName, regions: readonly string[]): void;
/** True iff the applied function carries the `async` modifier — what makes a body a strand. */
export declare function isAsyncFunction(decl: ts.Node): boolean;
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
export declare function joinStrands(state: TraceState, certain: readonly string[], maybe: readonly string[], awaited: AwaitedOperand | undefined): {
    certain: string[];
    maybe: string[];
};
//# sourceMappingURL=causality-order-strands.d.ts.map