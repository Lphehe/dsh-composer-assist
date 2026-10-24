import ts from "typescript";
import type { ApplicationVia } from "./state.js";
export type ScriptFunction = ts.SignatureDeclaration & {
    body: ts.Node;
};
/** Identifiers a binding name introduces (an identifier, or every leaf of a pattern). */
export declare function boundIdentifiers(name: ts.BindingName): ts.Identifier[];
export declare function asScriptFunction(node: ts.Node, scriptFile: ts.SourceFile): ScriptFunction | undefined;
/** The function-like ancestors of a node, innermost first. */
export declare function enclosingFunctions(node: ts.Node): ScriptFunction[];
export declare function functionName(decl: ts.Node): string | undefined;
/**
 * The script-local function a call resolves to. `getResolvedSignature` handles the
 * hard shapes (methods, overloads, aliased consts) in one hop; anything outside the
 * authored file (the facade, the stdlib) is not inlinable.
 */
export declare function resolveCallDeclaration(call: ts.CallExpression, checker: ts.TypeChecker, scriptFile: ts.SourceFile): ScriptFunction | undefined;
/**
 * Script-local functions that can reach themselves in the call graph — the SCCs the analysis turns into `loop` regions instead of unrolling. Callees are the union of the
 * checker's resolved declarations and the call oracle's applications (both vias: a
 * function handed to a library that hands it back is a cycle too). Nested function bodies
 * count as their owner's callees, which over-approximates cycles; over-approximating here
 * only costs a `loop` region, while under-approximating would unroll forever.
 */
export declare function collectRecursiveFunctions(scriptFile: ts.SourceFile, checker: ts.TypeChecker, applications: ReadonlyMap<ts.Node, ReadonlyMap<ts.Node, ApplicationVia>>): Set<ts.Node>;
//# sourceMappingURL=causality-order-functions.d.ts.map