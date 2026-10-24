import ts from "typescript";
/**
 * The callback-semantics registry: the ONE place that says what a library callee does with
 * the script-local functions handed to it.
 *
 * Invocation is a semantic fact. The taint listener already treats functions as values and
 * applies whatever reaches a call (directly, or pessimistically through the keystone rule
 * for unknown callees). The ordering listener must NOT guess from syntax what the taint
 * listener knows from values — so the only thing left to write down is what the taint
 * domain cannot express: how OFTEN a library invokes its callback and whether it PROVABLY
 * does. Both listeners read this table; neither keeps a private whitelist.
 *
 *  - `each`: the callback runs once per element of `iterated`. The site table turns such a
 *    call into an iteration candidate (a fan-out relay, promoted when its body reaches a
 *    facade site); the ordering walk opens a `fanout` region around the body.
 *  - `once`: the callback runs at most once. The ordering walk opens a `call` region,
 *    `entered` iff the library provably invokes it (a `Promise` executor, `.finally`).
 *
 * A callee with no entry gets {@link DEFAULT_CALLBACK_SEMANTICS}: once, not entered, every
 * argument a potential callback — exactly the set the taint keystone applies, so no function
 * value that reaches a call is ever left for the end-of-walk sweep.
 *
 * Deliberately NOT here: `.call` / `.apply` / `.bind` (they forward the CALLEE, not a callback;
 * calls.ts routes those through the callee application path) and the facade's own functions.
 */
export type CallbackMultiplicity = "each" | "once";
export interface CallbackSemantics {
    multiplicity: CallbackMultiplicity;
    /** Running the call provably runs the callback body (at least once). */
    entered: boolean;
    /** Argument indices that may hold callbacks, in order. */
    callbacks: readonly number[];
    /** Display / region label: the method or global function name. */
    label: string;
    /**
     * `once` only: the callback runs AFTER the receiver settles (a promise continuation, a
     * timer), not during the call. The ordering walk places the body at the call site and
     * opens it with a may-barrier over the receiver, so the receiver's steps precede the
     * callback's without the continuation being mistaken for a synchronous call.
     */
    deferred?: true;
    /** `each` only: the expression the callback is applied to element-wise. */
    iterated?: ts.Expression;
    /** `each` only: callback parameter indices that receive an ELEMENT. */
    elementParams?: readonly number[];
    /** `each` only: callback parameter indices that receive the WHOLE collection. */
    wholeParams?: readonly number[];
    /** `each` only: the callback parameter index that receives the accumulator (`reduce`). */
    accumulatorParam?: number;
}
/** What an unknown callee is assumed to do with function-valued arguments. */
export declare const DEFAULT_CALLBACK_SEMANTICS: Pick<CallbackSemantics, "multiplicity" | "entered">;
/**
 * The registry entry for a call or `new`, or undefined when the callee has none (callers
 * fall back to {@link DEFAULT_CALLBACK_SEMANTICS} for whatever function values reach it).
 * Never matches a callee declared in the authored script: a script-local `then` is a
 * script-local function, applied through the callee path.
 */
export declare function callbackSemanticsOf(node: ts.CallExpression | ts.NewExpression, checker: ts.TypeChecker, program: ts.Program): CallbackSemantics | undefined;
/** True iff `expr` resolves to the ES-lib global `name` (not a user shadow). */
export declare function isGlobalLibValue(expr: ts.Expression, name: string, checker: ts.TypeChecker, program: ts.Program): boolean;
/**
 * True iff the member is DECLARED, and nowhere in the authored script: a library or facade
 * method (`p.finally`, `xs.map`, `node.ask`). Such a member can never BE a script function,
 * however many function values the receiver's abstract value happens to carry — a whole-value
 * read of a container with an absent field collapses to everything in it, callables included,
 * and dispatching on those would inline callbacks as the callee of `.finally`. An undeclared
 * member (an `any` receiver) keeps the value-based answer.
 */
export declare function isForeignMember(name: ts.MemberName, checker: ts.TypeChecker, scriptFile: ts.SourceFile): boolean;
//# sourceMappingURL=callbacks.d.ts.map