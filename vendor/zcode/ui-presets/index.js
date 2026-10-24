// Generated from vendored ZCode sources; run node vendor/zcode/ui-presets/build.mjs.

// vendor/zcode/ui-presets/field.ts
function readWorkflowArtifactField(item, path) {
  let cursor = item;
  for (const segment of path.split(".")) {
    if (cursor === null || cursor === void 0) return void 0;
    if (Array.isArray(cursor)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= cursor.length) return void 0;
      cursor = cursor[index];
      continue;
    }
    if (typeof cursor !== "object") return void 0;
    cursor = cursor[segment];
  }
  return cursor;
}

// vendor/zcode/ui-presets/spec.ts
var CHART_TYPES = ["line", "bar", "scatter"];
var CHART_SCALES = ["linear", "log"];
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value : void 0;
}
function parseField(value) {
  const shorthand = readNonEmptyString(value);
  if (shorthand) {
    return { field: shorthand };
  }
  if (!isRecord(value)) {
    return void 0;
  }
  const field = readNonEmptyString(value.field);
  if (!field) {
    return void 0;
  }
  const label = readNonEmptyString(value.label);
  const unit = readNonEmptyString(value.unit);
  return { field, ...label ? { label } : {}, ...unit ? { unit } : {} };
}
function parseFieldList(value) {
  if (!Array.isArray(value)) {
    return void 0;
  }
  const fields = value.map(parseField).filter((field) => field !== void 0);
  return fields.length > 0 ? fields : void 0;
}
function parseOptions(spec) {
  const title = readNonEmptyString(spec.title);
  const description = readNonEmptyString(spec.description);
  return { ...title ? { title } : {}, ...description ? { description } : {} };
}
function parseChartSpec(spec) {
  const x = parseField(spec.x);
  if (!x) {
    return void 0;
  }
  const single = Array.isArray(spec.y) ? void 0 : parseField(spec.y);
  const y = Array.isArray(spec.y) ? parseFieldList(spec.y) : single ? [single] : void 0;
  if (!y) {
    return void 0;
  }
  const type = CHART_TYPES.find((candidate) => candidate === spec.type) ?? "line";
  const scale = CHART_SCALES.find((candidate) => candidate === spec.scale) ?? "linear";
  const baseline = parseField(spec.baseline);
  return {
    ...parseOptions(spec),
    type,
    x,
    y,
    scale,
    ...baseline ? { baseline } : {}
  };
}
function parseTableSpec(spec) {
  const columns = parseFieldList(spec.columns);
  if (!columns) {
    return void 0;
  }
  const key = readNonEmptyString(spec.key);
  return { ...parseOptions(spec), columns, ...key ? { key } : {} };
}
function parseMetricsSpec(spec) {
  const metrics = parseFieldList(spec.metrics);
  if (!metrics) {
    return void 0;
  }
  return { ...parseOptions(spec), metrics };
}
function parseBoardSpec(spec) {
  const key = readNonEmptyString(spec.key);
  const status = readNonEmptyString(spec.status);
  if (!key || !status) {
    return void 0;
  }
  if (!Array.isArray(spec.columns)) {
    return void 0;
  }
  const columns = spec.columns.map(readNonEmptyString).filter((column) => column !== void 0);
  if (columns.length === 0) {
    return void 0;
  }
  const cardTitle = readNonEmptyString(spec.cardTitle);
  const detail = parseFieldList(spec.detail);
  return {
    ...parseOptions(spec),
    key,
    status,
    columns,
    ...cardTitle ? { cardTitle } : {},
    ...detail ? { detail } : {}
  };
}
function parseArtifactPresetSpec(kind, spec) {
  if (!isRecord(spec)) {
    return void 0;
  }
  switch (kind) {
    case "chart":
      return parseChartSpec(spec);
    case "table":
      return parseTableSpec(spec);
    case "metrics":
      return parseMetricsSpec(spec);
    case "board":
      return parseBoardSpec(spec);
    default:
      return void 0;
  }
}
function chartSeriesFields(spec) {
  return Array.isArray(spec.y) ? spec.y : [spec.y];
}
function artifactFieldLabel(field) {
  return field.label ?? field.field;
}
function artifactPresetFieldPaths(kind, rawSpec) {
  const spec = parseArtifactPresetSpec(kind, rawSpec);
  if (spec === void 0) return void 0;
  const paths = [];
  const add = (path) => {
    if (path !== void 0 && !paths.includes(path)) paths.push(path);
  };
  switch (kind) {
    case "chart": {
      const chart = spec;
      add(chart.x.field);
      for (const field of chartSeriesFields(chart)) add(field.field);
      add(chart.baseline?.field);
      break;
    }
    case "table": {
      const table = spec;
      add(table.key);
      for (const column of table.columns) add(column.field);
      break;
    }
    case "metrics":
      for (const metric of spec.metrics) add(metric.field);
      break;
    case "board": {
      const board = spec;
      add(board.key);
      add(board.status);
      add(board.cardTitle);
      for (const field of board.detail ?? []) add(field.field);
      break;
    }
  }
  return paths;
}

