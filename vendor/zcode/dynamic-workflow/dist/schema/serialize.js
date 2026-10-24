/**
 * 确定性序列化：把 schema 的对象键递归排序后再 JSON.stringify，保证快照稳定，与发射
 * 时的插入顺序无关。数组（enum/required/prefixItems/anyOf 等）保持原有顺序不动 ——
 * 它们的顺序是有意义的（且由 checker 的属性/成员顺序确定）。
 */
export function serializeSchema(schema) {
    return `${JSON.stringify(canonicalize(schema), null, 2)}\n`;
}
function canonicalize(value) {
    if (Array.isArray(value))
        return value.map(canonicalize);
    if (value !== null && typeof value === "object") {
        const sorted = {};
        for (const key of Object.keys(value).sort()) {
            sorted[key] = canonicalize(value[key]);
        }
        return sorted;
    }
    return value;
}
