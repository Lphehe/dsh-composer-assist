import ts from "typescript";
import type { TraceState } from "./causality-order-state.js";
import { type AwaitedOperand } from "./causality-order-strands.js";
/** An oracle lookup split by the settle-certainty rule. Readonly because {@link NO_CLAIM}
 * is a shared singleton — an in-place edit of an empty result would leak everywhere. */
interface OracleClaim {
    certain: readonly string[];
    maybe: readonly string[];
}
export declare function settlesAt(state: TraceState, node: ts.Node, at: number): OracleClaim;
/**
 * An `await` barrier over the union of what the two halves resolved, plus the summaries of
 * the STRANDS it joins: `certain` settles as a certainty, `maybe` as a may-claim (a step
 * claimed by both counts as certain). Steps already settled IN A VISIBLE FRAME drop out,
 * and a claim that has entirely settled already is a no-op. Widening is reached only when
 * the claim and every joined summary were empty to begin with.
 *
 * The already-settled no-op is not new; what changed is that it became REACHABLE. Before
 * the settle oracle, an indirect await (`await held`, `await p` in a helper, a second await of
 * one promise) resolved to the empty set, so every such await fell through to widening and
 * manufactured `seq maybe` claims over unrelated steps still in flight. The oracle makes
 * the claim non-empty, so the no-op catches it and those spurious barriers disappear —
 * which is why several async-promise-* snapshots got STRONGER certainties once the oracle
 * landed rather than gaining edges.
 *
 * Two frame rules carry the strand model:
 * freshness is judged against EVERY frame on the stack, because a step the spawner
 * already awaited is settled for the strands it spawns; fresh steps are recorded in the
 * CURRENT frame alone, because this activation's await tells the spawner nothing.
 * `awaited` is the operand this barrier stands over, which {@link joinStrands} scans for
 * the promises it names; a barrier with no operand (a deferred callback's receiver
 * prologue) can still LIFT a strand out of its own claim.
 */
export declare function barrier(state: TraceState, certain: readonly string[], maybe: readonly string[], chain: readonly string[], awaited?: AwaitedOperand): void;
export declare function bindSteps(state: TraceState, name: ts.BindingName, steps: readonly string[]): void;
/** Record a guard's control dependence against a region, when it has any. */
export declare function recordControl(state: TraceState, guard: ts.Expression, region: string): void;
export {};
//# sourceMappingURL=causality-order-settle.d.ts.map