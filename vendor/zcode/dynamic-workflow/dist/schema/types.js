/**
 * schema 子系统的共享词汇：我们「发射（emit）」的 JSON Schema 子集类型，以及校验器
 * 产出的违规（violation）模型。这里的 {@link JsonSchema} 不是通用 JSON Schema —— 它
 * 精确对应 {@link synthesizeAskSchemas} 会产出的关键字集合，校验器也只理解这一子集。
 */
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
