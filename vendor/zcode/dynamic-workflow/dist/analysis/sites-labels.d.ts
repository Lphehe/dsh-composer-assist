import ts from "typescript";
import type { WorldReadOp } from "../facade/registry.js";
import type { ScriptLoc } from "../compiler/compile.js";
import type { NamePattern } from "./types.js";
import type { CallbackSemantics } from "./callbacks.js";
import type { IterationCandidate } from "./sites.js";
/** Resolve a node's symbol, following one alias hop (imports never occur here). */
export declare function resolveSymbol(node: ts.Node, checker: ts.TypeChecker): ts.Symbol | undefined;
/** True iff any of the symbol's declarations lives in the facade `.d.ts`. */
export declare function isFacadeDeclared(symbol: ts.Symbol | undefined): boolean;
/**
 * 一个实参**无洞字符串字面量**的文本，其余（标识符、带洞模板、任意表达式）一律 undefined。
 *
 * 三处共用一条判定：phase 的名字、产物的 id、report 的标签。三者的规矩完全相同——只有编译期
 * 就闭合的字面量才算数，看不穿的一律留给各自的诊断趟按原表达式定位，**绝不在这里猜一个值
 * 出来**（猜出来的名字会让一条本该被教改写的调用静默通过）。`ts.isStringLiteralLike` 覆盖
 * 无插值的反引号串。
 */
export declare function literalText(expr: ts.Expression | undefined): string | undefined;
/**
 * 一套 per-kind 站点计数器（`ask#N` / `actor#N` / …），外加 id 前缀。
 *
 * 前缀是留白的事（docs/analysis.md「Sites」的 Hole sites 段）：走查进入一个留白的函数体时
 * **开一套全新的计数器**，体内铸出的每个 id 都带 `<holeId>/`（`hole#a91f3c07/ask#1`），外层
 * 计数器从不看见体内的站点。于是补全一个留白（在脚本中间插入代码）不改动任何已有的 `ask#N` /
 * `actor#N` / …——这是站点 id 稳定性规则从「加标记」到「加函数体」的延伸；活 run 的 journal
 * 键、ask spec、站点阶段表都靠它在补全后幸存。前缀只有**一层**：留白自己的 id 是名字键
 * （hole-id.ts），不带外层前缀，体内再留的留白因此不会让 id 随深度增长；`holeId` 记着
 * 这套计数器属于哪个留白，让体内的留白站点把包着它的留白写进 `fill`。
 * 全局 `order` 不在这里：它是文本输出的归并键，穿过函数体连续计数。
 */
export declare class SiteCounters {
    private readonly prefix;
    /** 这套计数器所在的留白函数体（顶层没有）。 */
    readonly holeId?: string | undefined;
    private readonly counts;
    constructor(prefix?: string, 
    /** 这套计数器所在的留白函数体（顶层没有）。 */
    holeId?: string | undefined);
    /** 铸下一个 `<prefix><kind>#<n>`。 */
    next(kind: string): string;
    /** 进入留白 `holeId` 的函数体：全新一套计数器，前缀就是这个留白的 id（不叠加外层的）。 */
    child(holeId: string): SiteCounters;
}
/**
 * ask label: an inline `agent("name", …)` receiver contributes its literal name;
 * a plain identifier receiver contributes its text; otherwise `"ask"`.
 */
export declare function askLabel(receiver: ts.Expression, checker: ts.TypeChecker): string;
/**
 * ask label pattern: only for an inline `` agent(`研究员${i}`) `` receiver — the one shape
 * `askLabel` answers `"ask"` for despite the script having said something. A named or
 * identifier receiver already produced a real label, so there is nothing to reconstruct.
 */
export declare function askLabelPattern(receiver: ts.Expression, checker: ts.TypeChecker): NamePattern | undefined;
/**
 * actor name: a string-literal first argument, else the binding name when the call
 * directly initializes a variable declaration, else undefined.
 */
export declare function actorName(call: ts.CallExpression): string | undefined;
/**
 * actor name pattern: the static shape of a first argument that is a template literal
 * with holes. Only consulted when `actorName` came back undefined — a literal name and a
 * binding name are both real names, and a pattern must never displace one.
 */
export declare function actorNamePattern(call: ts.CallExpression): NamePattern | undefined;
/** world-read label: the op name, plus a string-literal first argument when present. */
export declare function worldReadLabel(op: WorldReadOp, arg: ts.Expression | undefined): string;
export declare function eachCandidate(call: ts.CallExpression, semantics: CallbackSemantics, order: number, loc: ScriptLoc): IterationCandidate | undefined;
export declare function forOfCandidate(statement: ts.ForOfStatement, order: number, loc: ScriptLoc): IterationCandidate;
//# sourceMappingURL=sites-labels.d.ts.map