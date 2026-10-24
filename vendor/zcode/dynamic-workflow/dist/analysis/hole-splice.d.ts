import type { SiteTable } from "./sites.js";
/**
 * 补全服务的两件纯文本工具（execution-engine.md「The fill service's checks」）：把函数体拼进
 * 留白调用、以及补全前后站点表的稳定性复核。两者都不碰引擎与 journal，run service 按序调用。
 */
/** 拼接结果：新文本、第一行插入行的脚本行号（1-based）与插入的行数。 */
export interface SplicedHoleBody {
    text: string;
    insertedAtLine: number;
    insertedLines: number;
}
/**
 * 把 `body` 作为最后一个实参拼进留白调用：紧接在**最后一个实参的末尾**插入 `, async () => {\n<body>\n}`，
 * 函数体每行按调用所在行的缩进再加两格，右花括号取调用的缩进。返回 `undefined` 当留白不在表里
 * 或已经有函数体——补全一个已补全的留白不是拼接能表达的事。
 *
 * 插入点是最后一个实参的末尾而不是右括号之前：2026-09-28 首次实测里主代理按 prettier 的习惯写了
 * `hole<T>(\n  "名",\n  \`提示\`,\n);`——提示后面带一个尾随逗号——在右括号前插入就得到 `, , async`，
 * 四条语法错误全锚在草稿上，而草稿并没有错。接在实参末尾之后，原来的尾随逗号与换行留在函数体
 * 之后（`}, \n)`），仍是合法调用；实参与右括号之间的注释同样原样保留。
 *
 * `insertedAtLine` 是第一条函数体行在新脚本里的行号（`, async () => {` 留在最后一个实参结束的那一
 * 行上），`insertedLines` 是新增的换行数（函数体行数 + 右花括号那一行）：诊断按这两个数分到「补全
 * 文件内」与「草稿内」。
 */
export declare function spliceHoleBody(scriptText: string, table: SiteTable, holeSiteId: string, body: string): SplicedHoleBody | undefined;
/** 稳定性复核的结果：通过，或一句说明是哪个 id 在哪儿变了。 */
export type SiteStability = {
    ok: true;
} | {
    ok: false;
    detail: string;
};
/**
 * 补全前后站点表的稳定性（docs/analysis.md「Sites」的站点 id 稳定性规则，延伸到「加函数体」）：
 * `before` 的每个 id（全部种类）都在 `after` 里，位置不变或——落在插入点之后时——行号整体后移
 * `insertedLines`；`after` 里 `before` 没有的每个 id 都是这次补全写下的：带 `<holeSiteId>/`
 * 前缀，或者是函数体里新留的留白（`fill` 链通到 `holeSiteId`）及其体内的站点。哪条不成立都是
 * 宿主的错（分析器的编号规则被打破了），run 不能拿到它接不上的 id。
 *
 * 与插入点同一行、插入点之后的站点（`await hole(...); agent("a")` 写在一行）行号后移但列号
 * 变了：那一行只比对行号。
 */
export declare function checkSiteStability(before: SiteTable, after: SiteTable, holeSiteId: string, insertedAtLine: number, insertedLines: number): SiteStability;
//# sourceMappingURL=hole-splice.d.ts.map