/**
 * journal 读面的选项词汇表（docs/execution-engine.md「Reading the journal」）。
 *
 * 一条 run 的表随它做过的一切增长：每次调用一行节点，ask 的回答与 world read 的结果在
 * `result_json`，每条 report item 更是存了两份（节点行 + `report` 事件的载荷）。所以没有读者
 * 可以「整表读进内存再过滤」：每次读都说清自己要什么，过滤、计数、分组都在存储层做。
 *
 * 选项是**必填**的而不是带缺省：一次整表读必须在调用点写出 `"all"`，于是它在代码评审与
 * grep 里都看得见，不会借一个缺省参数悄悄回来。
 *
 * 独立成模块：types.ts 顶在 oxlint max-lines 上限（400 行）。
 */
/**
 * 全部节点 kind。`Record<NodeKind, true>` 让新增的 kind 在这里编译失败，而不是被一份手写
 * 列表悄悄漏掉——{@link NON_REPORT_NODE_KINDS} 这类「除了某种之外」的集合都从它派生。
 */
const NODE_KIND_SET = {
    ask: true,
    "world-read": true,
    "world-run": true,
    report: true,
    artifact: true,
};
export const NODE_KINDS = Object.keys(NODE_KIND_SET);
/** 除 `report` 之外的全部 kind：读「这条 run 做过的事」而不碰报告条目的读者用它。 */
export const NON_REPORT_NODE_KINDS = NODE_KINDS.filter((kind) => kind !== "report");
/** 整条事件日志、report item 不剥：只给真要逐字节重放全部事件的读者（与测试）。 */
export const ALL_EVENTS = { types: "all", reportItems: "all" };
