import ts from "typescript";
import type { JsonSchema } from "./types.js";
/**
 * 采集一个符号上的 description 与约束标签，返回一个只含相关关键字的 schema 片段，
 * 供合成侧合并进该符号对应的 schema。
 */
export declare function harvestConstraints(symbol: ts.Symbol, checker: ts.TypeChecker): Partial<JsonSchema>;
/** 把采集到的片段合并进已有 schema：约束关键字补充上去，description 不覆盖已有值。 */
export declare function mergeConstraints(schema: JsonSchema, extra: Partial<JsonSchema>): JsonSchema;
//# sourceMappingURL=jsdoc.d.ts.map