// vendor/zcode/ui-presets/apply.ts
var BOARD_OTHER_COLUMN_ID = "__other__";
function readArtifactField(item, path) {
  return readWorkflowArtifactField(item, path);
}
function readEntryField(entry, path) {
  if (entry.fields !== void 0) {
    return Object.hasOwn(entry.fields, path) ? entry.fields[path] : void 0;
  }
  return readArtifactField(entry.item, path);
}
function hasValue(value) {
  return value !== void 0 && value !== null;
}
function toFiniteNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : void 0;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : void 0;
  }
  return void 0;
}
function formatArtifactValue(value) {
  if (value === void 0 || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
}
function seriesKey(index) {
  return `y${index}`;
}
function applyChart(spec, items) {
  const fields = chartSeriesFields(spec);
  const series = fields.map((field, index) => ({
    key: seriesKey(index),
    field: field.field,
    label: artifactFieldLabel(field),
    ...field.unit ? { unit: field.unit } : {},
    colorIndex: index
  }));
  const raws = [];
  let baseline;
  for (const entry of items) {
    const rawX = readEntryField(entry, spec.x.field);
    if (!hasValue(rawX)) {
      continue;
    }
    const values = fields.map((field) => {
      const value = toFiniteNumber(readEntryField(entry, field.field));
      if (value === void 0) {
        return void 0;
      }
      return spec.scale === "log" && value <= 0 ? void 0 : value;
    });
    raws.push({ sequence: entry.sequence, x: rawX, values });
    if (spec.baseline && !baseline) {
      const raw = readEntryField(entry, spec.baseline.field);
      const value = toFiniteNumber(raw);
      if (value !== void 0 && !(spec.scale === "log" && value <= 0)) {
        baseline = {
          value,
          label: artifactFieldLabel(spec.baseline),
          ...spec.baseline.unit ? { unit: spec.baseline.unit } : {}
        };
      }
    }
  }
  const numericX = raws.length > 0 && raws.every((raw) => toFiniteNumber(raw.x) !== void 0);
  const ordered = numericX ? [...raws].sort((left, right) => {
    const delta = toFiniteNumber(left.x) - toFiniteNumber(right.x);
    return delta !== 0 ? delta : left.sequence - right.sequence;
  }) : raws;
  const points = ordered.map((raw, index) => {
    const x = numericX ? toFiniteNumber(raw.x) : index;
    const point = {
      sequence: raw.sequence,
      x,
      xLabel: formatArtifactValue(raw.x)
    };
    raw.values.forEach((value, seriesIndex) => {
      point[seriesKey(seriesIndex)] = value ?? null;
    });
    return point;
  });
  const yValues = ordered.flatMap(
    (raw) => raw.values.filter((value) => value !== void 0)
  );
  const domain = points.length > 0 && yValues.length > 0 ? {
    xMin: Math.min(...points.map((point) => point.x)),
    xMax: Math.max(...points.map((point) => point.x)),
    yMin: Math.min(...yValues),
    yMax: Math.max(...yValues)
  } : void 0;
  return {
    kind: "chart",
    type: spec.type ?? "line",
    scale: spec.scale ?? "linear",
    series,
    points,
    x: {
      label: artifactFieldLabel(spec.x),
      ...spec.x.unit ? { unit: spec.x.unit } : {},
      numeric: numericX
    },
    ...baseline ? { baseline } : {},
    ...domain ? { domain } : {}
  };
}
function applyTable(spec, items) {
  const columns = spec.columns.map((column) => ({
    field: column.field,
    label: artifactFieldLabel(column),
    ...column.unit ? { unit: column.unit } : {}
  }));
  const byId = /* @__PURE__ */ new Map();
  for (const entry of items) {
    const keyValue = spec.key ? readEntryField(entry, spec.key) : void 0;
    const id = hasValue(keyValue) ? formatArtifactValue(keyValue) : `${entry.siteId}@${entry.ordinal}`;
    byId.set(id, {
      id,
      sequence: entry.sequence,
      cells: columns.map((column) => formatArtifactValue(readEntryField(entry, column.field)))
    });
  }
  return { kind: "table", columns, rows: [...byId.values()] };
}
function applyMetrics(spec, items) {
  const metrics = spec.metrics.map((metric) => ({
    field: metric.field,
    label: artifactFieldLabel(metric),
    ...metric.unit ? { unit: metric.unit } : {}
  }));
  for (const entry of items) {
    metrics.forEach((tile, index) => {
      const raw = readEntryField(entry, tile.field);
      if (!hasValue(raw)) {
        return;
      }
      metrics[index] = {
        ...tile,
        value: formatArtifactValue(raw),
        raw,
        sequence: entry.sequence
      };
    });
  }
  return { kind: "metrics", metrics };
}
function applyBoard(spec, items) {
  const detail = spec.detail ?? [];
  const byId = /* @__PURE__ */ new Map();
  for (const entry of items) {
    const keyValue = readEntryField(entry, spec.key);
    if (!hasValue(keyValue)) {
      continue;
    }
    const id = formatArtifactValue(keyValue);
    const status = formatArtifactValue(readEntryField(entry, spec.status));
    const titleRaw = spec.cardTitle ? readEntryField(entry, spec.cardTitle) : void 0;
    byId.set(id, {
      id,
      sequence: entry.sequence,
      title: hasValue(titleRaw) ? formatArtifactValue(titleRaw) : id,
      status,
      details: detail.map((field) => ({
        label: artifactFieldLabel(field),
        value: formatArtifactValue(readEntryField(entry, field.field)),
        ...field.unit ? { unit: field.unit } : {}
      }))
    });
  }
  const columns = spec.columns.map((column) => ({
    id: column,
    other: false,
    cards: []
  }));
  const listed = new Map(columns.map((column) => [column.id, column]));
  const other = { id: BOARD_OTHER_COLUMN_ID, other: true, cards: [] };
  for (const card of byId.values()) {
    (listed.get(card.status) ?? other).cards.push(card);
  }
  return {
    kind: "board",
    // 「其他」永远在末尾，且只在真有卡时出现——空列会让本来就窄的侧板更挤。
    columns: other.cards.length > 0 ? [...columns, other] : columns,
    cardCount: byId.size
  };
}
function applyArtifactItems(kind, spec, items) {
  switch (kind) {
    case "chart":
      return applyChart(spec, items);
    case "table":
      return applyTable(spec, items);
    case "metrics":
      return applyMetrics(spec, items);
    case "board":
      return applyBoard(spec, items);
  }
}
export {
  applyArtifactItems,
  artifactFieldLabel,
  artifactPresetFieldPaths,
  chartSeriesFields,
  formatArtifactValue,
  parseArtifactPresetSpec,
  readArtifactField
};
