import type { JsonSchema, Violation } from "./types.js";
/**
 * 纯校验器，覆盖范围恰好是 {@link synthesizeAskSchemas} 会发射的 JSON Schema 子集
 * （不是通用 JSON Schema）。产出违规列表，每条设计成可直接进修复用 tool_result：
 * 一行 JSON 路径 + 期望 + 实得。
 *
 * 空 schema `{}`（unknown 的许可式 schema）匹配任意合法 JSON。`$ref` 在传入的根 schema
 * 的 `$defs` 内解析。
 */
export declare function validate(schema: JsonSchema, value: unknown): Violation[];
/** 把一条违规格式化为单行：`<path>: expected <expected>, got <got>`。 */
export declare function formatViolation(violation: Violation): string;
/** 把违规列表格式化为多行文本（每行一条）。 */
export declare function formatViolations(violations: readonly Violation[]): string;
//# sourceMappingURL=validate.d.ts.map