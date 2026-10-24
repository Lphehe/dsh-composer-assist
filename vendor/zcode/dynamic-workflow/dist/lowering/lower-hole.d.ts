import ts from "typescript";
import type { HoleSite } from "../analysis/sites.js";
/** 两趟降级共用的擦除选项：主体与留白函数体必须由**同一套**参数产出（execution-engine.md「The text that runs」）。 */
export declare const TRANSPILE_OPTIONS: ts.CompilerOptions;
/** 一次留白调用的改写；已补全的留白把改写后的函数体记进 `bodies`，供 {@link printHoleBodies} 打印。 */
export declare function lowerHoleCall(call: ts.CallExpression, site: HoleSite, factory: ts.NodeFactory, hostMember: (name: string) => ts.Expression, siteArg: (id: string) => ts.Expression, visitExpr: (expr: ts.Expression) => ts.Expression, bodies: Map<string, ts.Expression>): ts.Expression;
/**
 * 每个已补全留白的函数体，作为**打印过、擦除过类型**的文本 `(async () => {\n…\n})`：活的补全
 * 让 cell 对它 `eval`，之后的 replay 则跑主体里内联的同一份改写——两条路的每个站点都带同样的
 * `hole#<hash>/…` id，因为文本来自同一趟 transform（execution-engine.md「The text that runs」）。
 *
 * 打印成表达式语句再擦除，尾随的 `;\n` 是 transpile 加的语句结束，去掉——留下的就是一个可以
 * 直接 `eval` 成函数值的括号表达式。
 */
export declare function printHoleBodies(bodies: ReadonlyMap<string, ts.Expression>, printer: ts.Printer, sourceFile: ts.SourceFile): Record<string, string>;
//# sourceMappingURL=lower-hole.d.ts.map