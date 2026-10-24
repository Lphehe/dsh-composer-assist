/**
 * 追踪词汇：区域种类、跳转种类与兜底阶段 id。它们原本住在 causality-order.ts，但那个文件
 * 在运行时 import `typescript`（走 AST 的 walk 本身），而只读 core 的纯投影（causality-graph /
 * flow-phase / phase-graph）只需要这几个值。把它们放进一个零依赖的小文件，投影模块就不再
 * 把 `typescript` 拖进运行时闭包——这是作品集浏览器包（
 * `@zcode/dynamic-workflow/projections`）能成立的前提。causality-order.ts 原样再导出，
 * 所有既有引用位置与行为不变。
 */
const STRUCTURAL_REGION_KINDS = new Set([
    "choice",
    "call",
    "try",
    "attempt",
    "catch",
    "finally",
]);
export function isStructuralRegionKind(kind) {
    return STRUCTURAL_REGION_KINDS.has(kind);
}
/** The reserved fallback phase: the root block's initial current phase, and where every
 * step issued before the script's first marker lands. It has no `name` — the UI shows a
 * localized word, exactly as it does for the `workspace` / `unknown` lanes. */
export const UNPHASED_ID = "unphased";
