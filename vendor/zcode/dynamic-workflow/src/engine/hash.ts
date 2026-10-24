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
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    // 基本类型：交给 JSON.stringify（数字/布尔/字符串），undefined/函数回落为 null。
    const s = JSON.stringify(value);
    return s === undefined ? "null" : s;
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts: string[] = [];
  for (const key of keys) {
    const v = obj[key];
    // 跳过 undefined 成员，与 JSON.stringify 对象语义一致。
    if (v === undefined) continue;
    parts.push(`${JSON.stringify(key)}:${canonicalJson(v)}`);
  }
  return `{${parts.join(",")}}`;
}

/** FNV-1a 32 位哈希，输出 8 位十六进制字符串。 */
export function fnv1a(input: string): string {
  // FNV offset basis / prime（32 位）。用 Math.imul 保证 32 位乘法回绕。
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i) & 0xff;
    // 高位字节也纳入，避免只哈希低字节丢失多字节字符的区分度。
    hash ^= (input.charCodeAt(i) >> 8) & 0xff;
    hash = Math.imul(hash, 0x01000193);
  }
  // 转无符号并补零到 8 位十六进制。
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** 计算一个 host 调用输入的防御性哈希：对规范化 JSON 取 FNV-1a。 */
export function inputHash(value: unknown): string {
  return fnv1a(canonicalJson(value));
}
