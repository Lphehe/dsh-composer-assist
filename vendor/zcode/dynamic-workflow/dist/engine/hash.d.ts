/**
 * 包内自带的确定性哈希：FNV-1a（32 位）作用在规范化 JSON 上。
 * 不用 node:crypto——src/ 保持纯净可移植，哈希只作为 replay 时的防御性一致性校验
 * （不是密码学用途，抗碰撞要求低，确定性与可移植才是重点）。
 */
/**
 * 规范化 JSON 序列化：对象键按 code point 排序，从而对语义相同的值给出稳定字节序。
 * 只覆盖 host 调用会用到的 JSON 值（string/number/boolean/null/array/plain object）。
 * undefined / 函数等非 JSON 值不应出现在这条路径上；遇到时序列化为 "null" 以保持全函数性。
 */
export declare function canonicalJson(value: unknown): string;
/** FNV-1a 32 位哈希，输出 8 位十六进制字符串。 */
export declare function fnv1a(input: string): string;
/** 计算一个 host 调用输入的防御性哈希：对规范化 JSON 取 FNV-1a。 */
export declare function inputHash(value: unknown): string;
//# sourceMappingURL=hash.d.ts.map