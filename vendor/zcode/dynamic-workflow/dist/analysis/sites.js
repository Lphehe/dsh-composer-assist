import ts from "typescript";
import { artifactRowOfSymbol, markerFunctionOfSymbol, worldReadOpOfSymbol, siteProducingFunctionOfSymbol, } from "../facade/registry.js";
import { WORKFLOW_FUNCTION_NAME, } from "../compiler/compile.js";
import { callbackSemanticsOf, isGlobalLibValue } from "./callbacks.js";
import { actorName, actorNamePattern, askLabel, askLabelPattern, eachCandidate, forOfCandidate, isFacadeDeclared, literalText, resolveSymbol, SiteCounters, worldReadLabel, } from "./sites-labels.js";
import { holeSiteOf } from "./hole-sites.js";
import { holeSiteId } from "./hole-id.js";
// 拆分：本文件顶到 oxlint max-lines 上限（400 行）。名字 / 标签辅助与符号解析
// （resolveSymbol / isFacadeDeclared）搬到 sites-labels.ts；后两者原本就从这里导出，故原样
// 再导出，既有的 `from "./sites.js"` 引用一个不改。站点类型留在本文件（五个模块按此路径导入）。
export { isFacadeDeclared, resolveSymbol } from "./sites-labels.js";
/** Collect the site table by walking the wrapped script's `__workflowScript__` body. */
export function collectSites(workflow) {
    const { program, scriptFile, toScriptLoc } = workflow;
    const checker = program.getTypeChecker();
    const body = findWorkflowBody(scriptFile);
    const table = {
        actors: [],
        artifacts: [],
        asks: [],
        holes: [],
        iterations: [],
        joins: [],
        phases: [],
        reports: [],
        topLevelReturns: [],
        worldReads: [],
    };
    let order = 0;
    const locOf = (node) => toScriptLoc(node.getStart(scriptFile));
    // `ids` 是当前作用域的 per-kind 计数器组：顶层一套，每个留白函数体一套新的（带前缀）。
    // 返回值只在收到一个**带函数体的留白**时非空：walk 据此给函数体换计数器。
    const classify = (node, funcDepth, ids) => {
        if (ts.isReturnStatement(node)) {
            if (funcDepth === 0) {
                table.topLevelReturns.push({ expression: node.expression, loc: locOf(node) });
            }
            return;
        }
        if (ts.isForOfStatement(node)) {
            table.iterations.push(forOfCandidate(node, order++, locOf(node)));
            return;
        }
        if (!ts.isCallExpression(node))
            return;
        if (ts.isPropertyAccessExpression(node.expression)) {
            const access = node.expression;
            const propSymbol = checker.getSymbolAtLocation(access.name);
            if (isFacadeDeclared(propSymbol)) {
                const name = access.name.text;
                if (name === "ask") {
                    const labelPattern = askLabelPattern(access.expression, checker);
                    table.asks.push({
                        call: node,
                        id: ids.next("ask"),
                        instructions: node.arguments[0],
                        label: askLabel(access.expression, checker),
                        ...(labelPattern === undefined ? {} : { labelPattern }),
                        loc: toScriptLoc(access.name.getStart(scriptFile)),
                        order: order++,
                        receiver: access.expression,
                    });
                    return;
                }
                // 产物成员先于 world-read 判定，两张表互斥（同一个 (容器,成员) 不可能同时在两张
                // 表里）。身份同样按**声明容器**取，不按名字：`artifact.table` 与脚本自己的某个
                // `table` 方法只有声明能分辨。
                const artifact = artifactRowOfSymbol(propSymbol);
                if (artifact !== undefined) {
                    const idExpr = node.arguments[0];
                    const id = literalText(idExpr);
                    table.artifacts.push({
                        artifactIdExpr: idExpr,
                        ...(id === undefined ? {} : { artifactId: id }),
                        call: node,
                        id: ids.next("artifact"),
                        loc: toScriptLoc(access.name.getStart(scriptFile)),
                        op: artifact.op,
                        order: order++,
                    });
                    return;
                }
                // World-read identity comes from the registry, keyed on the member's DECLARING
                // CONTAINER — never on its bare name. `git.log` collides with the top-level
                // `log()` by name, so a bare-name test would either mint a world-read site for
                // every progress message or drop `git.log`'s site entirely; a facade call with no
                // site has no journal key, which is the exact unsoundness the facade-siting rule
                // exists to prevent.
                const op = worldReadOpOfSymbol(propSymbol);
                if (op !== undefined) {
                    table.worldReads.push({
                        args: node.arguments,
                        call: node,
                        id: ids.next("world-read"),
                        label: worldReadLabel(op, node.arguments[0]),
                        loc: toScriptLoc(access.name.getStart(scriptFile)),
                        op,
                        order: order++,
                    });
                }
                return;
            }
            const method = access.name.text;
            if ((method === "all" || method === "allSettled") &&
                isGlobalLibValue(access.expression, "Promise", checker, program)) {
                table.joins.push({
                    arg: node.arguments[0],
                    call: node,
                    id: ids.next("join"),
                    label: "join",
                    loc: toScriptLoc(access.name.getStart(scriptFile)),
                    method,
                    order: order++,
                });
                return;
            }
            // Per-element callback calls per the registry (`xs.map(fn)`, `Array.from(xs, fn)`, …)
            // register as fan-out candidates whatever shape the callback argument has.
            const semantics = callbackSemanticsOf(node, checker, program);
            if (semantics?.multiplicity === "each") {
                const candidate = eachCandidate(node, semantics, order, locOf(node));
                if (candidate !== undefined) {
                    order++;
                    table.iterations.push(candidate);
                }
            }
            return;
        }
        // Bare-callee call: the facade ones are `agent(...)` and `report(...)`. Which
        // top-level functions produce sites lives in the registry, not here — `log()` is a
        // bare facade call too, and the difference between it and `report()` is that a report
        // has a journal row keyed by its site.
        const calleeSymbol = resolveSymbol(node.expression, checker);
        const fn = siteProducingFunctionOfSymbol(calleeSymbol);
        if (fn === "agent") {
            const name = actorName(node);
            // pattern 只在真拿不到名字时才求：字面量名与绑定名都是**名字**，重建物不得顶掉它们。
            const namePattern = name === undefined ? actorNamePattern(node) : undefined;
            table.actors.push({
                call: node,
                id: ids.next("actor"),
                loc: locOf(node),
                name,
                ...(namePattern === undefined ? {} : { namePattern }),
                order: order++,
            });
            return;
        }
        if (fn === "report") {
            // 第二实参是**产物标签**：只有无洞字面量才算标签，
            // 其余（标识符、带洞模板）留给 artifacts 诊断趟按 artifactIdExpr 定位——绝不在这里
            // 猜一个 id 出来，那会让一条指向不存在看板的 report 静默通过编译。
            const tagExpr = node.arguments[1];
            const tag = literalText(tagExpr);
            table.reports.push({
                artifactIdExpr: tagExpr,
                ...(tag === undefined ? {} : { artifactId: tag }),
                call: node,
                id: ids.next("report"),
                item: node.arguments[0],
                loc: locOf(node),
                order: order++,
            });
            return;
        }
        if (fn === "hole") {
            // 留白（docs/analysis.md「Sites」的 Hole sites 段）：id 是名字键（hole-id.ts），占全局 order；
            // 带函数体时交回给 walk，让函数体在一套**全新的、带前缀的**计数器下走查。名字不是字面量
            // 时（9012，脚本提交不了）退回位置计数器，只为让诊断有个可定位的站点。
            const holeName = literalText(node.arguments[0]);
            const holeId = holeName === undefined ? ids.next("hole") : holeSiteId(holeName);
            const site = holeSiteOf(node, holeId, order++, locOf(node), funcDepth, ids.holeId);
            table.holes.push(site);
            return site.body === undefined ? undefined : site;
        }
        // `phase("…")` is a marker, not a site: no id and no counter of any kind is consumed
        // here (see PhaseMarkerSite). Resolved by declaration like the calls above — a
        // script-local function named `phase` is somebody else's function.
        if (markerFunctionOfSymbol(calleeSymbol) === "phase") {
            const nameExpr = node.arguments[0];
            const name = literalText(nameExpr);
            table.phases.push({
                call: node,
                loc: locOf(node),
                ...(name === undefined ? {} : { name }),
                nameExpr,
            });
        }
    };
    const walk = (node, funcDepth, ids) => {
        const hole = classify(node, funcDepth, ids);
        const childDepth = funcDepth + (isFunctionLike(node) ? 1 : 0);
        ts.forEachChild(node, (child) => walk(child, childDepth, hole !== undefined && child === hole.body ? ids.child(hole.id) : ids));
    };
    // 顶层一套计数器贯穿整个脚本体（每个语句都用同一套！）；留白函数体各自换一套带前缀的。
    const topLevel = new SiteCounters();
    for (const statement of body.statements)
        walk(statement, 0, topLevel);
    return table;
}
/**
 * The authored script body: the wrapper function's block. Exported for the causality
 * pass, which walks the same body in evaluation order. Read-only — it collects nothing
 * into the site table, so site ids stay bit-for-bit identical.
 */
export function findWorkflowBody(scriptFile) {
    for (const statement of scriptFile.statements) {
        if (ts.isFunctionDeclaration(statement) &&
            statement.name?.text === WORKFLOW_FUNCTION_NAME &&
            statement.body !== undefined) {
            return statement.body;
        }
    }
    throw new Error(`workflow wrapper function ${WORKFLOW_FUNCTION_NAME} not found`);
}
/** True iff the node introduces its own function scope (a body that runs only when called). */
export function isFunctionLike(node) {
    return (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node) ||
        ts.isConstructorDeclaration(node));
}
