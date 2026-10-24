import ts from "typescript";
import { FACADE_FILE_NAME } from "../facade/dts.js";
/** What an unknown callee is assumed to do with function-valued arguments. */
export const DEFAULT_CALLBACK_SEMANTICS = {
    entered: false,
    multiplicity: "once",
};
/** Array methods that invoke their callback per element. Name-based on any receiver that is
 * not a script-declared method (a user class's own `.map` is a user function: callee path).
 * Value: element / whole-collection / accumulator parameter indices of the callback. */
const EACH_METHODS = new Map([
    ["map", { element: [0], whole: [2] }],
    ["flatMap", { element: [0], whole: [2] }],
    ["forEach", { element: [0], whole: [2] }],
    ["filter", { element: [0], whole: [2] }],
    ["some", { element: [0], whole: [2] }],
    ["every", { element: [0], whole: [2] }],
    ["find", { element: [0], whole: [2] }],
    ["findIndex", { element: [0], whole: [2] }],
    ["findLast", { element: [0], whole: [2] }],
    ["findLastIndex", { element: [0], whole: [2] }],
    ["reduce", { accumulator: 0, element: [1], whole: [3] }],
    ["reduceRight", { accumulator: 0, element: [1], whole: [3] }],
    ["sort", { element: [0, 1], whole: [] }],
]);
/** Promise continuation methods: run at most once, after the receiver settles. */
const ONCE_METHODS = new Map([
    ["then", { callbacks: [0, 1], deferred: true, entered: false }],
    ["catch", { callbacks: [0], deferred: true, entered: false }],
    ["finally", { callbacks: [0], deferred: true, entered: true }],
]);
/** Global scheduling functions: run their callback once, later. */
const ONCE_GLOBALS = new Set(["setTimeout", "setInterval", "setImmediate", "queueMicrotask"]);
/**
 * The one facade function that takes a callback: `future(body)` starts `body` at the call
 * and returns its promise (docs/dynamic-workflow/authoring.md「Streams」). Once and ENTERED —
 * the cell provably calls it — and NOT deferred: it runs now, not after anything settles, so
 * the ordering walk inlines the body as an entered `call` region, a strand when it is async.
 */
const FUTURE_FUNCTION = "future";
/**
 * The registry entry for a call or `new`, or undefined when the callee has none (callers
 * fall back to {@link DEFAULT_CALLBACK_SEMANTICS} for whatever function values reach it).
 * Never matches a callee declared in the authored script: a script-local `then` is a
 * script-local function, applied through the callee path.
 */
export function callbackSemanticsOf(node, checker, program) {
    const args = node.arguments ?? [];
    if (ts.isNewExpression(node)) {
        if (isGlobalLibValue(node.expression, "Promise", checker, program) && args.length > 0) {
            return { callbacks: [0], entered: true, label: "Promise", multiplicity: "once" };
        }
        return undefined;
    }
    const callee = node.expression;
    if (ts.isPropertyAccessExpression(callee)) {
        if (isScriptDeclared(callee.name, checker, program))
            return undefined;
        const method = callee.name.text;
        if (method === "from" && isGlobalLibValue(callee.expression, "Array", checker, program)) {
            const iterated = args[0];
            if (iterated === undefined || args.length < 2)
                return undefined;
            return { callbacks: [1], elementParams: [0], entered: false, iterated, label: "from", multiplicity: "each", wholeParams: [] };
        }
        const each = EACH_METHODS.get(method);
        if (each !== undefined) {
            return {
                callbacks: [0],
                elementParams: each.element,
                entered: false,
                iterated: callee.expression,
                label: method,
                multiplicity: "each",
                wholeParams: each.whole,
                ...(each.accumulator === undefined ? {} : { accumulatorParam: each.accumulator }),
            };
        }
        const once = ONCE_METHODS.get(method);
        if (once !== undefined)
            return { ...once, label: method, multiplicity: "once" };
        return undefined;
    }
    if (ts.isIdentifier(callee) && ONCE_GLOBALS.has(callee.text) && isGlobalLibValue(callee, callee.text, checker, program)) {
        return { callbacks: [0], deferred: true, entered: false, label: callee.text, multiplicity: "once" };
    }
    if (ts.isIdentifier(callee) && callee.text === FUTURE_FUNCTION && isFacadeFunction(callee, checker)) {
        return { callbacks: [0], entered: true, label: FUTURE_FUNCTION, multiplicity: "once" };
    }
    return undefined;
}
/** True iff `expr` resolves to a function declared in the facade `.d.ts` (not a user shadow). */
function isFacadeFunction(expr, checker) {
    let symbol = checker.getSymbolAtLocation(expr);
    if (symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0)
        symbol = checker.getAliasedSymbol(symbol);
    return (symbol?.declarations?.some((declaration) => declaration.getSourceFile().fileName === FACADE_FILE_NAME) ?? false);
}
/** True iff `expr` resolves to the ES-lib global `name` (not a user shadow). */
export function isGlobalLibValue(expr, name, checker, program) {
    let symbol = checker.getSymbolAtLocation(expr);
    if (symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0)
        symbol = checker.getAliasedSymbol(symbol);
    if (symbol?.name !== name)
        return false;
    return symbol.declarations?.some((declaration) => isLibDeclaration(declaration, program)) ?? false;
}
/**
 * True iff the member is DECLARED, and nowhere in the authored script: a library or facade
 * method (`p.finally`, `xs.map`, `node.ask`). Such a member can never BE a script function,
 * however many function values the receiver's abstract value happens to carry — a whole-value
 * read of a container with an absent field collapses to everything in it, callables included,
 * and dispatching on those would inline callbacks as the callee of `.finally`. An undeclared
 * member (an `any` receiver) keeps the value-based answer.
 */
export function isForeignMember(name, checker, scriptFile) {
    const declarations = checker.getSymbolAtLocation(name)?.declarations;
    if (declarations === undefined || declarations.length === 0)
        return false;
    return declarations.every((declaration) => declaration.getSourceFile() !== scriptFile);
}
/** True iff the member's symbol has a declaration in the authored script (a user method). */
function isScriptDeclared(name, checker, program) {
    const symbol = checker.getSymbolAtLocation(name);
    return (symbol?.declarations?.some((declaration) => {
        const file = declaration.getSourceFile();
        return !isLibDeclaration(declaration, program) && !file.isDeclarationFile;
    }) ?? false);
}
function isLibDeclaration(declaration, program) {
    const file = declaration.getSourceFile();
    return program.isSourceFileDefaultLibrary(file) || /^lib\..+\.d\.ts$/.test(file.fileName);
}
