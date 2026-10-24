/**
 * 按点路径从一条 report item 里取值："timing.after"、"rounds.0.ms"（docs/execution-engine.md
 * 「Reading the journal」）。
 *
 * 这是**协议上的契约**，不只是渲染器的工具函数：看板取数时 CLI 在 SQLite 里按同一套规则把
 * 字段取出来（adapters 的 dwf-journal-fields.ts），渲染器拿到的值必须与它自己从整条 item 里
 * 取出来的逐字相同。规则：按 `.` 切段；当前值是数组时，段按 `Number(段)` 当下标（非负整数且
 * 在界内才算）；是对象时按键取；走不通（null、标量、越界、缺键）得 `undefined`。
 */
export function readWorkflowArtifactField(item: unknown, path: string): unknown {
  let cursor: unknown = item;
  for (const segment of path.split(".")) {
    if (cursor === null || cursor === undefined) return undefined;
    if (Array.isArray(cursor)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= cursor.length) return undefined;
      cursor = cursor[index];
      continue;
    }
    if (typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}
