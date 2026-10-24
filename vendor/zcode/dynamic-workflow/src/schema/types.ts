/**
 * schema 子系统的共享词汇：我们「发射（emit）」的 JSON Schema 子集类型，以及校验器
 * 产出的违规（violation）模型。这里的 {@link JsonSchema} 不是通用 JSON Schema —— 它
 * 精确对应 {@link synthesizeAskSchemas} 会产出的关键字集合，校验器也只理解这一子集。
 */

/** 任意合法 JSON 值。const/enum/default 里出现的字面量都用它表达。 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** 我们会发射的 JSON Schema 基础类型标签。`integer` 校验器支持但合成侧不会主动产出。 */
export type JsonSchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "null"
  | "array"
  | "object";

/**
 * 我们发射的 JSON Schema 子集。字段是可选关键字的并集：一个具体 schema 只会用到其中
 * 与其形状相关的少数几个（例如 object schema 用 properties/required/additionalProperties，
 * 而 union 用 enum 或 anyOf）。校验器只处理这里出现的关键字。
 */
export interface JsonSchema {
  // 结构
  type?: JsonSchemaType | JsonSchemaType[];
  const?: JsonValue;
  enum?: JsonValue[];
  anyOf?: JsonSchema[];
  // object
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  // array / tuple
  items?: JsonSchema;
  prefixItems?: JsonSchema[];
  minItems?: number;
  maxItems?: number;
  // string 约束
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  // number 约束
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  // 注解
  description?: string;
  default?: JsonValue;
  // 递归类型：引用与定义表
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
}

/**
 * 校验器产出的单条违规，设计成可直接进入修复用的 tool_result：一行一条，包含
 * JSON 路径、期望（expected）与实得（got）。
 */
export interface Violation {
  /** 违规所在位置的 JSON 路径，形如 `$`、`$.foo`、`$.items[0]`。 */
  path: string;
  /** 期望的形状/取值的简短描述。 */
  expected: string;
  /** 实际取到的值的简短描述。 */
  got: string;
}

/** 合成侧诊断码。9001 已被 facade-siting 规则占用（见 analysis/sites.ts）。 */
export const SCHEMA_DIAGNOSTIC_CODE = 9002;

/**
 * union 成员数量上限。超过即视为“病态宽 union”并在 ask 站点报诊断。
 *
 * 取 100：既能容纳合理的枚举（状态码、国家码等常见枚举都远低于此），又能挡住
 * 明显是失控类型的情况。同时作用于字面量 union（→ enum）与一般 union（→ anyOf）的成员数。
 *
 * 现实中触发它的通常不是手写的巨型 union，而是 checker 展开模板字面量类型（template
 * literal type）后产生的笛卡尔积——例如 `` `${Dir}-${Size}` `` 会被展开成所有组合的
 * 字面量 union，几个维度一交叉就会爆炸。
 */
export const MAX_UNION_MEMBERS = 100;
