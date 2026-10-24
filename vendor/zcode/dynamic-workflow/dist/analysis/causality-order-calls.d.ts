import ts from "typescript";
import { type TraceState } from "./causality-order-state.js";
export declare function walkCall(state: TraceState, node: ts.CallExpression, chain: readonly string[]): void;
/**
 * THE GENERIC CALL RULE: apply what the oracle recorded at this node.
 *
 *  - Callee applications inline the body as a `call` region (the helper's boundary, a
 *    `return` target). Several candidates (an indirect dispatch that may reach any of
 *    them) become the arms of one exhaustive `choice`: exactly one runs, we cannot say
 *    which. With no oracle record the checker's resolved declaration is the fallback — a
 *    value the interpreter could not track still has a syntactic answer.
 *  - Argument applications are callbacks a library may invoke, per the registry: `once`
 *    (the default) inlines the body as a `call`; when the library does not provably invoke
 *    it (`.then`, an unknown callee) the call sits in a one-arm skippable `choice` — the
 *    exact shape of an `if` without `else`, so certainty and the control-flow picture read
 *    "may not run" through the vocabulary they already have. `each` callbacks are handled
 *    by {@link walkCall} (their fanout) and arrive here in `handled`.
 *  - A DEFERRED callback (`.then` / `.catch` / `.finally`, a timer) runs after its receiver
 *    settles, so it is a STRAND whose PROLOGUE is an ordinary barrier over the receiver:
 *    the steps issued while evaluating the receiver (`receiverIssues`, the syntactic half)
 *    plus the oracle's claim keyed by the member-name token (see calls.ts), split by the
 *    settle-certainty rule like any other await. It needs no special certainty any more:
 *    the barrier runs inside the strand's own frame, so it orders the continuation's body
 *    without asserting anything about steps the MAIN LINE issues afterwards, and without
 *    robbing the main line's later `await` of its own certain settle. That scoping is what
 *    `settleLocally`'s may-claim used to approximate.
 */
export declare function applyAt(state: TraceState, node: ts.CallExpression | ts.NewExpression | ts.TaggedTemplateExpression, chain: readonly string[], handled?: ReadonlySet<ts.Node>, receiverIssues?: readonly string[]): void;
//# sourceMappingURL=causality-order-calls.d.ts.map