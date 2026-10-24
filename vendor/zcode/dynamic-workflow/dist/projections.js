/**
 * 浏览器安全的纯投影桶：
 * `@zcode/dynamic-workflow/projections`。
 *
 * 下游浏览器端消费者把 `AnalysisCore` 冻结成 core.json，在浏览器里解码后现场重算站点图 / 因果图 /
 * CFG / 交接图 / actor 图，再用 `*ToMermaid` 或 display 契约画出来。那条链上不能有
 * `typescript`——它是分析器铸造 core 时才需要的编译器，几 MB 大，也不该进前端包。
 *
 * 因此这里**只**再导出运行时不 import `typescript` 的模块：core 的类型与规范文本、JSON
 * 编解码、五个投影、归约器、mermaid 与文本序列化器、图类型。`analyzeWorkflowScript`、
 * 编译器、lowering、引擎一概不在——它们走根导出。
 */
export { isActorSite, serializeCore, } from "./analysis/core.js";
export { decodeAnalysisCore, encodeAnalysisCore, } from "./analysis/core-json.js";
export { isStructuralRegionKind, UNPHASED_ID, } from "./analysis/constants.js";
export { projectSiteGraph } from "./analysis/graph.js";
export { toActorGraph } from "./analysis/actor-graph.js";
export { MAIN_LANE, projectCausalityGraph, SINK_ID, UNKNOWN_LANE, WORKSPACE_LANE, } from "./analysis/causality-graph.js";
export { reduceOrdering } from "./analysis/causality-reduce.js";
export { FLOW_ABORT, FLOW_ENTRY, FLOW_SINK, projectControlFlow, } from "./analysis/flow-graph.js";
export { FANOUT_EXPAND_CAP, projectHandoffGraph, UNPHASED, } from "./analysis/handoff-graph.js";
export { actorGraphToMermaid, causalityGraphToMermaid, controlFlowToMermaid, handoffGraphToMermaid, phaseFlowToMermaid, phaseGraphToMermaid, siteGraphToMermaid, } from "./analysis/mermaid.js";
export { serializeActorGraph, serializeCausalityGraph, serializeControlFlow, serializeGraph, serializeHandoffGraph, } from "./analysis/serialize.js";
