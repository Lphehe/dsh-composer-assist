import ts from "typescript";
import type { ScriptLoc, WorkflowProgram } from "../compiler/compile.js";
import { type HoleSite, type IterationCandidate, type PhaseMarkerSite, type SiteTable } from "./sites.js";
import type { ApplicationVia } from "./state.js";
import { type JumpKind, type TraceRegionKind } from "./constants.js";
import type { ControlFact, OrderEvent, OrderOracle, OrderRegion, PhaseInfo } from "./causality-order-types.js";
import { type ScriptFunction } from "./causality-order-functions.js";
import { type Frame, type StrandRecord } from "./causality-order-strands.js";
/** The walk's whole shared state: what `traceOrder` used to hold in closure. */
export interface TraceState {
    readonly scriptFile: ts.SourceFile;
    readonly program: ts.Program;
    readonly checker: ts.TypeChecker;
    readonly toScriptLoc: WorkflowProgram["toScriptLoc"];
    readonly oracle: OrderOracle;
    readonly body: ts.Block;
    readonly askByCall: ReadonlyMap<ts.Node, string>;
    readonly readByCall: ReadonlyMap<ts.Node, string>;
    readonly actorByCall: ReadonlyMap<ts.Node, string>;
    /** `hole<T>()` calls by CALL node, open and filled (causality-order-holes.ts). */
    readonly holeByCall: ReadonlyMap<ts.Node, HoleSite>;
    /** Per-element callback calls by CALL node (the fan-out region opens there). */
    readonly candByCall: ReadonlyMap<ts.Node, IterationCandidate>;
    /** Their inline literals (an iteration construct for the admission test). */
    readonly candByCallback: ReadonlyMap<ts.Node, IterationCandidate>;
    /**
     * A function applied per element at a candidate call (`xs.map(review)`) encloses its
     * steps in an iteration exactly as an inline callback literal does.
     */
    readonly eachCallbackFns: ReadonlySet<ts.Node>;
    readonly recursive: ReadonlySet<ts.Node>;
    /**
     * Only real steps can be ordered. An occurrence set may also carry join and fan-out
     * labels, which are relays, not things that take time.
     */
    readonly realSteps: ReadonlySet<string>;
    readonly callByStep: ReadonlyMap<string, ts.Node>;
    readonly iterationAncestorCache: Map<ts.Node, Set<ts.Node>>;
    readonly events: OrderEvent[];
    readonly regions: OrderRegion[];
    readonly controls: ControlFact[];
    readonly counters: Map<TraceRegionKind, number>;
    readonly issued: Set<string>;
    readonly frames: Frame[];
    /** Every strand the walk spawned, in spawn order; `joined` is the ones already awaited. */
    readonly strands: StrandRecord[];
    readonly joined: Set<string>;
    /** Which strands a variable may hold the promise of — the syntactic half of the join. */
    readonly strandsBySymbol: Map<ts.Symbol, Set<string>>;
    readonly returnTargets: string[];
    readonly throwTargets: string[];
    readonly regionByStatement: Map<ts.Node, string>;
    /** decl -> the `loop` region its SCC entry opened; where a re-entrant call `recur`s to. */
    readonly sccLoopByDecl: Map<ts.Node, string>;
    /**
     * Which steps a variable may hold the answer of. The syntactic half of the control
     * relation: it catches implicit flows the taint oracle cannot see, because a condition
     * never joins the data contract (`const flag = (await ask()) ? 1 : 2` taints nothing).
     */
    readonly stepsBySymbol: Map<ts.Symbol, Set<string>>;
    readonly walkedFns: Set<ts.Node>;
    readonly fnStack: ts.Node[];
    readonly markerByStatement: ReadonlyMap<ts.Node, PhaseMarkerSite>;
    readonly phases: PhaseInfo[];
    readonly phaseIdByName: Map<string, string>;
    /** Hole phases already minted (a hole in a helper is reached per call, minted once). */
    readonly holePhases: Set<string>;
    /**
     * The filled holes whose bodies the walk is inside, innermost last: every phase minted
     * while the stack is non-empty carries its top as `fill` ({@link PhaseInfo.fill}).
     */
    readonly fillStack: string[];
    currentPhase: string;
    /** The root `seq` region id; every other region descends from it. */
    readonly root: string;
    /** The node visitor, bound to this state so every module can recurse without a cycle. */
    readonly walk: (node: ts.Node, chain: readonly string[]) => void;
}
/** The script functions the oracle says `node` applies, by `via`, in recording order. */
export declare function applicationsAt(state: Pick<TraceState, "oracle" | "scriptFile">, node: ts.Node, via: ApplicationVia): ScriptFunction[];
export declare function openRegion(state: Pick<TraceState, "counters" | "regions">, kind: TraceRegionKind, parent: string | undefined, extra: {
    entered: boolean;
    loc?: ScriptLoc;
    bound?: number;
    label?: string;
    exhaustive?: boolean;
    fallthrough?: boolean;
    detached?: boolean;
    recursive?: boolean;
    strand?: true;
}): string;
/** Build the state and index the site table; `walk` is the node visitor to bind. */
export declare function createTraceState(workflow: WorkflowProgram, table: SiteTable, oracle: OrderOracle, walk: (state: TraceState, node: ts.Node, chain: readonly string[]) => void): TraceState;
export declare function locOf(state: TraceState, node: ts.Node): ScriptLoc;
export declare function innermost(state: TraceState, chain: readonly string[]): string;
export declare function issue(state: TraceState, step: string, chain: readonly string[]): void;
export declare function jump(state: TraceState, kind: JumpKind, target: string, chain: readonly string[]): void;
/** Step ids issued by events at or after `mark`, in issue order, deduped. */
export declare function issuesSince(state: TraceState, mark: number): string[];
/**
 * The id a marker names. Same name → same id (names are the key, unlike an actor's);
 * a new name mints `phase#N` at FIRST REACH, so numbering follows evaluation order and
 * a marker in dead code the walk never reaches mints nothing.
 *
 * A marker whose name the collector could not read (non-literal, empty) mints nothing
 * and leaves the current phase alone: those are diagnostics (9004) and the script never
 * reaches this pass, so this is the invariant written down rather than a fallback.
 */
export declare function phaseIdOf(state: TraceState, marker: PhaseMarkerSite): string | undefined;
//# sourceMappingURL=causality-order-state.d.ts.map