import ts from "typescript";
import { type AbstractValue } from "./domain.js";
import type { EvalContext, Evaluator } from "./taint.js";
/**
 * Facade sink and relay transfers: `Agent.ask`, `files.glob`/`read` (world reads), and
 * `Promise.all` join relays. Split out of calls.ts (pure move, no behavior change) to keep
 * that file under the line cap; `evalCall` dispatches here via the site lookups.
 */
export declare function handleAsk(ev: Evaluator, node: ts.CallExpression, askId: string, ctx: EvalContext): AbstractValue;
export declare function handleWorldRead(ev: Evaluator, id: string, args: readonly ts.Expression[], ctx: EvalContext): AbstractValue;
export declare function handleJoin(ev: Evaluator, node: ts.CallExpression, id: string, arg: ts.Expression | undefined, ctx: EvalContext): AbstractValue;
//# sourceMappingURL=relays.d.ts.map