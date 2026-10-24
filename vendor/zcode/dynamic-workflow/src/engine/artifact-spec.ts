/**
 * 预置产物 spec 的形状校验。
 *
 * ⚠ 术语：artifact = **用户面产物**（脚本发布给用户看的看板），不是 `RunSettlement.artifact`
 * 那个顶层返回值。
 *
 * 为什么校验在**引擎核心**而不是 driver：预置声明根本不过 driver（它没有可执行的效应），
 * 而一个形状不合法的 spec 必须在落 journal 之前被拦下——journal 里的记录是投影与冷恢复的
 * 唯一真相，一条画不出来的 spec 落了库就会在每个读面上重新炸一次。
 *
 * 为什么是手写而不是 zod：本包零运行时依赖（facade / 编译 / 引擎全部只靠 typescript），
 * 而 spec 的形状小到一屏。加一个 schema 库来校验四个对象，代价是把整条纯包的依赖前提改掉。
 *
 * 返回**人可读的一句话**而不是 boolean：这条消息会经 `ArtifactSpecInvalid` 落进 run 的
 * failure_json，读者（模型或作者）要据它改脚本，"invalid spec" 帮不上任何忙。
 */

import { ARTIFACT_CAPS } from "../facade/artifact-caps.js";
import type { ArtifactPresetOp } from "../facade/registry.js";
import { canonicalJson } from "./hash.js";

/** 一条不合法的理由；`undefined` 即通过。 */
type ArtifactSpecProblem = string | undefined;

/**
 * 校验一个预置 spec。`op` 决定必填字段，公共部分（title / description 的长度）四种都查。
 * 通过的 spec 保证：是普通对象、必填字段在场且形状正确、规范化后不超 8KB。
 */
export function validateArtifactSpec(op: ArtifactPresetOp, spec: unknown): ArtifactSpecProblem {
  if (!isPlainObject(spec)) return `${op} spec must be an object literal, got ${describe(spec)}`;

  const common = checkOptions(spec);
  if (common !== undefined) return common;

  const shape = checkShape(op, spec);
  if (shape !== undefined) return shape;

  // 体积上限最后查：先给出形状上的具体错误，再谈大小——一个既畸形又过大的 spec，作者要先
  // 知道它畸形在哪。
  const bytes = utf8ByteLength(canonicalJson(spec));
  if (bytes > ARTIFACT_CAPS.maxSpecSerializedBytes) {
    return `${op} spec is ${bytes} bytes serialized, over the ${ARTIFACT_CAPS.maxSpecSerializedBytes}-byte limit`;
  }
  return undefined;
}

function checkShape(op: ArtifactPresetOp, spec: Record<string, unknown>): ArtifactSpecProblem {
  if (op === "chart") {
    const x = checkField(spec.x, "x");
    if (x !== undefined) return x;
    const y = spec.y;
    if (Array.isArray(y)) {
      if (y.length === 0) return "chart spec y is an empty array; give it at least one series";
      for (const [index, entry] of y.entries()) {
        const problem = checkField(entry, `y[${index}]`);
        if (problem !== undefined) return problem;
      }
    } else {
      const problem = checkField(y, "y");
      if (problem !== undefined) return problem;
    }
    if (spec.type !== undefined && !["line", "bar", "scatter"].includes(String(spec.type))) {
      return `chart spec type must be "line", "bar" or "scatter", got ${describe(spec.type)}`;
    }
    if (spec.scale !== undefined && !["linear", "log"].includes(String(spec.scale))) {
      return `chart spec scale must be "linear" or "log", got ${describe(spec.scale)}`;
    }
    if (spec.baseline !== undefined) return checkField(spec.baseline, "baseline");
    return undefined;
  }
  if (op === "table") {
    const columns = checkFieldList(spec.columns, "columns");
    if (columns !== undefined) return columns;
    if (spec.key !== undefined && !isNonEmptyString(spec.key)) {
      return "table spec key must be a non-empty string (the field that identifies a row)";
    }
    return undefined;
  }
  if (op === "metrics") return checkFieldList(spec.metrics, "metrics");
  // board
  if (!isNonEmptyString(spec.key)) return "board spec key must be a non-empty string (the field that identifies a card)";
  if (!isNonEmptyString(spec.status)) {
    return "board spec status must be a non-empty string (the field that picks a card's column)";
  }
  if (!Array.isArray(spec.columns) || spec.columns.length === 0) {
    return "board spec columns must be a non-empty array of strings (the column order)";
  }
  for (const [index, column] of spec.columns.entries()) {
    if (!isNonEmptyString(column)) return `board spec columns[${index}] must be a non-empty string`;
  }
  // cardTitle 是**字段名**（哪个字段当卡片标题），与 ArtifactOptions.title（看板自己的标题）
  // 是两回事——它们之前撞在同一个键上，改名正是为了让一块板能同时说出两者。
  if (spec.cardTitle !== undefined && !isNonEmptyString(spec.cardTitle)) {
    return "board spec cardTitle must be a non-empty string (the field used as the card title)";
  }
  if (spec.detail !== undefined) return checkFieldList(spec.detail, "detail");
  return undefined;
}

/** 公共的展示元数据（`ArtifactOptions`）：类型与长度。 */
function checkOptions(spec: Record<string, unknown>): ArtifactSpecProblem {
  if (spec.title !== undefined) {
    if (typeof spec.title !== "string") return `spec title must be a string, got ${describe(spec.title)}`;
    if (spec.title.length > ARTIFACT_CAPS.maxTitleLength) {
      return `spec title is ${spec.title.length} characters, over the ${ARTIFACT_CAPS.maxTitleLength} limit`;
    }
  }
  if (spec.description !== undefined) {
    if (typeof spec.description !== "string") {
      return `spec description must be a string, got ${describe(spec.description)}`;
    }
    if (spec.description.length > ARTIFACT_CAPS.maxDescriptionLength) {
      return `spec description is ${spec.description.length} characters, over the ` +
      `${ARTIFACT_CAPS.maxDescriptionLength} limit`;
    }
  }
  if (spec.primary !== undefined && typeof spec.primary !== "boolean") {
    return `spec primary must be a boolean, got ${describe(spec.primary)}`;
  }
  return undefined;
}

/** 一个非空的 `ArtifactField` 列表。 */
function checkFieldList(value: unknown, where: string): ArtifactSpecProblem {
  if (!Array.isArray(value) || value.length === 0) {
    return `spec ${where} must be a non-empty array of fields ({ field: "…" })`;
  }
  for (const [index, entry] of value.entries()) {
    const problem = checkField(entry, `${where}[${index}]`);
    if (problem !== undefined) return problem;
  }
  return undefined;
}

/** 一个 `ArtifactField`：`field` 必须是非空字符串（点路径），label / unit 可选。 */
function checkField(value: unknown, where: string): ArtifactSpecProblem {
  if (!isPlainObject(value)) return `spec ${where} must be { field: "…" }, got ${describe(value)}`;
  if (!isNonEmptyString(value.field)) {
    return `spec ${where}.field must be a non-empty string (a dot path into the item, e.g. "timing.after")`;
  }
  for (const key of ["label", "unit"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "string") {
      return `spec ${where}.${key} must be a string, got ${describe(value[key])}`;
    }
  }
  return undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** 出错文案里的实得值描述（不打印整个对象——一个 8KB 的 spec 会把 failure_json 塞满）。 */
function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `array (${value.length} items)`;
  if (typeof value === "object") return "object";
  if (typeof value === "string") return JSON.stringify(value.slice(0, 40));
  return String(value);
}

/** UTF-8 字节数（与 report 上限同一把尺）。 */
function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
