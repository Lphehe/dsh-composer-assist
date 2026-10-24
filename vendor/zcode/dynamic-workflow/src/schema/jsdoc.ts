import ts from "typescript";
import type { JsonSchema, JsonValue } from "./types.js";

/**
 * JSDoc 采集：把符号（interface 成员、类型别名、ask 结果类型）上的文档注释与受支持的
 * 约束标签抽成 JSON Schema 片段。
 *
 * - 文档正文 → `description`。
 * - 标签子集 → 约束关键字：`@minimum @maximum @exclusiveMinimum @exclusiveMaximum
 *   @minLength @maxLength @pattern @format @minItems @maxItems @default`。
 *
 * 子集之外的标签被静默忽略（不是错误）。
 */

/** 取数值的标签 → 对应的数值型关键字名。 */
const NUMERIC_TAGS: Record<string, keyof JsonSchema> = {
  exclusiveMaximum: "exclusiveMaximum",
  exclusiveMinimum: "exclusiveMinimum",
  maximum: "maximum",
  maxItems: "maxItems",
  maxLength: "maxLength",
  minimum: "minimum",
  minItems: "minItems",
  minLength: "minLength",
};

/** 取字符串的标签 → 对应的字符串型关键字名。 */
const STRING_TAGS: Record<string, keyof JsonSchema> = {
  format: "format",
  pattern: "pattern",
};

/**
 * 采集一个符号上的 description 与约束标签，返回一个只含相关关键字的 schema 片段，
 * 供合成侧合并进该符号对应的 schema。
 */
export function harvestConstraints(symbol: ts.Symbol, checker: ts.TypeChecker): Partial<JsonSchema> {
  const out: Partial<JsonSchema> = {};

  const doc = ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim();
  if (doc.length > 0) out.description = doc;

  for (const tag of symbol.getJsDocTags(checker)) applyTag(out, tag);
  return out;
}

function applyTag(out: Partial<JsonSchema>, tag: ts.JSDocTagInfo): void {
  const raw = ts.displayPartsToString(tag.text).trim();

  const numericKey = NUMERIC_TAGS[tag.name];
  if (numericKey !== undefined) {
    const value = Number(raw);
    if (Number.isFinite(value)) (out as Record<string, unknown>)[numericKey] = value;
    return;
  }

  const stringKey = STRING_TAGS[tag.name];
  if (stringKey !== undefined) {
    if (raw.length > 0) (out as Record<string, unknown>)[stringKey] = raw;
    return;
  }

  if (tag.name === "default") {
    out.default = parseDefault(raw);
  }
  // 子集之外的标签：忽略。
}

/** `@default` 的值先按 JSON 解析（数字/布尔/对象/数组/带引号字符串），失败则当作裸字符串。 */
function parseDefault(raw: string): JsonValue {
  if (raw.length === 0) return "";
  try {
    return JSON.parse(raw) as JsonValue;
  } catch {
    return raw;
  }
}

/** 把采集到的片段合并进已有 schema：约束关键字补充上去，description 不覆盖已有值。 */
export function mergeConstraints(schema: JsonSchema, extra: Partial<JsonSchema>): JsonSchema {
  const merged: JsonSchema = { ...schema };
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) continue;
    if (key === "description" && merged.description !== undefined) continue;
    (merged as Record<string, unknown>)[key] = value;
  }
  return merged;
}
