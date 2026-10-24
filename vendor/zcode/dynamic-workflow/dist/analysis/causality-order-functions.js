import ts from "typescript";
import { isFunctionLike } from "./sites.js";
/** Identifiers a binding name introduces (an identifier, or every leaf of a pattern). */
export function boundIdentifiers(name) {
    if (ts.isIdentifier(name))
        return [name];
    const out = [];
    for (const element of name.elements) {
        if (ts.isOmittedExpression(element))
            continue;
        out.push(...boundIdentifiers(element.name));
    }
    return out;
}
export function asScriptFunction(node, scriptFile) {
    if (!isFunctionLike(node))
        return undefined;
    if (node.getSourceFile() !== scriptFile)
        return undefined;
    const body = node.body;
    return body === undefined ? undefined : node;
}
/** The function-like ancestors of a node, innermost first. */
export function enclosingFunctions(node) {
    const scriptFile = node.getSourceFile();
    const out = [];
    for (let current = node.parent; current !== undefined; current = current.parent) {
        const fn = asScriptFunction(current, scriptFile);
        if (fn !== undefined)
            out.push(fn);
    }
    return out;
}
export function functionName(decl) {
    // A constructor is named by its class: `new Judge()` inlines as a call labelled "Judge".
    if (ts.isConstructorDeclaration(decl)) {
        const cls = decl.parent;
        return ts.isClassLike(cls) && cls.name !== undefined ? cls.name.text : undefined;
    }
    const named = decl;
    if (named.name !== undefined && ts.isIdentifier(named.name))
        return named.name.text;
    const parent = decl.parent;
    if (parent !== undefined && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        return parent.name.text;
    }
    return undefined;
}
/**
 * The script-local function a call resolves to. `getResolvedSignature` handles the
 * hard shapes (methods, overloads, aliased consts) in one hop; anything outside the
 * authored file (the facade, the stdlib) is not inlinable.
 */
export function resolveCallDeclaration(call, checker, scriptFile) {
    const declaration = checker.getResolvedSignature(call)?.declaration;
    if (declaration === undefined)
        return undefined;
    return asScriptFunction(declaration, scriptFile);
}
/**
 * Script-local functions that can reach themselves in the call graph — the SCCs the analysis turns into `loop` regions instead of unrolling. Callees are the union of the
 * checker's resolved declarations and the call oracle's applications (both vias: a
 * function handed to a library that hands it back is a cycle too). Nested function bodies
 * count as their owner's callees, which over-approximates cycles; over-approximating here
 * only costs a `loop` region, while under-approximating would unroll forever.
 */
export function collectRecursiveFunctions(scriptFile, checker, applications) {
    const functions = [];
    const collect = (node) => {
        const fn = asScriptFunction(node, scriptFile);
        if (fn !== undefined)
            functions.push(fn);
        ts.forEachChild(node, collect);
    };
    collect(scriptFile);
    const callees = new Map();
    for (const fn of functions) {
        const set = new Set();
        const scan = (node) => {
            if (ts.isCallExpression(node)) {
                const target = resolveCallDeclaration(node, checker, scriptFile);
                if (target !== undefined)
                    set.add(target);
            }
            if (ts.isCallExpression(node) ||
                ts.isNewExpression(node) ||
                ts.isTaggedTemplateExpression(node)) {
                for (const applied of applications.get(node)?.keys() ?? []) {
                    const target = asScriptFunction(applied, scriptFile);
                    if (target !== undefined)
                        set.add(target);
                }
            }
            ts.forEachChild(node, scan);
        };
        scan(fn.body);
        callees.set(fn, set);
    }
    const recursive = new Set();
    for (const fn of functions) {
        const seen = new Set();
        const stack = [...(callees.get(fn) ?? [])];
        while (stack.length > 0) {
            const next = stack.pop();
            if (next === fn) {
                recursive.add(fn);
                break;
            }
            if (seen.has(next))
                continue;
            seen.add(next);
            stack.push(...(callees.get(next) ?? []));
        }
    }
    return recursive;
}
