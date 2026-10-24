import type { JsonSchema, JsonSchemaType, Violation } from "./types.js";

/**
 * 纯校验器，覆盖范围恰好是 {@link synthesizeAskSchemas} 会发射的 JSON Schema 子集
 * （不是通用 JSON Schema）。产出违规列表，每条设计成可直接进修复用 tool_result：
 * 一行 JSON 路径 + 期望 + 实得。
 *
 * 空 schema `{}`（unknown 的许可式 schema）匹配任意合法 JSON。`$ref` 在传入的根 schema
 * 的 `$defs` 内解析。
 */

export function validate(schema: JsonSchema, value: unknown): Violation[] {
  const violations: Violation[] = [];
  check(schema, value, "$", schema, violations);
  return violations;
}

/** 把一条违规格式化为单行：`<path>: expected <expected>, got <got>`。 */
export function formatViolation(violation: Violation): string {
  return `${violation.path}: expected ${violation.expected}, got ${violation.got}`;
}

/** 把违规列表格式化为多行文本（每行一条）。 */
export function formatViolations(violations: readonly Violation[]): string {
  return violations.map(formatViolation).join("\n");
}

function check(schema: JsonSchema, value: unknown, path: string, root: JsonSchema, out: Violation[]): void {
  if (schema.$ref !== undefined) {
    const resolved = resolveRef(root, schema.$ref);
    if (resolved === undefined) {
      out.push({ expected: `schema ${schema.$ref}`, got: "unresolved $ref", path });
      return;
    }
    check(resolved, value, path, root, out);
    return;
  }

  if ("const" in schema) {
    if (!deepEqual(value, schema.const)) {
      out.push({ expected: describeValue(schema.const as unknown), got: describeValue(value), path });
    }
    return;
  }

  if (schema.enum !== undefined) {
    if (!schema.enum.some((candidate) => deepEqual(value, candidate))) {
      out.push({ expected: `one of ${schema.enum.map((v) => describeValue(v)).join(", ")}`, got: describeValue(value), path });
    }
    return;
  }

  if (schema.anyOf !== undefined) {
    const matched = schema.anyOf.some((branch) => {
      const trial: Violation[] = [];
      check(branch, value, path, root, trial);
      return trial.length === 0;
    });
    if (!matched) {
      out.push({ expected: `one of ${schema.anyOf.length} variants`, got: describeValue(value), path });
    }
    return;
  }

  if (schema.type !== undefined && !typeMatches(schema.type, value)) {
    out.push({ expected: typeName(schema.type), got: describeValue(value), path });
    return;
  }

  if (schema.type === "object") checkObject(schema, value as Record<string, unknown>, path, root, out);
  if (schema.type === "array") checkArray(schema, value as unknown[], path, root, out);
  if (typeof value === "string") checkString(schema, value, path, out);
  if (typeof value === "number") checkNumber(schema, value, path, out);
}

function checkObject(schema: JsonSchema, value: Record<string, unknown>, path: string, root: JsonSchema, out: Violation[]): void {
  for (const key of schema.required ?? []) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      out.push({ expected: "present", got: "missing", path: `${path}.${key}` });
    }
  }
  const properties = schema.properties ?? {};
  for (const [key, propValue] of Object.entries(value)) {
    const propSchema = properties[key];
    if (propSchema !== undefined) {
      check(propSchema, propValue, `${path}.${key}`, root, out);
      continue;
    }
    const additional = schema.additionalProperties;
    if (additional === false) {
      out.push({ expected: "no additional property", got: describeValue(propValue), path: `${path}.${key}` });
    } else if (additional !== undefined && additional !== true) {
      check(additional, propValue, `${path}.${key}`, root, out);
    }
  }
}

function checkArray(schema: JsonSchema, value: unknown[], path: string, root: JsonSchema, out: Violation[]): void {
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    out.push({ expected: `at least ${schema.minItems} items`, got: `array(${value.length})`, path });
  }
  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    out.push({ expected: `at most ${schema.maxItems} items`, got: `array(${value.length})`, path });
  }
  if (schema.prefixItems !== undefined) {
    schema.prefixItems.forEach((itemSchema, index) => {
      if (index < value.length) check(itemSchema, value[index], `${path}[${index}]`, root, out);
    });
    if (schema.items !== undefined) {
      for (let index = schema.prefixItems.length; index < value.length; index += 1) {
        check(schema.items, value[index], `${path}[${index}]`, root, out);
      }
    }
    return;
  }
  if (schema.items !== undefined) {
    value.forEach((item, index) => check(schema.items!, item, `${path}[${index}]`, root, out));
  }
}

function checkString(schema: JsonSchema, value: string, path: string, out: Violation[]): void {
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    out.push({ expected: `string length >= ${schema.minLength}`, got: `length ${value.length}`, path });
  }
  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    out.push({ expected: `string length <= ${schema.maxLength}`, got: `length ${value.length}`, path });
  }
  if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
    out.push({ expected: `match /${schema.pattern}/`, got: describeValue(value), path });
  }
}

function checkNumber(schema: JsonSchema, value: number, path: string, out: Violation[]): void {
  if (schema.type === "integer" && !Number.isInteger(value)) {
    out.push({ expected: "integer", got: `number ${value}`, path });
  }
  if (schema.minimum !== undefined && value < schema.minimum) {
    out.push({ expected: `>= ${schema.minimum}`, got: `number ${value}`, path });
  }
  if (schema.maximum !== undefined && value > schema.maximum) {
    out.push({ expected: `<= ${schema.maximum}`, got: `number ${value}`, path });
  }
  if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
    out.push({ expected: `> ${schema.exclusiveMinimum}`, got: `number ${value}`, path });
  }
  if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
    out.push({ expected: `< ${schema.exclusiveMaximum}`, got: `number ${value}`, path });
  }
}

function typeMatches(type: JsonSchemaType | JsonSchemaType[], value: unknown): boolean {
  const types = Array.isArray(type) ? type : [type];
  return types.some((candidate) => matchesOne(candidate, value));
}

function matchesOne(type: JsonSchemaType, value: unknown): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}

function typeName(type: JsonSchemaType | JsonSchemaType[]): string {
  return Array.isArray(type) ? type.join(" | ") : type;
}

function resolveRef(root: JsonSchema, ref: string): JsonSchema | undefined {
  const match = /^#\/\$defs\/(.+)$/.exec(ref);
  if (match === null) return undefined;
  return root.$defs?.[match[1]!];
}

/** JSON 深相等：基础值、数组、纯对象。用于 const/enum 比较。 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    );
  }
  return false;
}

/** 值的简短描述，用于 got/expected：类型 + 精简取值。 */
function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `array(${value.length})`;
  switch (typeof value) {
    case "string": {
      const shown = value.length > 20 ? `${value.slice(0, 20)}…` : value;
      return `string ${JSON.stringify(shown)}`;
    }
    case "number":
      return `number ${value}`;
    case "boolean":
      return `boolean ${value}`;
    case "object":
      return "object";
    case "undefined":
      return "undefined";
    default:
      return typeof value;
  }
}
