import ts from "typescript";
import { type TraceState } from "./causality-order-state.js";
/**
 * Walk a statement list in order, threading the current phase with REST-OF-BLOCK
 * extent: a marker statement re-points the local, every later statement in the list
 * (and everything nested under it, inlined helper bodies included) inherits it, and the
 * list's end restores what was current on entry. There is no other phase mechanism —
 * every construct that holds a statement list routes through here.
 *
 * A marker NOT in a statement list (`if (x) phase("a");` without braces) is therefore
 * inert: it has no rest-of-list to claim, which is the same "no effect, no diagnostic"
 * status assigned to a marker at the tail of its block.
 */
export declare function walkStatements(state: TraceState, statements: readonly ts.Statement[], chain: readonly string[]): void;
/** The node visitor: one evaluation-order step over `node`. Bound as `state.walk`. */
export declare function walkNode(state: TraceState, node: ts.Node, chain: readonly string[]): void;
//# sourceMappingURL=causality-order-walk.d.ts.map