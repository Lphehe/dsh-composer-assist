import ts from "typescript";
import { type TraceState } from "./causality-order-state.js";
/** The loop cases of the visitor. Returns false when `node` is not a loop statement. */
export declare function walkLoop(state: TraceState, node: ts.Node, chain: readonly string[]): boolean;
//# sourceMappingURL=causality-order-loops.d.ts.map