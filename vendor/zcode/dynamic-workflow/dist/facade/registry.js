import ts from "typescript";
import { FACADE_FILE_NAME } from "./dts.js";
/**
 * world-read 注册表。加原语=加一行。
 *
 * `git.log` 那一行是这张表存在的理由：它的成员名与顶层 `log()` 撞名，而这里的键带容器，
 * 所以两者从不相遇（见本模块顶部）。
 */
export const WORLD_READ_REGISTRY = [
    { container: "files", member: "glob", op: "glob" },
    { container: "files", member: "read", op: "read" },
    { container: "files", member: "grep", op: "grep" },
    { container: "git", member: "changedFiles", op: "git-changed-files" },
    { container: "git", member: "diff", op: "git-diff" },
    { container: "git", member: "status", op: "git-status" },
    { container: "git", member: "log", op: "git-log" },
    // world.run：journal 化命令执行。同一张表、同一套
    // 机制——「读」与「效应」的差别在授权面（编译期字面量 cmd + 确认窗）与 journal 的
    // 节点种类（world-run），不在站点身份。
    { container: "world", member: "run", op: "run" },
];
/** 产物注册表。加一个产物种类 = 加一行。 */
export const ARTIFACT_REGISTRY = [
    { container: "artifact", member: "file", op: "file", family: "content" },
    { container: "artifact", member: "markdown", op: "markdown", family: "content" },
    { container: "artifact", member: "chart", op: "chart", family: "preset" },
    { container: "artifact", member: "table", op: "table", family: "preset" },
    { container: "artifact", member: "metrics", op: "metrics", family: "preset" },
    { container: "artifact", member: "board", op: "board", family: "preset" },
];
/**
 * 注册表查询：(容器, 成员) → 产物行。非产物成员返回 undefined。
 *
 * 返回**表元素的字面量类型**（而不是宽化的 {@link ArtifactRow}）：`op` 与 `family` 的联合
 * 类型全由这张表推导，宽化一次就等于把它们退回成 `string`，站点表与 lowering 也就跟着
 * 失去分派依据。
 */
function artifactRow(container, member) {
    if (container === undefined)
        return undefined;
    return ARTIFACT_REGISTRY.find((row) => row.container === container && row.member === member);
}
/** 某 facade symbol 解析到的产物行（按声明容器判定），非产物成员则 undefined。 */
export function artifactRowOfSymbol(symbol) {
    const member = facadeMemberOf(symbol);
    if (member === undefined)
        return undefined;
    return artifactRow(member.container, member.member);
}
/** 某产物 op 属于哪一族。op 由注册表推导，故这里必然命中。 */
export function artifactFamilyOf(op) {
    const row = ARTIFACT_REGISTRY.find((candidate) => candidate.op === op);
    if (row === undefined)
        throw new Error(`unknown artifact op: ${op}`);
    return row.family;
}
/** 该 op 是否为预置成员（声明族）。引擎与分析器都据它分派两条完全不同的路径。 */
export function isArtifactPresetOp(op) {
    return ARTIFACT_REGISTRY.some((row) => row.op === op && row.family === "preset");
}
/**
 * `ask` 所在的容器：不是 world-read，但同为**产生站点**的 facade 成员，故 facade-siting
 * 规则同样约束它（只允许直接调用）。放在这里是为了让"哪些成员产生站点"只有一份清单。
 */
const ASK_MEMBER = { container: "Agent", member: "ask" };
/**
 * 顶层 facade 函数中产生站点的那些（无容器）。`log` 不产生站点，故不在此。`hole` 在此：留白
 * 有站点 id（名字键 `hole#<hash>`）与 host 调用（docs/dynamic-workflow/authoring.md「Holes」），身份同样按
 * **声明文件**判定——脚本自己的 `hole` 函数是别人的函数。
 */
const SITE_PRODUCING_FUNCTIONS = ["agent", "report", "hole"];
/**
 * 某 facade symbol 解析到的产生站点的**顶层函数**（按声明判定：容器必须缺席）。
 * 非 facade symbol、facade 容器成员、以及 `log` 之类不产生站点的顶层函数都返回 undefined。
 */
export function siteProducingFunctionOfSymbol(symbol) {
    const member = facadeMemberOf(symbol);
    if (member === undefined || member.container !== undefined)
        return undefined;
    return SITE_PRODUCING_FUNCTIONS.find((name) => name === member.member);
}
/**
 * 顶层 facade 函数中**展示用的标记**：有 facade 身份，但不产生站点。目前只有 `phase`。
 *
 * 为什么它不在 {@link SITE_PRODUCING_FUNCTIONS} 里，而是自成一列：那份清单回答的是
 * 「哪个顶层函数产生站点」，而 `phase` 没有站点 id、没有 journal 行、没有 host 调用——
 * lowering 直接把它抹成 `void 0`。把它混进产生站点的清单会让 facade-misuse 的 pass 2（"产生站点却没被 site
 * 掉的直接调用"）拒绝每一次合法的 `phase("gate")`。
 *
 * 它仍然是 facade 函数声明，所以别名逃逸（`const p = phase`）照旧被 facade-misuse 的
 * pass 1 拒绝——lowering 因此可以放心按节点身份抹除。
 */
const MARKER_FUNCTIONS = ["phase"];
/**
 * 某 facade symbol 解析到的**展示标记**顶层函数（按声明判定：容器必须缺席），
 * 非标记则 undefined。与 {@link siteProducingFunctionOfSymbol} 同形、刻意不同表。
 */
export function markerFunctionOfSymbol(symbol) {
    const member = facadeMemberOf(symbol);
    if (member === undefined || member.container !== undefined)
        return undefined;
    return MARKER_FUNCTIONS.find((name) => name === member.member);
}
/**
 * 顶层 facade 函数中**纯值构造**的那些：有 facade 身份，但不产生站点、不过 host。目前只有
 * `model`（docs/dynamic-workflow/authoring.md「Choosing a model per subagent」）。
 *
 * `ModelRef` 只活在类型系统里：运行期它就是模型名字符串本身，所以 lowering 把 `model("x")`
 * 抹成实参 `"x"`，沙箱里既没有 `__host.model`，也没有 journal 行。与 `phase` 分列的理由同
 * {@link MARKER_FUNCTIONS}：它不产生站点，混进产生站点的清单会让 facade-misuse 的 pass 2 拒绝
 * 每一次合法调用；它仍是 facade 函数声明，所以别名逃逸（`const m = model`）照旧被 pass 1 拒绝，
 * lowering 因此可以放心按节点身份抹除。
 */
const VALUE_FUNCTIONS = ["model"];
/** 某 facade symbol 解析到的纯值顶层函数（按声明判定：容器必须缺席），否则 undefined。 */
export function valueFunctionOfSymbol(symbol) {
    const member = facadeMemberOf(symbol);
    if (member === undefined || member.container !== undefined)
        return undefined;
    return VALUE_FUNCTIONS.find((name) => name === member.member);
}
/**
 * 全部产生站点的 facade 成员名（world-read 成员 + `ask`）。**裸名字**清单，只可用于
 * "先按名字取候选、再按声明验身份"的两段式判定——不可单独作为身份依据（见本模块顶部）。
 *
 * `git.log` 落地后这个集合里**含有 `"log"`**，而顶层 `log()` 不产生站点。这不是矛盾，
 * 而是这份清单为什么只能当候选键的证明：身份必须由 (容器, 成员) 或声明解析给出，
 * 名字本身答不了。唯一还被依赖的性质是**没有两个 facade 容器声明同名成员**——
 * 集合不带容器，重名会让由它反查出的那个名字变得二义（facade-misuse 的诊断文案会引它）。
 */
export const SITE_MEMBER_NAMES = new Set([
    ASK_MEMBER.member,
    ...WORLD_READ_REGISTRY.map((row) => row.member),
    ...ARTIFACT_REGISTRY.map((row) => row.member),
]);
/**
 * 注册表查询：(容器, 成员) → op。容器为 undefined（顶层函数）时永不命中——world-read
 * 一律挂在 facade 容器对象上。
 */
export function worldReadOp(container, member) {
    if (container === undefined)
        return undefined;
    return WORLD_READ_REGISTRY.find((row) => row.container === container && row.member === member)
        ?.op;
}
/**
 * (容器, 成员) 是否为产生站点的 facade 调用（world-read、产物、`Agent.ask`、或顶层
 * `agent`/`report`）。
 *
 * 产物成员在这里，与 `report` 同一条理由：它们有 journal 键（`artifact#N` × ordinal），
 * 而一次没有站点的发布就是一行没有键的 journal 记录——那正是 facade-siting 规则要防的。
 */
export function isSiteProducing(container, member) {
    if (container === undefined)
        return SITE_PRODUCING_FUNCTIONS.some((name) => name === member);
    if (container === ASK_MEMBER.container && member === ASK_MEMBER.member)
        return true;
    if (artifactRow(container, member) !== undefined)
        return true;
    return worldReadOp(container, member) !== undefined;
}
/**
 * 一个 facade 声明所属的**容器名**：`declare const files: { glob(...) }` 的 `glob` → `"files"`，
 * `declare interface Agent { ask(...) }` 的 `ask` → `"Agent"`，顶层 `declare function agent()` →
 * undefined（无容器）。
 *
 * 实现：成员的声明是类型字面量/接口体里的一个 method/property signature，据此向上走到
 * VariableDeclaration（const 容器）或 InterfaceDeclaration / TypeAliasDeclaration（命名类型容器）
 * 取其名字。只认落在 facade `.d.ts` 里的声明——脚本自定义的同名成员一律 undefined。
 */
export function facadeContainerOf(declaration) {
    if (declaration === undefined)
        return undefined;
    if (declaration.getSourceFile().fileName !== FACADE_FILE_NAME)
        return undefined;
    for (let node = declaration.parent; node !== undefined; node = node.parent) {
        if (ts.isVariableDeclaration(node)) {
            return ts.isIdentifier(node.name) ? node.name.text : undefined;
        }
        if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node))
            return node.name.text;
        if (ts.isSourceFile(node))
            return undefined;
    }
    return undefined;
}
/**
 * 一个 facade symbol 的 (容器, 成员) 身份。symbol 的任一声明落在 facade `.d.ts` 内即算命中；
 * 容器由该声明向上解析（顶层 facade 函数无容器）。非 facade symbol → undefined。
 */
export function facadeMemberOf(symbol) {
    const declaration = symbol?.declarations?.find((decl) => decl.getSourceFile().fileName === FACADE_FILE_NAME);
    if (declaration === undefined || symbol === undefined)
        return undefined;
    return { container: facadeContainerOf(declaration), member: symbol.name };
}
/** 某 facade symbol 解析到的 world-read op（按声明容器判定），非 world-read 则 undefined。 */
export function worldReadOpOfSymbol(symbol) {
    const member = facadeMemberOf(symbol);
    if (member === undefined)
        return undefined;
    return worldReadOp(member.container, member.member);
}
