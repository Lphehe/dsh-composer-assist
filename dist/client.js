(() => {
  // workflow/client/graph.js
  function graphModel(analysis, kind = "graph", availableWidth = Infinity) {
    const graph = analysis?.[kind];
    if (!graph) return { nodes: [], edges: [], groups: [], width: 600, height: 320 };
    const source = graph.nodes ?? graph.steps ?? graph.participants ?? graph.phases ?? [];
    const rows = Array.isArray(source) ? source : Object.values(source);
    const phases = new Map((analysis.causality?.phases ?? analysis.flow?.phases ?? []).map((phase) => [phase.id, phase.name ?? phase.id]));
    const lanes = new Map((analysis.causality?.lanes ?? []).map((lane) => [lane.id, lane.name ?? lane.id]));
    const taskLanes = new Map((analysis.causality?.steps ?? []).map((step) => [step.source ?? step.id, step.lanes ?? [step.lane]]));
    const actorTitle = (node) => node.kind === "ask" ? (node.lanes ?? (node.lane ? [node.lane] : taskLanes.get(node.source ?? node.site ?? node.id) ?? node.actors ?? [])).map((id) => lanes.get(id)).filter(Boolean).join(" \xB7 ") || void 0 : void 0;
    const sites = new Map((analysis.graph?.nodes ?? []).map((node) => [node.id, actorTitle(node) ?? node.label]));
    const nodes = rows.map((node, index) => ({
      ...node,
      id: String(node.id ?? node.siteId ?? index),
      sites: node.steps ?? [node.source ?? node.site ?? node.id],
      label: actorTitle(node) ?? node.label ?? node.name ?? node.title ?? (kind === "handoff" ? `${phases.get(node.phase) ?? node.phase} \xB7 ${lanes.get(node.lane) ?? node.lane}` : node.kind === "mark" ? phases.get(node.phase) : sites.get(node.site)) ?? node.id ?? String(index)
    }));
    const rawEdges = graph.edges ?? graph.handoffs ?? graph.order ?? [];
    if (kind === "flow") for (const id of ["entry", "sink", "abort"]) {
      if (rawEdges.some((edge) => edge.from === id || edge.to === id)) nodes.push({ id, label: id, sites: [] });
    }
    const ids = new Set(nodes.map((node) => node.id));
    const edges = rawEdges.map((edge) => ({ ...edge, from: String(edge.from ?? edge.source), to: String(edge.to ?? edge.target) })).filter((edge) => ids.has(edge.from) && ids.has(edge.to));
    const incoming = new Map(nodes.map((node) => [node.id, 0]));
    for (const edge of edges) if (edge.from !== edge.to) incoming.set(edge.to, incoming.get(edge.to) + 1);
    const depth = new Map(nodes.map((node) => [node.id, 0]));
    const queue = nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
    const visited = /* @__PURE__ */ new Set();
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      if (visited.has(id)) continue;
      visited.add(id);
      for (const edge of edges.filter((edge2) => edge2.from === id && edge2.to !== id)) {
        depth.set(edge.to, Math.max(depth.get(edge.to), depth.get(id) + 1));
        incoming.set(edge.to, incoming.get(edge.to) - 1);
        if (incoming.get(edge.to) === 0) queue.push(edge.to);
      }
    }
    const tail = Math.max(0, ...depth.values()) + 1;
    for (const node of nodes) if (!visited.has(node.id)) depth.set(node.id, tail);
    const steps = new Map((analysis.causality?.steps ?? []).map((step) => [step.source ?? step.id, step]));
    const structuralKinds = /* @__PURE__ */ new Set(["source", "sink", "join", "fan-out", "mark", "entry", "abort", "test"]);
    const phaseOrder = new Map([...phases.keys()].map((id, index) => [id, index]));
    for (const node of nodes) {
      const site = node.source ?? node.site ?? node.sites[0] ?? node.id;
      node.phase ??= steps.get(site)?.phase;
      node.layoutPhase = phases.has(node.phase) ? node.phase : void 0;
      node.actorIds = (node.lanes ?? (node.lane ? [node.lane] : taskLanes.get(site) ?? node.actors ?? [])).filter((id) => typeof id === "string");
      node.structural = structuralKinds.has(node.kind ?? node.id);
      node.width = node.structural ? 88 : 248;
      node.height = node.structural ? 32 : 112;
    }
    const grouped = (kind === "graph" || kind === "causality") && phases.size > 0;
    if (grouped) {
      const byId = new Map(nodes.map((node) => [node.id, node]));
      const adjacent = new Map(nodes.map((node) => [node.id, { before: [], after: [] }]));
      for (const edge of edges) {
        adjacent.get(edge.from).after.push(edge.to);
        adjacent.get(edge.to).before.push(edge.from);
      }
      for (let pass = 0; pass < nodes.length; pass++) {
        let changed = false;
        for (const node of nodes) {
          if (!node.structural || phases.has(node.phase)) continue;
          const { before, after } = adjacent.get(node.id);
          const known = (ids2) => ids2.map((id) => byId.get(id).layoutPhase).filter((id) => phases.has(id));
          const incomingPhases = known(before), outgoingPhases = known(after);
          const source2 = node.kind === "source" || node.id === "entry";
          const candidates = source2 ? outgoingPhases : incomingPhases.length ? incomingPhases : outgoingPhases;
          if (!candidates.length) continue;
          const next = candidates.reduce((best, id) => (source2 ? phaseOrder.get(id) < phaseOrder.get(best) : phaseOrder.get(id) > phaseOrder.get(best)) ? id : best);
          if (next !== node.layoutPhase) {
            node.layoutPhase = next;
            changed = true;
          }
        }
        if (!changed) break;
      }
    }
    const bands = grouped ? [void 0, ...phases.keys()].map((id) => ({ id, nodes: nodes.filter((node) => node.layoutPhase === id) })).filter((band) => band.nodes.length) : [{ nodes }];
    const groups = [];
    const limit = Math.max(296, availableWidth);
    let top = 16, bandLeft = 8, rowHeight = 0;
    for (const band of bands) {
      if (!band.nodes.length) continue;
      const columns = /* @__PURE__ */ new Map();
      for (const node of band.nodes) {
        const column = depth.get(node.id);
        if (!columns.has(column)) columns.set(column, []);
        columns.get(column).push(node);
      }
      const lines = [];
      let line = [], lineWidth = 0;
      for (const [, members] of [...columns].sort(([a], [b]) => a - b)) {
        const width2 = Math.max(...members.map((node) => node.width));
        if (line.length && lineWidth + 32 + width2 + 48 > limit) {
          lines.push(line);
          line = [];
          lineWidth = 0;
        }
        lineWidth += (line.length ? 32 : 0) + width2;
        line.push({ members, width: width2 });
      }
      if (line.length) lines.push(line);
      const bandWidth = Math.max(...lines.map((line2) => line2.reduce((sum, column) => sum + column.width, 0) + (line2.length - 1) * 32)) + 32;
      if (bandLeft > 8 && bandLeft + bandWidth + 8 > limit) {
        bandLeft = 8;
        top += rowHeight + 24;
        rowHeight = 0;
      }
      let offset = 0;
      for (const line2 of lines) {
        const height2 = Math.max(...line2.map((column) => column.members.length)) * 136;
        let left = bandLeft + 16;
        for (const column of line2) {
          column.members.forEach((node, row) => {
            node.x = left + (column.width - node.width) / 2;
            node.y = top + 44 + offset + (height2 - column.members.length * 136) / 2 + row * 136 + (136 - node.height) / 2;
          });
          left += column.width + 32;
        }
        offset += height2 + 24;
      }
      const height = 44 + offset - 24 + 20;
      if (band.id !== void 0) groups.push({ id: band.id, label: phases.get(band.id), index: phaseOrder.get(band.id), x: bandLeft, y: top, width: bandWidth, height, taskCount: band.nodes.filter((node) => !node.structural).length, sites: [...new Set(band.nodes.flatMap((node) => node.sites).filter((site) => typeof site === "string"))] });
      bandLeft += bandWidth + 24;
      rowHeight = Math.max(rowHeight, height);
    }
    const width = Math.max(296, ...nodes.map((node) => node.x + node.width + 24));
    return { nodes, edges, groups, width, height: Math.max(320, top + rowHeight + 16) };
  }
  function graphEdgePoints(model2, edge) {
    const byId = new Map(model2.nodes.map((node) => [node.id, node]));
    const sides = (item) => {
      const from2 = byId.get(item.from), to2 = byId.get(item.to);
      if (from2 === to2) return ["right", "bottom"];
      if (from2.x + from2.width <= to2.x) return ["right", "left"];
      if (to2.x + to2.width <= from2.x) return ["left", "right"];
      return from2.y + from2.height <= to2.y ? ["bottom", "top"] : ["top", "bottom"];
    };
    const port = (node, side, outgoing) => {
      const vertical = side === "left" || side === "right";
      const peers = model2.edges.flatMap((item, index2) => {
        const pair2 = sides(item), entries = [];
        if (item.from === node.id && pair2[0] === side) entries.push({ item, index: index2, outgoing: true, other: byId.get(item.to) });
        if (item.to === node.id && pair2[1] === side) entries.push({ item, index: index2, outgoing: false, other: byId.get(item.from) });
        return entries;
      }).sort((a, b) => (Number.isFinite(a.item.port) ? a.item.port : Infinity) - (Number.isFinite(b.item.port) ? b.item.port : Infinity) || (vertical ? a.other.y + a.other.height / 2 - b.other.y - b.other.height / 2 : a.other.x + a.other.width / 2 - b.other.x - b.other.width / 2) || a.index - b.index);
      const index = Math.max(0, peers.findIndex((peer) => peer.item === edge && peer.outgoing === outgoing));
      const offset = 8 + (index + 1) * ((vertical ? node.height : node.width) - 16) / (peers.length + 1);
      if (side === "right") return [node.x + node.width, node.y + offset];
      if (side === "left") return [node.x, node.y + offset];
      if (side === "bottom") return [node.x + offset, node.y + node.height];
      return [node.x + offset, node.y];
    };
    const from = byId.get(edge.from), to = byId.get(edge.to);
    if (!from || !to) throw new Error("Graph edge has no endpoint");
    const pair = sides(edge);
    const start = port(from, pair[0], true), end = port(to, pair[1], false);
    const stub = (point, side) => [point[0] + (side === "right" ? 12 : side === "left" ? -12 : 0), point[1] + (side === "bottom" ? 12 : side === "top" ? -12 : 0)];
    const first = stub(start, pair[0]), last = stub(end, pair[1]);
    const boxes = model2.nodes.map((node) => ({ left: node.x - 6, right: node.x + node.width + 6, top: node.y - 6, bottom: node.y + node.height + 6 }));
    const clear = (a, b) => !boxes.some((box) => a[0] === b[0] ? a[0] > box.left && a[0] < box.right && Math.max(a[1], b[1]) > box.top && Math.min(a[1], b[1]) < box.bottom : a[1] > box.top && a[1] < box.bottom && Math.max(a[0], b[0]) > box.left && Math.min(a[0], b[0]) < box.right);
    let route = [[first, [last[0], first[1]], last], [first, [first[0], last[1]], last]].find((points2) => points2.slice(1).every((point, i) => clear(points2[i], point)));
    if (!route) {
      const xs = [.../* @__PURE__ */ new Set([8, model2.width - 8, first[0], last[0], ...boxes.flatMap((box) => [box.left - 2, box.right + 2])])].sort((a, b) => a - b);
      const ys = [.../* @__PURE__ */ new Set([8, model2.height - 8, first[1], last[1], ...boxes.flatMap((box) => [box.top - 2, box.bottom + 2]), ...(model2.groups ?? []).flatMap((group) => [group.y - 8, group.y + group.height + 8])])].sort((a, b) => a - b);
      const key = (point2) => ys.indexOf(point2[1]) * xs.length + xs.indexOf(point2[0]);
      const point = (id) => [xs[id % xs.length], ys[Math.floor(id / xs.length)]];
      const source = key(first), target = key(last), costs = /* @__PURE__ */ new Map([[source, 0]]), parents = /* @__PURE__ */ new Map();
      const open = [{ id: source, cost: 0, rank: 0 }];
      while (open.length) {
        const current = open.shift();
        if (current.cost !== costs.get(current.id)) continue;
        if (current.id === target) break;
        const x = current.id % xs.length, y = Math.floor(current.id / xs.length), a = point(current.id);
        const neighbors = [x > 0 ? current.id - 1 : -1, x + 1 < xs.length ? current.id + 1 : -1, y > 0 ? current.id - xs.length : -1, y + 1 < ys.length ? current.id + xs.length : -1];
        for (const id of neighbors) {
          if (id < 0) continue;
          const b = point(id);
          if (!clear(a, b)) continue;
          const previous = parents.has(current.id) ? point(parents.get(current.id)) : null;
          const bend = previous && previous[0] === a[0] !== (a[0] === b[0]) ? 12 : 0;
          const cost = current.cost + Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + bend;
          if (cost >= (costs.get(id) ?? Infinity)) continue;
          costs.set(id, cost);
          parents.set(id, current.id);
          const rank = cost + Math.abs(b[0] - last[0]) + Math.abs(b[1] - last[1]);
          let index = 0;
          while (index < open.length && open[index].rank <= rank) index++;
          open.splice(index, 0, { id, cost, rank });
        }
      }
      if (!costs.has(target)) throw new Error("Graph edge has no clear orthogonal route");
      route = [last];
      for (let id = target; id !== source; ) {
        id = parents.get(id);
        route.unshift(point(id));
      }
    }
    const points = [];
    for (const point of [start, ...route, end]) {
      const b = points.at(-1), a = points.at(-2);
      if (b && b[0] === point[0] && b[1] === point[1]) continue;
      if (a && (a[0] === b[0] && b[0] === point[0] || a[1] === b[1] && b[1] === point[1])) points.pop();
      points.push(point);
    }
    return points;
  }
  function nodeState(instances, siteId) {
    const matches = (instances ?? []).filter((node) => node.siteId === siteId || node.site_id === siteId || node.id === siteId);
    const states = matches.map((node) => node.status);
    if (states.some((state) => ["running", "in-flight", "inflight", "started"].includes(state))) return "running";
    if (states.some((state) => ["failed", "errored", "held", "blocked"].includes(state))) return "failed";
    if (states.includes("cancelled")) return "cancelled";
    if (states.includes("stopped")) return "stopped";
    if (states.length && states.every((state) => ["completed", "succeeded", "cached", "done"].includes(state))) return "completed";
    return "pending";
  }
  function siteProgress(rows = []) {
    return rows.reduce((sum, row) => {
      const count = Number.isSafeInteger(row.count) && row.count >= 0 ? row.count : 1;
      sum.total += count;
      if (nodeState([row], row.siteId) === "completed") sum.completed += count;
      return sum;
    }, { completed: 0, total: 0 });
  }
  function actorBadge(actor) {
    const id = actor.siteId ?? actor.name ?? "?";
    const number = /^actor#(\d+)$/.exec(id)?.[1];
    return { initial: number ? `A${number}` : Array.from(actor.name ?? id).slice(0, 2).join(""), color: Array.from(id).reduce((sum, char) => sum + char.codePointAt(0), 0) % 3 };
  }
  function phaseModel(run) {
    const graph = run?.analysis?.causality;
    const actorNames = new Map((graph?.lanes ?? []).map((lane) => [lane.id, lane.name ?? lane.id]));
    const instructions = /* @__PURE__ */ new Map();
    for (const { event } of run?.events ?? []) if (typeof event?.instructionsHead === "string" && event.instance?.siteId) instructions.set(event.instance.siteId, event.instructionsHead);
    const steps = graph?.steps ?? [];
    const phases = [...graph?.phases ?? []];
    const known = new Set(phases.map((phase) => phase.id));
    const owners = /* @__PURE__ */ new Map();
    for (const step of steps) {
      const site = step.source ?? step.id;
      if (!owners.has(site)) owners.set(site, /* @__PURE__ */ new Set());
      owners.get(site).add(known.has(step.phase) ? step.phase : "unphased");
    }
    const other = steps.filter((step) => !known.has(step.phase));
    const observed = /* @__PURE__ */ new Set();
    for (const row of run?.siteStates ?? []) if ((!owners.has(row.siteId) || owners.get(row.siteId).size > 1) && !observed.has(row.siteId)) {
      observed.add(row.siteId);
      other.push({ id: `observed:${row.siteId}`, source: row.siteId, label: row.siteId });
    }
    if (other.length && !known.has("unphased")) phases.push({ id: "unphased" });
    return phases.map((phase) => {
      const tasks = phase.id === "unphased" ? [...new Map([...steps.filter((step) => step.phase === phase.id), ...other].map((step) => [step.id, step])).values()] : steps.filter((step) => step.phase === phase.id);
      const ids = new Set(tasks.map((step) => step.source ?? step.id));
      const rows = (run?.siteStates ?? []).filter((row) => ids.has(row.siteId) && (phase.id === "unphased" || owners.get(row.siteId)?.size === 1));
      const states = rows.map((row) => nodeState([row], row.siteId));
      const progress = siteProgress(rows);
      const entered = phase.name && phases.filter((item) => item.name === phase.name).length === 1 && (run?.events ?? []).some((row) => row.event?.type === "phase-entered" && row.event.name === phase.name);
      const observed2 = tasks.length ? tasks.every((step) => nodeState(rows, step.source ?? step.id) === "completed") : entered;
      const status = states.includes("failed") ? "failed" : states.includes("running") ? "running" : states.includes("cancelled") ? "cancelled" : states.includes("stopped") ? "stopped" : observed2 ? run?.status === "completed" ? "completed" : "waiting" : "pending";
      return { ...phase, tasks: tasks.map((task) => ({
        ...task,
        label: (task.lanes ?? [task.lane]).map((id) => actorNames.get(id)).filter(Boolean).join(" \xB7 ") || task.label || task.id,
        instruction: instructions.get(task.source ?? task.id) ?? ""
      })), ...progress, status };
    });
  }
  function workflowView(view) {
    return ["timeline", "overview", "details", "results"].includes(view) ? view : "timeline";
  }

  // vendor/zcode/ui-presets/index.js
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

  // workflow/client/artifact.js
  function createArtifactView(React, { api, t, code, downloadUrl }) {
    const h = React.createElement;
    const { useState, useEffect, useRef } = React;
    return function Artifact({ item, sessionId, runId, revision }) {
      const [entries, setEntries] = useState([]), [error, setError] = useState(""), [loading, setLoading] = useState(false);
      const cursor = useRef(0);
      const kind = item.kind ?? item.type;
      const preset = ["chart", "table", "metrics", "board"].includes(kind);
      useEffect(() => {
        if (!preset) return;
        const abort = new AbortController();
        setLoading(true);
        setError("");
        void (async () => {
          for (; ; ) {
            const page = await api(sessionId, { action: "reports", id: runId, artifactId: item.id, after: cursor.current, limit: 256 }, abort.signal);
            if (abort.signal.aborted) return;
            const previous = cursor.current;
            cursor.current = page.nextCursor;
            setEntries((values) => [...values, ...page.reports]);
            if (!page.hasMore) break;
            if (cursor.current <= previous) throw new Error("\u62A5\u544A\u5206\u9875\u6E38\u6807\u6CA1\u6709\u63A8\u8FDB");
          }
        })().catch((err) => {
          if (!abort.signal.aborted) setError(err.message);
        }).finally(() => {
          if (!abort.signal.aborted) setLoading(false);
        });
        return () => abort.abort();
      }, [sessionId, runId, item.id, preset, revision]);
      const spec = preset ? parseArtifactPresetSpec(kind, item.spec) : void 0;
      const model2 = spec ? applyArtifactItems(kind, spec, entries.map((row, index) => ({ sequence: index, siteId: row.instance.siteId, ordinal: row.instance.ordinal, item: row.item }))) : void 0;
      let body;
      if (kind === "markdown") body = code(item.content ?? "");
      else if (model2?.kind === "table") body = h(
        "table",
        null,
        h("thead", null, h("tr", null, model2.columns.map((col) => h("th", { key: col.field }, col.label, col.unit ? ` (${col.unit})` : "")))),
        h("tbody", null, model2.rows.map((row) => h("tr", { key: row.id }, row.cells.map((cell, index) => h("td", { key: index }, cell)))))
      );
      else if (model2?.kind === "metrics") body = h("div", { className: "caw-metrics" }, model2.metrics.map((metric) => h(
        "div",
        { key: metric.field },
        h("span", null, metric.label),
        h("strong", null, metric.value ?? "\u2014"),
        metric.unit
      )));
      else if (model2?.kind === "board") body = h("div", { className: "caw-board" }, model2.columns.map((column) => h(
        "section",
        { key: column.id },
        h("h4", null, column.other ? t("other") : column.id),
        column.cards.map((card) => h(
          "div",
          { key: card.id, className: "caw-log" },
          h("strong", null, card.title),
          card.details.map((detail, index) => h("p", { key: index }, `${detail.label}: ${detail.value}${detail.unit ? ` ${detail.unit}` : ""}`))
        ))
      )));
      else if (model2?.kind === "chart") {
        const transform = (value) => model2.scale === "log" ? Math.log10(value) : value;
        const low = model2.domain ? model2.scale === "log" ? model2.domain.yMin : Math.min(0, model2.domain.yMin, model2.baseline?.value ?? 0) : 0;
        const high = Math.max(low, model2.domain?.yMax ?? 1, model2.baseline?.value ?? low);
        const min = transform(low), span = transform(high) - min || 1;
        const xMin = model2.domain?.xMin ?? 0, xSpan = (model2.domain?.xMax ?? 1) - xMin || 1;
        const x = (point) => 50 + (point.x - xMin) / xSpan * 450;
        const y = (value) => 175 - (transform(value) - min) / span * 155;
        const colors = ["--dsw-alias-brand-primary", "--dsw-alias-state-success-primary", "--dsw-alias-state-warn-primary", "--dsw-alias-state-error-primary"];
        const table = h(
          "table",
          null,
          h("thead", null, h("tr", null, h("th", null, model2.x.label), model2.series.map((series) => h("th", { key: series.key }, series.label)))),
          h("tbody", null, model2.points.map((point) => h("tr", { key: point.sequence }, h("td", null, point.xLabel), model2.series.map((series) => h("td", { key: series.key }, String(point[series.key] ?? ""))))))
        );
        body = h(
          React.Fragment,
          null,
          h(
            "svg",
            { viewBox: "0 0 540 240", role: "img", "aria-label": item.title ?? item.id, style: { width: "100%", maxHeight: 300 } },
            h("path", { d: "M45 10 V180 H520", fill: "none", stroke: "var(--dsw-alias-border-l2)" }),
            h("text", { x: 2, y: 20, fontSize: 10, fill: "var(--dsw-alias-label-secondary)" }, String(high)),
            h("text", { x: 2, y: 178, fontSize: 10, fill: "var(--dsw-alias-label-secondary)" }, String(low)),
            model2.baseline && h(
              "g",
              null,
              h("path", { d: `M45 ${y(model2.baseline.value)} H520`, stroke: "var(--dsw-alias-label-secondary)", strokeDasharray: "4 3" }),
              h("text", { x: 50, y: y(model2.baseline.value) - 4, fontSize: 10, fill: "var(--dsw-alias-label-secondary)" }, `${model2.baseline.label}: ${model2.baseline.value}`)
            ),
            model2.series.map((series, index) => {
              const color = `var(${colors[index % colors.length]})`;
              const points = model2.points.filter((point) => typeof point[series.key] === "number");
              return h(
                "g",
                { key: series.key },
                h("text", { x: 50 + index * 135, y: 225, fontSize: 11, fill: color }, series.label),
                points.map((point) => model2.type === "bar" ? h("rect", { key: point.sequence, x: x(point) - 5 + index * 7, y: Math.min(y(point[series.key]), y(model2.scale === "log" ? low : 0)), width: 6, height: Math.abs(y(point[series.key]) - y(model2.scale === "log" ? low : 0)), fill: color }, h("title", null, `${point.xLabel}: ${point[series.key]}`)) : h("circle", { key: point.sequence, cx: x(point), cy: y(point[series.key]), r: 3, fill: color }, h("title", null, `${point.xLabel}: ${point[series.key]}`))),
                model2.type === "line" && h("polyline", { points: points.map((point) => `${x(point)},${y(point[series.key])}`).join(" "), fill: "none", stroke: color, strokeWidth: 1.5 })
              );
            }),
            model2.points.length > 0 && h("text", { x: 50, y: 197, fontSize: 10, fill: "var(--dsw-alias-label-secondary)" }, model2.points[0].xLabel),
            model2.points.length > 1 && h("text", { x: 515, y: 197, textAnchor: "end", fontSize: 10, fill: "var(--dsw-alias-label-secondary)" }, model2.points.at(-1).xLabel)
          ),
          h("details", null, h("summary", null, t("details")), table)
        );
      } else if (kind === "file") body = h("a", { href: downloadUrl(sessionId, runId, item), download: item.sourcePath?.split("/").at(-1) ?? item.id }, item.sourcePath ?? item.id);
      else body = code(item);
      return h(
        "section",
        { className: "caw-section" },
        h("h3", null, item.title ?? item.label ?? spec?.title ?? item.id),
        spec?.description && h("p", { className: "caw-note" }, spec.description),
        loading && h("p", { className: "caw-note", role: "status" }, `${t("loading")} (${entries.length})`),
        error && h("p", { className: "caw-error", role: "alert" }, error),
        preset && !spec && h("p", { className: "caw-error", role: "alert" }, t("invalidPreset")),
        body,
        kind === "markdown" && h("a", { href: downloadUrl(sessionId, runId, item), download: `${item.id}.md` }, t("download"))
      );
    };
  }

  // workflow/client/fusion.js
  function createFusionView(React, { t, button }) {
    const h = React.createElement;
    const { useState } = React;
    const modelOptions = (routes) => [
      h("option", { key: "inherit", value: "" }, t("fusionInheritModel")),
      ...routes.filter((row) => typeof row?.provider === "string" && typeof row?.model === "string").map((row) => h("option", { key: row.provider + "/" + row.model, value: row.provider + "/" + row.model }, row.provider + "/" + row.model))
    ];
    const field = (label, id, child) => h("label", { htmlFor: id, key: id }, label, child);
    const statusText = (result, key) => result === void 0 ? t("fusionNotYet") : result ? t(key + "Pass") : t(key + "Fail");
    function FusionComposer({ modelRoutes = [], busy = false, onCreate, draft, onDraftChange }) {
      const [local, setLocal] = useState({ task: "", name: "", leadModel: "", sidekickModel: "", reviewModel: "", testScript: "selfcheck", maxRounds: "2" });
      const values = draft ?? local;
      const { task, name, leadModel, sidekickModel, reviewModel, testScript, maxRounds } = values;
      const update = (key) => (value) => (onDraftChange ?? setLocal)((previous) => ({ ...local, ...previous, [key]: value }));
      const setTask = update("task"), setName = update("name"), setLeadModel = update("leadModel"), setSidekickModel = update("sidekickModel"), setReviewModel = update("reviewModel"), setTestScript = update("testScript"), setMaxRounds = update("maxRounds");
      const create = () => {
        if (!task.trim()) return;
        const payload = {
          action: "fusion_create",
          task: task.trim(),
          maxRounds: Number(maxRounds),
          testScript: testScript.trim(),
          ...name.trim() ? { name: name.trim() } : {},
          ...leadModel ? { leadModel } : {},
          ...sidekickModel ? { sidekickModel } : {},
          ...reviewModel ? { reviewModel } : {}
        };
        return onCreate(payload);
      };
      return h(
        "section",
        { className: "caw-fusion caw-editor", "data-fusion-composer": "", "aria-label": t("fusionTitle") },
        h(
          "header",
          { className: "caw-editor-title" },
          h("div", null, h("h3", null, t("fusionTitle")), h("p", { className: "caw-note" }, t("fusionIntro")))
        ),
        h(
          "div",
          { className: "caw-fusion-roles", "aria-label": t("fusionRoles") },
          ["Lead", "Sidekick", "Reviewer"].map((role) => h("div", { key: role, className: "caw-fusion-role" }, h("strong", null, role), h("span", null, t("fusionRole" + role))))
        ),
        h(
          "div",
          { className: "caw-editor-fields caw-fusion-fields" },
          field(t("fusionTask"), "fusion-task", h("textarea", {
            id: "fusion-task",
            rows: 4,
            value: task,
            maxLength: 12e3,
            placeholder: t("fusionTaskPlaceholder"),
            onChange: (e) => setTask(e.target.value)
          })),
          field(t("name"), "fusion-name", h("input", {
            id: "fusion-name",
            value: name,
            maxLength: 120,
            onChange: (e) => setName(e.target.value),
            placeholder: t("fusionNamePlaceholder")
          })),
          ...[
            ["Lead", leadModel, setLeadModel],
            ["Sidekick", sidekickModel, setSidekickModel],
            ["Reviewer", reviewModel, setReviewModel]
          ].map(([role, value, setter]) => field(
            t("fusionModel" + role),
            "fusion-model-" + role.toLowerCase(),
            h(
              "select",
              { id: "fusion-model-" + role.toLowerCase(), value, onChange: (e) => setter(e.target.value) },
              ...modelOptions(modelRoutes)
            )
          )),
          field(t("fusionTest"), "fusion-test", h("input", {
            id: "fusion-test",
            value: testScript,
            maxLength: 80,
            spellCheck: false,
            onChange: (e) => setTestScript(e.target.value)
          })),
          field(t("fusionRounds"), "fusion-rounds", h("select", {
            id: "fusion-rounds",
            value: maxRounds,
            onChange: (e) => setMaxRounds(e.target.value)
          }, [1, 2, 3].map((count) => h("option", { value: String(count), key: count }, String(count)))))
        ),
        h(
          "div",
          { className: "caw-editor-actions" },
          h("p", { className: "caw-note" }, t("fusionSafety")),
          h("p", { className: "caw-note" }, t("fusionTestHint")),
          h(
            "div",
            { className: "caw-row" },
            button(
              busy ? t("loading") : t("fusionCreateDraft"),
              create,
              busy || !task.trim() || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(testScript),
              true
            )
          )
        )
      );
    }
    function FusionSummary({ run, onDetails }) {
      const args = run?.args;
      if (!args || args.preset !== "fusion.v1") return null;
      const evidence = (run.reports ?? []).map((row) => row.item).filter((item) => item?.preset === "fusion.v1");
      const result = run.result ?? evidence.reduce((latest, item) => item.rounds === latest.rounds ? { ...latest, ...item } : item, {});
      const tests = result?.test;
      const review = result?.review;
      const outcome = result?.success === void 0 ? void 0 : result.success === true;
      const reviewApproved = review === void 0 ? void 0 : review.approved === true && Array.isArray(review.blockingIssues) && review.blockingIssues.length === 0;
      return h(
        "section",
        { className: "caw-fusion-summary", "data-fusion-summary": "", "aria-label": t("fusionTitle") },
        h(
          "div",
          { className: "caw-fusion-summary-header" },
          h("div", null, h("strong", null, t("fusionTitle")), h("span", { className: "caw-note" }, " \xB7 " + t("fusionRounds") + ": " + (result?.rounds ?? "\u2014") + " / " + args.maxRounds)),
          h("span", { className: "caw-state", "data-state": run.status }, t(run.status ?? "unknown"))
        ),
        h("p", { className: "caw-fusion-summary-task" }, args.task),
        h(
          "div",
          { className: "caw-fusion-checks" },
          h("span", null, t("fusionTest"), ": ", tests === void 0 ? t("fusionNotYet") : tests.exitCode === 0 ? t("fusionTestPass") : t("fusionTestFail") + " (" + tests.exitCode + ")"),
          h("span", null, t("fusionReview"), ": ", statusText(reviewApproved, "fusionReview")),
          h("span", null, t("fusionSignoff"), ": ", statusText(outcome, "fusionSignoff"))
        ),
        Array.isArray(review?.blockingIssues) && review.blockingIssues.length > 0 && h(
          "div",
          { className: "caw-fusion-blockers", role: "status" },
          h("strong", null, t("fusionBlockingIssues")),
          h("ul", null, review.blockingIssues.slice(0, 10).map((issue, i) => h("li", { key: i }, String(issue))))
        ),
        h("div", { className: "caw-row" }, button(t("fusionInspect"), onDetails))
      );
    }
    return { FusionComposer, FusionSummary };
  }

  // workflow/client/fusion-terminal.js
  var short = (v, n = 120) => typeof v === "string" ? v.slice(0, n) : "";
  var numeric = (v) => typeof v === "number" && Number.isFinite(v);
  var roleName = (actor) => String(actor?.name ?? actor?.persona?.name ?? "").toLowerCase();
  var roleActor = (run, key) => (run?.actors ?? []).find((a) => roleName(a).includes(key));
  var model = (run, role) => {
    const choice = run?.args?.models?.[role];
    if (typeof choice === "string" && choice) return choice;
    const actor = roleActor(run, role);
    if (typeof actor?.resolvedModel === "string") {
      try {
        const parsed = JSON.parse(actor.resolvedModel);
        if (parsed?.model) return (parsed.provider ? parsed.provider + "/" : "") + parsed.model;
      } catch {
      }
      return actor.resolvedModel;
    }
    return null;
  };
  var actorState = (run, role) => {
    const actor = roleActor(run, role);
    if (!actor) return "pending";
    const rows = (run?.nodes ?? []).filter((n) => n.kind === "ask" && n.actorSiteId === actor.siteId);
    return rows.at(-1)?.status ?? "pending";
  };
  function fusionTerminalSnapshot(run) {
    const evidence = (run?.reports ?? []).map((r) => r?.item).filter((i) => i?.preset === "fusion.v1");
    const result = run?.result;
    const last = evidence.at(-1);
    const test = result?.test ?? [...evidence].reverse().find((i) => i?.test)?.test;
    const review = result?.review ?? [...evidence].reverse().find((i) => i?.review)?.review;
    const rounds = Number.isInteger(result?.rounds) ? result.rounds : Number.isInteger(last?.rounds) ? last.rounds : null;
    const reviewState = review === void 0 ? "pending" : review.approved === true && Array.isArray(review.blockingIssues) && review.blockingIssues.length === 0 ? "completed" : "failed";
    const tests = numeric(test?.exitCode) ? test.exitCode === 0 ? "completed" : "failed" : "pending";
    return {
      status: run?.status ?? "draft",
      tokens: numeric(run?.spentTokens) ? run.spentTokens : null,
      rounds,
      maxRounds: Number.isInteger(run?.args?.maxRounds) ? run.args.maxRounds : null,
      models: { lead: model(run, "lead"), sidekick: model(run, "sidekick"), reviewer: model(run, "reviewer") },
      actors: { lead: actorState(run, "lead"), sidekick: actorState(run, "sidekick"), reviewer: actorState(run, "reviewer") },
      tests,
      testExit: numeric(test?.exitCode) ? test.exitCode : null,
      review: reviewState,
      signoff: result?.success === true ? "completed" : result?.success === false ? "failed" : "pending",
      script: typeof run?.args?.testScript === "string" ? run.args.testScript : null,
      blockers: Array.isArray(review?.blockingIssues) ? review.blockingIssues.slice(0, 4).map((x) => short(String(x))) : [],
      logs: (run?.events ?? []).slice(-7).map((r, i) => ({
        seq: r.sequence ?? i,
        type: short(r.event?.type ?? r.type ?? "event", 45),
        message: short(r.event?.message ?? r.event?.name ?? r.message ?? "", 110)
      }))
    };
  }
  var STYLE = `
.caw-tty{--bg:#0b1018;--panel:#101722;--edge:#303d50;--ink:#dbe4f4;--muted:#9aaac4;--blue:#86adf6;--violet:#c9a8f3;--green:#7fe0ae;--amber:#e8ae90;background:var(--bg);color:var(--ink);border:1px solid var(--edge);border-radius:8px;overflow:hidden;font:12px/1.48 ui-monospace,SFMono-Regular,Consolas,monospace;min-width:0}
.caw-tty *{box-sizing:border-box}
.caw-tty .tty-head{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding:12px 15px;border-bottom:1px solid var(--edge);letter-spacing:.07em}
.caw-tty .tty-title{font-weight:700;color:var(--green)}
.caw-tty .tty-metrics{display:flex;flex-wrap:wrap;gap:8px;color:var(--muted);font-size:11px}
.caw-tty .tty-pill{border:1px solid var(--edge);padding:3px 7px;border-radius:3px}
.caw-tty .tty-scene{display:grid;grid-template-columns:minmax(170px,.6fr) minmax(0,2fr);gap:16px;padding:16px}
.caw-tty .tty-aside{border:1px solid #725e9f;background:#141322;padding:14px;display:flex;flex-direction:column;gap:10px;min-height:340px}
.caw-tty .tty-label{font-size:10px;letter-spacing:.11em;color:var(--muted);text-transform:uppercase}
.caw-tty .tty-name{font-weight:700;font-size:13px;overflow-wrap:anywhere}
.caw-tty .tty-aside .tty-name{color:var(--violet)}
.caw-tty .tty-model{font-size:11px;color:var(--muted);overflow-wrap:anywhere}
.caw-tty .tty-oversight{margin-top:auto;padding-top:12px;border-top:1px solid #3e334e}
.caw-tty .tty-flow{display:flex;flex-direction:column;align-items:center;min-width:0}
.caw-tty .tty-node{border:1px solid var(--edge);padding:11px 10px;background:var(--panel);text-align:center;min-width:0;width:min(100%,290px)}
.caw-tty .tty-implement{border-color:#ab7960}
.caw-tty .tty-implement .tty-name{color:var(--amber)}
.caw-tty .tty-gate{border-color:#4f967b;background:#10201d}
.caw-tty .tty-gate .tty-name{color:var(--green)}
.caw-tty .tty-branch{width:100%;display:flex;gap:8px;max-width:630px}
.caw-tty .tty-branch .tty-node{flex:1;width:auto;border-color:#58759d;padding:9px 5px}
.caw-tty .tty-branch .tty-name{color:var(--blue);font-size:12px}
.caw-tty .tty-spine{width:1px;height:24px;background:var(--edge);position:relative}
.caw-tty .tty-spine:before{content:"";position:absolute;top:0;left:-2px;background:var(--blue);width:5px;height:5px;border-radius:50%}
.caw-tty[data-status=running] .tty-spine:before{animation:tty-flow 1.55s linear infinite}
.caw-tty .tty-fork{height:20px;width:78%;border-top:1px solid var(--edge);border-left:1px solid var(--edge);border-right:1px solid var(--edge);margin-top:7px}
.caw-tty .tty-join{height:20px;width:78%;border-bottom:1px solid var(--edge);border-left:1px solid var(--edge);border-right:1px solid var(--edge)}
.caw-tty .tty-return{border:1px solid #826554;padding:7px 12px;background:#1d1717;color:var(--amber);font-size:11px;text-align:center}
.caw-tty .tty-state{font-size:10px;color:var(--muted);margin-top:4px}
.caw-tty .tty-state[data-status=completed]{color:var(--green)}
.caw-tty .tty-state[data-status=failed]{color:var(--amber)}
.caw-tty .tty-gauge{display:flex;height:5px;gap:2px;background:#2d3b38;margin-top:9px}
.caw-tty .tty-gauge span{flex:1;background:#3d665a}
.caw-tty .tty-gauge span[data-done=true]{background:var(--green)}
.caw-tty .tty-console{border-top:1px solid var(--edge);padding:12px 15px;background:#0e141e}
.caw-tty .tty-console-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;gap:10px}
.caw-tty .tty-console button{border:1px solid var(--edge);color:var(--blue);font:inherit;font-size:11px;padding:3px 9px;background:#172335;cursor:pointer;border-radius:3px}
.caw-tty .tty-log{display:grid;grid-template-columns:50px minmax(80px,125px) minmax(0,1fr);gap:8px;border-bottom:1px solid #1d2836;padding:3px 0;color:var(--muted);font-size:11px}
.caw-tty .tty-log code{color:var(--blue);overflow-wrap:anywhere}
.caw-tty .tty-log span:last-child{overflow-wrap:anywhere}
.caw-tty .tty-alert{border-left:2px solid var(--amber);margin-top:10px;padding:3px 9px;color:var(--amber);overflow-wrap:anywhere}
.caw-tty .tty-footnote{color:var(--muted);font-size:10px;margin-top:8px}
@keyframes tty-flow{from{transform:translateY(0);opacity:.5}to{transform:translateY(22px);opacity:0}}
@container(max-width:760px){.caw-tty .tty-scene{grid-template-columns:1fr}.caw-tty .tty-aside{min-height:auto}}
@container(max-width:470px){.caw-tty .tty-scene{padding:10px}.caw-tty .tty-branch{flex-direction:column}.caw-tty .tty-fork,.caw-tty .tty-join{display:none}.caw-tty .tty-log{grid-template-columns:50px 1fr}.caw-tty .tty-log span:last-child{grid-column:2}}
@media(prefers-reduced-motion:reduce){.caw-tty .tty-spine:before{animation:none!important}}
`;
  function createFusionTerminalView(React, { t, button }) {
    const h = React.createElement;
    const state = (s) => h("span", { className: "tty-state", "data-status": s }, t(s ?? "unknown"));
    const role = (caption, model2, status) => h(
      "div",
      { className: "tty-node" },
      h("div", { className: "tty-name" }, caption),
      h("div", { className: "tty-model" }, model2 ?? t("fusionTerminalUnknown")),
      state(status)
    );
    const line = () => h("div", { className: "tty-spine", "aria-hidden": true });
    function FusionTerminal({ run, onLogs }) {
      if (run?.args?.preset !== "fusion.v1") return null;
      const d = fusionTerminalSnapshot(run);
      const rounds = d.maxRounds ? Array.from({ length: Math.min(3, d.maxRounds) }, (_, i) => i < (d.rounds ?? 0)) : [];
      return h(
        "section",
        { className: "caw-tty", "data-fusion-terminal": "", "data-status": d.status, "aria-label": t("fusionTerminalTitle") },
        h("style", null, STYLE),
        h(
          "header",
          { className: "tty-head" },
          h("span", { className: "tty-title" }, "\u25A3  " + t("fusionTerminalTitle")),
          h(
            "div",
            { className: "tty-metrics" },
            h("span", { className: "tty-pill" }, t(d.status)),
            h("span", { className: "tty-pill" }, t("fusionRounds") + ": " + (d.rounds ?? "\u2014") + "/" + (d.maxRounds ?? "\u2014")),
            h("span", { className: "tty-pill" }, t("tokens") + ": " + (d.tokens === null ? "\u2014" : d.tokens.toLocaleString()))
          )
        ),
        h(
          "div",
          { className: "tty-scene" },
          h(
            "aside",
            { className: "tty-aside" },
            h("div", { className: "tty-label" }, t("fusionTerminalOversight")),
            h("div", { className: "tty-name" }, "LEAD / " + t("fusionTerminalDecision")),
            h("div", { className: "tty-model" }, d.models.lead ?? t("fusionTerminalUnknown")),
            state(d.actors.lead),
            h(
              "div",
              { className: "tty-oversight" },
              h("div", { className: "tty-label" }, t("fusionTerminalSignoff")),
              state(d.signoff),
              h("p", { className: "tty-model" }, t("fusionTerminalNotAdvisor"))
            )
          ),
          h(
            "div",
            { className: "tty-flow" },
            h("div", { className: "tty-label" }, t("fusionTerminalExecution")),
            h(
              "div",
              { className: "tty-node tty-implement" },
              h("div", { className: "tty-name" }, "SIDEKICK / " + t("fusionTerminalBuild")),
              h("div", { className: "tty-model" }, d.models.sidekick ?? t("fusionTerminalUnknown")),
              state(d.actors.sidekick)
            ),
            line(),
            h(
              "div",
              { className: "tty-node tty-gate" },
              h("div", { className: "tty-name" }, t("fusionTerminalGate")),
              h("div", { className: "tty-model" }, d.script ? "pnpm run " + d.script : t("fusionTerminalUnknown")),
              state(d.tests),
              d.testExit !== null && h("div", { className: "tty-state" }, "exit " + d.testExit),
              rounds.length > 0 && h(
                "div",
                { className: "tty-gauge", "aria-label": t("fusionRounds") },
                rounds.map((done, i) => h("span", { key: i, "data-done": done }))
              )
            ),
            line(),
            h("div", { className: "tty-label" }, t("fusionTerminalParallel")),
            h("div", { className: "tty-fork", "aria-hidden": true }),
            h(
              "div",
              { className: "tty-branch" },
              role(t("fusionTerminalPlan"), d.models.lead, d.actors.lead),
              role(t("fusionTerminalTest"), d.script ? "pnpm run " + d.script : null, d.tests),
              role(t("fusionTerminalReview"), d.models.reviewer, d.review)
            ),
            h("div", { className: "tty-join", "aria-hidden": true }),
            line(),
            h("div", { className: "tty-return" }, t("fusionTerminalReturn") + " \xB7 " + t(d.signoff))
          )
        ),
        h(
          "div",
          { className: "tty-console" },
          h(
            "div",
            { className: "tty-console-head" },
            h("span", { className: "tty-label" }, t("fusionTerminalLogs")),
            button(t("fusionInspect"), onLogs, false, false, { className: "tty-console-button" })
          ),
          d.logs.length ? d.logs.map((e) => h(
            "div",
            { className: "tty-log", key: e.seq },
            h("span", null, "#" + e.seq),
            h("code", null, e.type),
            h("span", null, e.message || "\u2014")
          )) : h("div", { className: "tty-model" }, t("fusionTerminalNoLogs")),
          d.blockers.length > 0 && h(
            "div",
            { className: "tty-alert", role: "status" },
            t("fusionBlockingIssues") + ": " + d.blockers.join(" \xB7 ")
          ),
          h("div", { className: "tty-footnote" }, t("fusionTerminalEvidence"))
        )
      );
    }
    return { FusionTerminal };
  }

  // workflow/client/navigation.js
  var WORKFLOW_VIEW_ID = "composer-assist-workflow";
  function workflowSelection(current, runs = []) {
    return current ?? { runId: runs[0]?.id ?? null, view: "overview" };
  }
  function workflowEditorState(cached, runId, saved) {
    const key = JSON.stringify([runId ?? null, saved?.scope ?? null, saved?.name ?? null]);
    return { key, draft: cached?.key === key ? cached.draft : null };
  }

  // workflow/client/ui.js
  var SAMPLE = `interface Finding { summary: string; risks: string[] }
const reader = agent("\u8C03\u67E5\u5458", { system: "\u53EA\u8BFB\u68C0\u67E5\u9879\u76EE\uFF0C\u6309\u8981\u6C42\u8FD4\u56DE\u7ED3\u6784\u5316\u7ED3\u8BBA\u3002" });
const reviewer = agent("\u590D\u6838\u5458", { system: "\u72EC\u7ACB\u6838\u5BF9\u8C03\u67E5\u7ED3\u679C\uFF0C\u53EA\u8BFB\u64CD\u4F5C\u3002" });
phase("\u8C03\u67E5");
const finding = await reader.ask<Finding>("\u67E5\u770B\u9879\u76EE\u7ED3\u6784\uFF0C\u8BF4\u660E\u6838\u5FC3\u5165\u53E3\u4E0E\u503C\u5F97\u5173\u6CE8\u7684\u98CE\u9669\u3002");
report(finding);
phase("\u590D\u6838");
const review = await reviewer.ask("\u6838\u5BF9\u8FD9\u4EFD\u7ED3\u8BBA\uFF1A" + JSON.stringify(finding));
await artifact.markdown("report", review, { title: "\u9879\u76EE\u590D\u6838\u62A5\u544A", primary: true });
return { finding, review };`;
  var API = "/api/composer-assist/workflow";
  var NS = "composerWorkflow";
  var zh = {
    model: "\u6267\u884C\u6A21\u578B",
    inheritModel: "\u6309\u4F1A\u8BDD\u8BBE\u7F6E\u9009\u62E9",
    clipped: "\u5F53\u524D\u663E\u793A\u90E8\u5206\u8BB0\u5F55\uFF0C\u53EF\u52A0\u8F7D\u5176\u4F59\u8BB0\u5F55\u3002",
    other: "\u5176\u4ED6",
    invalidPreset: "\u770B\u677F\u89C4\u683C\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u5DE5\u4F5C\u6D41\u5B9A\u4E49",
    download: "\u4E0B\u8F7D Markdown",
    loadMore: "\u52A0\u8F7D\u66F4\u591A",
    title: "\u5DE5\u4F5C\u6D41",
    mainEntryHint: "\u5B8C\u6574\u6D41\u7A0B\u89C1\u4E0A\u65B9\u300C\u5DE5\u4F5C\u6D41\u300D\u9875\u7B7E",
    close: "\u5173\u95ED\u5DE5\u4F5C\u6D41",
    create: "\u65B0\u5EFA",
    history: "\u8FD0\u884C\u8BB0\u5F55",
    saved: "\u5DF2\u4FDD\u5B58",
    empty: "\u8FD8\u6CA1\u6709\u5DE5\u4F5C\u6D41\u3002\u7F16\u5199\u811A\u672C\uFF0C\u5206\u6790\u6D41\u7A0B\u540E\u5373\u53EF\u8FD0\u884C\u3002",
    name: "\u5DE5\u4F5C\u6D41\u540D\u79F0",
    script: "TypeScript \u811A\u672C",
    args: "\u53C2\u6570\uFF08JSON \u5BF9\u8C61\uFF09",
    concurrency: "\u5E76\u53D1\u4EFB\u52A1",
    analyze: "\u5206\u6790\u6D41\u7A0B",
    run: "\u786E\u8BA4\u5E76\u8FD0\u884C",
    stop: "\u505C\u6B62\u8FD0\u884C",
    resume: "\u65AD\u70B9\u6062\u590D",
    amend: "\u4FEE\u6539\u540E\u7EED\u8DD1",
    save: "\u4FDD\u5B58\u6D41\u7A0B",
    project: "\u5F53\u524D\u9879\u76EE",
    global: "\u5168\u5C40",
    graph: "\u4F9D\u8D56\u56FE",
    causality: "\u6267\u884C\u987A\u5E8F",
    flow: "\u63A7\u5236\u6D41",
    handoff: "\u9636\u6BB5\u4EA4\u63A5",
    overview: "\u6D41\u7A0B\u56FE",
    details: "\u8282\u70B9\u4E0E\u65E5\u5FD7",
    results: "\u7ED3\u679C\u4E0E\u4EA7\u7269",
    ready: "\u5206\u6790\u901A\u8FC7\uFF0C\u8BF7\u786E\u8BA4\u811A\u672C\u548C\u6D41\u7A0B\u56FE\u540E\u8FD0\u884C\u3002",
    stale: "\u811A\u672C\u5DF2\u4FEE\u6539\uFF0C\u5148\u91CD\u65B0\u5206\u6790\u3002",
    billing: "\u8FD0\u884C\u4F1A\u8C03\u7528\u771F\u5B9E\u5B50 Agent\uFF0C\u5E76\u4F7F\u7528\u5F53\u524D\u4F1A\u8BDD\u7684\u5DE5\u5177\u6743\u9650\u4E0E\u6A21\u578B\u989D\u5EA6\u3002",
    node: "\u8282\u70B9\u8BE6\u60C5",
    noNode: "\u70B9\u51FB\u6D41\u7A0B\u56FE\u8282\u70B9\u67E5\u770B\u4EFB\u52A1\u3001\u7ED3\u679C\u548C\u9519\u8BEF\u3002",
    events: "\u6267\u884C\u65E5\u5FD7",
    pending: "\u5F85\u6267\u884C",
    running: "\u8FD0\u884C\u4E2D",
    completed: "\u5DF2\u5B8C\u6210",
    failed: "\u5931\u8D25",
    errored: "\u5931\u8D25",
    stopped: "\u5DF2\u505C\u6B62",
    cancelled: "\u5DF2\u505C\u6B62",
    interrupted: "\u5DF2\u4E2D\u65AD",
    draft: "\u5F85\u786E\u8BA4",
    held: "\u7B49\u5F85\u6838\u5BF9",
    waiting: "\u7B49\u5F85\u5904\u7406",
    questions: "\u5F85\u5904\u7406\u95EE\u9898",
    answer: "\u63D0\u4EA4\u56DE\u7B54",
    holds: "\u4E2D\u65AD\u64CD\u4F5C\u5F85\u6838\u5BF9",
    holdNote: "\u6838\u5BF9\u539F\u64CD\u4F5C\u662F\u5426\u5DF2\u5B8C\u6210\u3002\u91CD\u8BD5\u4F1A\u91CD\u65B0\u6267\u884C\u8BE5\u8282\u70B9\uFF1B\u5DF2\u6709\u7ED3\u679C\u8BF7\u586B\u5165\u7ECF\u786E\u8BA4\u7684 JSON\u3002",
    retry: "\u786E\u8BA4\u672A\u5B8C\u6210\uFF0C\u91CD\u8BD5",
    accept: "\u91C7\u7528\u5DF2\u6838\u5B9E\u7ED3\u679C",
    noResults: "\u5C1A\u65E0\u7ED3\u679C\u6216\u4EA7\u7269\u3002",
    noEvents: "\u5C1A\u65E0\u8FD0\u884C\u4E8B\u4EF6\u3002",
    reports: "\u6E10\u8FDB\u62A5\u544A",
    output: "\u6700\u7EC8\u7ED3\u679C",
    refresh: "\u91CD\u65B0\u8FDE\u63A5",
    connected: "\u5B9E\u65F6\u8FDE\u63A5",
    disconnected: "\u8FDE\u63A5\u4E2D\u65AD",
    loading: "\u5904\u7406\u4E2D\u2026",
    invalidArgs: "\u53C2\u6570\u5FC5\u987B\u662F JSON \u5BF9\u8C61",
    selected: "\u5F53\u524D\u5B9E\u4F8B",
    zoomIn: "\u653E\u5927\u6D41\u7A0B\u56FE",
    zoomOut: "\u7F29\u5C0F\u6D41\u7A0B\u56FE",
    fit: "\u9002\u5E94\u7A97\u53E3",
    emptyGraph: "\u5206\u6790\u811A\u672C\u540E\u663E\u793A\u5B8C\u6574\u6267\u884C\u56FE\u3002",
    savedHint: "\u9009\u62E9\u4FDD\u5B58\u7684\u6D41\u7A0B\uFF0C\u786E\u8BA4\u811A\u672C\u548C\u53C2\u6570\u540E\u518D\u6B21\u8FD0\u884C\u3002",
    untitled: "\u65B0\u5DE5\u4F5C\u6D41",
    inputAnswer: "\u586B\u5199\u56DE\u7B54",
    holes: "\u6D41\u7A0B\u7559\u767D",
    fill: "\u586B\u5165\u4EE3\u7801",
    unknown: "\u672A\u77E5",
    cached: "\u5DF2\u590D\u7528",
    superseded: "\u5DF2\u7531\u65B0\u5B9E\u4F8B\u7EED\u63A5",
    source: "\u539F\u5B9E\u4F8B",
    tools: "API \u8BF4\u660E",
    useSample: "\u8F7D\u5165\u793A\u4F8B",
    sampleHint: "\u793A\u4F8B\uFF1A\u53EA\u8BFB\u8C03\u67E5\u540E\u590D\u6838"
  };
  var en = Object.fromEntries(Object.keys(zh).map((key) => [key, key]));
  Object.assign(en, { model: "Execution model", inheritModel: "Use session selection", loadMore: "Load more", download: "Download Markdown", fill: "Fill with code", other: "Other", fit: "Fit view", invalidPreset: "Invalid artifact preset", title: "Workflows", mainEntryHint: "Open the Workflows tab above for the full workflow", close: "Close workflows", create: "New", history: "Runs", saved: "Saved", analyze: "Analyze", run: "Confirm and run", stop: "Stop", resume: "Resume", amend: "Amend and continue", save: "Save workflow", graph: "Dependencies", causality: "Execution order", flow: "Control flow", handoff: "Phase handoffs", overview: "Graph", details: "Nodes and log", results: "Results and artifacts", ready: "Analysis passed. Review the script and graph before running.", stale: "The script changed. Analyze it again.", billing: "Runs use real subagents, model quota and the tools permitted in this session.", connected: "Live", disconnected: "Disconnected", loading: "Working\u2026", empty: "Write a script and analyze it to start a workflow.", emptyGraph: "Analyze the script to see its execution graph.", name: "Workflow name", script: "TypeScript script", args: "Arguments (JSON object)", concurrency: "Concurrent tasks", project: "Project", global: "Global", untitled: "New workflow", tools: "API reference", useSample: "Load example" });
  Object.assign(zh, { mainTitle: "\u5DE5\u4F5C\u6D41", timeline: "\u9636\u6BB5\u8FDB\u5EA6", stages: "\u9636\u6BB5", actors: "\u5B50\u4EE3\u7406", tasks: "\u4EFB\u52A1", tokens: "Tokens", artifacts: "\u4EA7\u7269", authoring: "\u7F16\u8F91\u4E0E\u8FD0\u884C", stepProgress: "\u5DF2\u5B8C\u6210/\u5DF2\u521B\u5EFA\u6B65\u9AA4", invalidResource: "\u5DE5\u4F5C\u6D41\u9875\u7B7E\u5730\u5740\u65E0\u6548\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u4F1A\u8BDD" });
  Object.assign(en, { mainTitle: "Workflows", timeline: "Phase timeline", stages: "stages", actors: "actors", tasks: "tasks", tokens: "tokens", artifacts: "Artifacts", authoring: "Edit and run", stepProgress: "completed/created steps", invalidResource: "Invalid workflow resource or parent session mismatch" });
  Object.assign(zh, { structuralSource: "\u8F93\u5165", structuralSink: "\u8F93\u51FA", structuralJoin: "\u6C47\u5408", structuralFanOut: "\u5206\u53D1", structuralMark: "\u9636\u6BB5", structuralEntry: "\u5165\u53E3", structuralAbort: "\u4E2D\u6B62", structuralTest: "\u5224\u65AD", structuralNode: "\u7ED3\u6784", selectWorkflow: "\u9009\u62E9\u8FD0\u884C\u6216\u5DF2\u4FDD\u5B58\u6D41\u7A0B", newWorkflow: "\u65B0\u5EFA\u5DE5\u4F5C\u6D41", editScript: "\u7F16\u8F91\u811A\u672C", hideEditor: "\u6536\u8D77\u811A\u672C", saveScope: "\u4FDD\u5B58\u4F4D\u7F6E", graphKind: "\u6D41\u7A0B\u56FE\u7C7B\u578B", zoom: "\u753B\u5E03\u7F29\u653E", zoomOutShort: "\u7F29\u5C0F", zoomInShort: "\u653E\u5927", actualSize: "\u539F\u59CB\u5927\u5C0F", canvasHint: "\u9009\u62E9\u8282\u70B9\u67E5\u770B\u8BE6\u60C5\uFF1B\u4F7F\u7528\u6EDA\u52A8\u6761\u6D4F\u89C8\u753B\u5E03", emptyGraphTitle: "\u6D41\u7A0B\u5C06\u5448\u73B0\u5728\u8FD9\u91CC", noInstruction: "\u5C1A\u65E0\u5DF2\u4FDD\u7559\u7684\u4EFB\u52A1\u6307\u4EE4", nodes: "\u8282\u70B9", connections: "\u8FDE\u63A5", backToGraph: "\u8FD4\u56DE\u6D41\u7A0B\u56FE" });
  Object.assign(en, { structuralSource: "Input", structuralSink: "Output", structuralJoin: "Join", structuralFanOut: "Fan out", structuralMark: "Phase", structuralEntry: "Entry", structuralAbort: "Abort", structuralTest: "Condition", structuralNode: "Structure", selectWorkflow: "Select a run or saved workflow", newWorkflow: "New workflow", editScript: "Edit script", hideEditor: "Hide script", saveScope: "Save location", graphKind: "Graph type", zoom: "Canvas zoom", zoomOutShort: "Zoom out", zoomInShort: "Zoom in", actualSize: "Actual size", canvasHint: "Select a node to inspect; scroll to explore the canvas", emptyGraphTitle: "Your workflow appears here", noInstruction: "No retained task instruction yet", nodes: "nodes", connections: "connections", backToGraph: "Back to graph" });
  Object.assign(zh, { "fusionOpen": "Fusion \u534F\u4F5C", "fusionTitle": "Fusion \u591A\u6A21\u578B\u534F\u4F5C", "fusionIntro": "Lead \u89C4\u5212\u3001Sidekick \u5B9E\u73B0\u3001Reviewer \u72EC\u7ACB\u590D\u6838\uFF0C\u81EA\u52A8\u8FD0\u884C\u6307\u5B9A\u6D4B\u8BD5\u3002\u5148\u751F\u6210\u8349\u7A3F\u5E76\u68C0\u67E5\u6D41\u7A0B\uFF0C\u518D\u786E\u8BA4\u6267\u884C\u3002", "fusionRoles": "Agent \u5206\u5DE5", "fusionRoleLead": "\u89C4\u5212\u3001\u62C6\u89E3\u3001\u6700\u7EC8\u7B7E\u6536", "fusionRoleSidekick": "\u5B9E\u73B0\u3001\u6D4B\u8BD5\u5931\u8D25\u540E\u4FEE\u590D", "fusionRoleReviewer": "\u53EA\u8BFB\u5BA1\u67E5\u3001\u63D0\u51FA\u963B\u65AD\u95EE\u9898", "fusionTask": "\u5F00\u53D1\u6216\u4FEE\u590D\u4EFB\u52A1", "fusionTaskPlaceholder": "\u4F8B\u5982\uFF1A\u4FEE\u590D\u8BA2\u5355\u91CD\u91CF\u8BA1\u7B97\u9519\u8BEF\uFF0C\u6DFB\u52A0\u56DE\u5F52\u6D4B\u8BD5\uFF0C\u786E\u4FDD\u73B0\u6709\u63A5\u53E3\u4E0D\u53D8\u3002", "fusionNamePlaceholder": "\u53EF\u9009\uFF0C\u9ED8\u8BA4 Fusion \xB7 \u534F\u4F5C\u4FEE\u590D", "fusionInheritModel": "\u7EE7\u627F\u4F1A\u8BDD\u6A21\u578B", "fusionModelLead": "Lead \u6A21\u578B", "fusionModelSidekick": "Sidekick \u6A21\u578B", "fusionModelReviewer": "Reviewer \u6A21\u578B", "fusionTest": "\u6D4B\u8BD5\u811A\u672C\uFF08pnpm run\uFF09", "fusionRounds": "\u6700\u5927\u5BA1\u67E5\u8F6E\u6B21", "fusionSafety": "\u521B\u5EFA\u6D41\u7A0B\u4E0D\u4F1A\u542F\u52A8\u6A21\u578B\u3002\u9996\u6B21\u6267\u884C\u524D\u5FC5\u987B\u5728\u5DE5\u4F5C\u6D41\u9762\u677F\u786E\u8BA4\u3002\u6D4B\u8BD5\u811A\u672C\u5728\u5F53\u524D\u5DE5\u4F5C\u533A\u8FD0\u884C\uFF0C\u53EF\u80FD\u6709\u526F\u4F5C\u7528\uFF1B\u8BF7\u68C0\u67E5\u6743\u9650\u548C\u811A\u672C\u3002", "fusionCreateDraft": "\u751F\u6210\u8349\u7A3F\u5E76\u67E5\u770B\u6D41\u7A0B", "fusionTestPass": "\u901A\u8FC7", "fusionTestFail": "\u5931\u8D25", "fusionReview": "\u72EC\u7ACB\u5BA1\u67E5", "fusionReviewPass": "\u901A\u8FC7", "fusionReviewFail": "\u672A\u901A\u8FC7", "fusionSignoff": "\u6700\u7EC8\u9A8C\u6536", "fusionSignoffPass": "\u901A\u8FC7", "fusionSignoffFail": "\u672A\u901A\u8FC7", "fusionNotYet": "\u5C1A\u65E0\u8BC1\u636E", "fusionBlockingIssues": "\u963B\u65AD\u95EE\u9898", "fusionInspect": "\u67E5\u770B\u8282\u70B9\u548C\u65E5\u5FD7" });
  Object.assign(en, { "fusionOpen": "Fusion", "fusionTitle": "Fusion multi-agent workflow", "fusionIntro": "Lead plans, Sidekick implements, and Reviewer independently inspects the patch. A real test script is run before acceptance. Prepare a draft before confirming execution.", "fusionRoles": "Agent roles", "fusionRoleLead": "Plan, split work, final signoff", "fusionRoleSidekick": "Implement and fix failed tests", "fusionRoleReviewer": "Read-only review, blocking findings", "fusionTask": "Engineering task", "fusionTaskPlaceholder": "Example: Fix an order weight calculation bug and add regression tests without changing existing APIs.", "fusionNamePlaceholder": "Optional: Fusion \xB7 collaborative repair", "fusionInheritModel": "Inherit session model", "fusionModelLead": "Lead model", "fusionModelSidekick": "Sidekick model", "fusionModelReviewer": "Reviewer model", "fusionTest": "Test script (pnpm run)", "fusionRounds": "Maximum review rounds", "fusionSafety": "Creating a workflow does not start an agent. First launch requires your confirmation in the workflow panel. Inspect the test script and permissions before running.", "fusionCreateDraft": "Prepare draft and inspect graph", "fusionTestPass": "Passed", "fusionTestFail": "Failed", "fusionReview": "Independent review", "fusionReviewPass": "Passed", "fusionReviewFail": "Not approved", "fusionSignoff": "Final acceptance", "fusionSignoffPass": "Passed", "fusionSignoffFail": "Not approved", "fusionNotYet": "No evidence yet", "fusionBlockingIssues": "Blocking issues", "fusionInspect": "Inspect nodes and logs" });
  Object.assign(zh, { fusionTestHint: "\u9ED8\u8BA4\u6267\u884C pnpm run selfcheck\uFF1B\u5982\u679C\u5F53\u524D\u9879\u76EE\u6CA1\u6709 selfcheck \u811A\u672C\uFF0C\u8BF7\u4FEE\u6539\u4E3A package.json \u4E2D\u5B9E\u9645\u5B58\u5728\u7684\u811A\u672C\u3002" });
  Object.assign(en, { fusionTestHint: "Default: pnpm run selfcheck. Choose a script defined in the current project package.json before launch." });
  Object.assign(zh, { "fusionTerminalTitle": "\u878D\u5408\u534F\u4F5C \xB7 \u5B9E\u65F6\u62D3\u6251", "fusionTerminalOversight": "\u51B3\u7B56\u4E0E\u76D1\u7763", "fusionTerminalDecision": "\u51B3\u7B56\u5C42", "fusionTerminalSignoff": "\u6700\u7EC8\u7B7E\u6536", "fusionTerminalNotAdvisor": "\u6B64\u5904\u663E\u793A\u771F\u5B9E Lead \u72B6\u6001\uFF1B\u6309\u9700\u987E\u95EE\u5C1A\u672A\u63A5\u5165", "fusionTerminalUnknown": "\u5C1A\u65E0\u6A21\u578B\u8BB0\u5F55", "fusionTerminalExecution": "\u4E3B\u6267\u884C\u94FE", "fusionTerminalBuild": "\u4EE3\u7801\u5B9E\u73B0", "fusionTerminalGate": "\u786E\u5B9A\u6027\u6D4B\u8BD5\u95E8\u7981", "fusionTerminalParallel": "\u8BA1\u5212 / \u9A8C\u8BC1 / \u5BA1\u67E5", "fusionTerminalPlan": "\u89C4\u5212", "fusionTerminalTest": "\u6D4B\u8BD5", "fusionTerminalReview": "\u5BA1\u67E5", "fusionTerminalReturn": "\u8FD4\u56DE Lead \xB7 \u68C0\u67E5\u548C\u7B7E\u6536", "fusionTerminalLogs": "\u5B9E\u65F6\u6267\u884C\u4E8B\u4EF6", "fusionTerminalNoLogs": "\u5C1A\u65E0\u6267\u884C\u4E8B\u4EF6", "fusionTerminalEvidence": "\u53EA\u663E\u793A\u5B9E\u9645\u5DE5\u4F5C\u6D41\u4E8B\u4EF6\u3001Token \u548C\u6D4B\u8BD5\u8BC1\u636E\uFF1B\u8FDE\u63A5\u52A8\u753B\u4EC5\u5728\u8FD0\u884C\u65F6\u51FA\u73B0", "fusionTerminalView": "\u5B9E\u65F6\u62D3\u6251", "fusionTerminalGraph": "\u5B8C\u6574\u4F9D\u8D56\u56FE" });
  Object.assign(en, { "fusionTerminalTitle": "Fusion / live topology", "fusionTerminalOversight": "Decision & oversight", "fusionTerminalDecision": "Decision", "fusionTerminalSignoff": "Final sign-off", "fusionTerminalNotAdvisor": "Real Lead status only; no on-demand Advisor integration yet", "fusionTerminalUnknown": "Not observed", "fusionTerminalExecution": "Primary execution", "fusionTerminalBuild": "Implementation", "fusionTerminalGate": "Deterministic test gate", "fusionTerminalParallel": "Plan / test / review", "fusionTerminalPlan": "Plan", "fusionTerminalTest": "Test", "fusionTerminalReview": "Review", "fusionTerminalReturn": "Back to Lead \xB7 verification", "fusionTerminalLogs": "Live events", "fusionTerminalNoLogs": "No workflow events yet", "fusionTerminalEvidence": "Only real workflow events, tokens and test evidence are shown; lines animate only while running", "fusionTerminalView": "Live topology", "fusionTerminalGraph": "Full dependency graph" });
  var css = `
.caw-center,.caw-dock { box-sizing:border-box;height:100%;min-width:0;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);container-type:inline-size }
.caw-center { padding:20px clamp(12px,2vw,24px) 24px }
.caw-panel { height:100%;min-height:0;min-width:0;display:flex;flex-direction:column;font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary) }
.caw-panel * { box-sizing:border-box }
.caw-sticky { position:sticky;top:0;z-index:2;flex:none;background:var(--dsw-alias-bg-base) }
.caw-top { display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding-bottom:10px }
.caw-selection { display:flex;align-items:center;gap:8px;min-width:0;flex:1 }
.caw-selection select { width:100%;max-width:360px;font-weight:600 }
.caw-selection>.caw-meta { flex:none;white-space:nowrap }
.caw-header-actions { display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-left:auto }
.caw-run-heading { display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0 }
.caw-run-heading h2 { margin:0;font-size:18px;line-height:1.4;font-weight:650;overflow-wrap:anywhere }
.caw-run-context { display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:0 0 12px }
.caw-run-id,.caw-task-site { color:var(--dsw-alias-label-secondary);font:11px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere }
.caw-meta,.caw-note { color:var(--dsw-alias-label-secondary);font-size:12px }
.caw-note { margin:0;max-width:75ch }
.caw-summary-metrics { display:flex;gap:16px;flex-wrap:wrap;color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums }
.caw-summary-metrics strong { color:var(--dsw-alias-label-primary);font-weight:600 }
.caw-row { display:flex;align-items:center;gap:8px;flex-wrap:wrap }
.caw-row label { flex:1;min-width:140px }
.caw-btn { display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;padding:6px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;font-size:12px;line-height:1.5;white-space:nowrap }
.caw-btn:hover:not(:disabled) { background:var(--dsw-alias-bg-layer-2) }
.caw-btn:active:not(:disabled) { border-color:var(--dsw-alias-brand-primary) }
.caw-btn:disabled { opacity:.45;cursor:not-allowed }
.caw-btn.primary { background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);border-color:var(--dsw-alias-brand-primary) }
.caw-btn.primary:hover:not(:disabled) { background:color-mix(in srgb,var(--dsw-alias-brand-primary) 88%,var(--dsw-alias-label-primary)) }
.caw-panel input,.caw-panel select,.caw-panel textarea { min-width:0;max-width:100%;min-height:34px;padding:7px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;caret-color:var(--dsw-alias-brand-primary) }
.caw-panel select { cursor:pointer }
.caw-panel textarea { resize:vertical;font:12px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace;tab-size:2 }
.caw-panel :focus-visible { outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px }
.caw-panel ::selection { background:color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent) }
.caw-panel a { color:var(--dsw-alias-brand-primary);text-underline-offset:3px }
.caw-body { display:flex;flex-direction:column;min-width:0;min-height:0;flex:1;overflow:auto;overscroll-behavior:contain;scrollbar-color:var(--dsw-alias-border-l2) transparent }
.caw-main { display:flex;flex-direction:column;min-width:0;min-height:300px;flex:1 }
.caw-tabs { display:flex;align-items:center;gap:4px;flex-wrap:wrap;border-bottom:1px solid var(--dsw-alias-border-l1);padding:0 0 10px }
.caw-tabs .caw-btn { border-color:transparent;background:transparent;padding-inline:14px }
.caw-tabs .caw-btn[aria-pressed=true] { color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-base)) }
.caw-content { display:flex;flex-direction:column;min-width:0;min-height:0;flex:1;padding-top:12px }
.caw-content>* { flex-shrink:0 }
.caw-graph-shell { display:flex;flex-direction:column;flex:1;min-height:280px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-1) }
.caw-graph-toolbar { flex:none;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base) }
.caw-graph-kinds { display:flex;gap:3px;flex-wrap:wrap }
.caw-graph-kinds .caw-btn { background:transparent;border-color:transparent;min-height:30px;padding:4px 9px;font-size:11px }
.caw-graph-kinds .caw-btn[aria-pressed=true] { background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1);font-weight:600 }
.caw-zoom { display:flex;align-items:center;gap:6px;font-variant-numeric:tabular-nums }
.caw-zoom .caw-btn { padding:4px 8px;min-height:28px;font-size:11px }
.caw-zoom output { min-width:36px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:11px }
.caw-graph { display:flex;position:relative;overflow:auto;min-width:0;min-height:160px;flex:1;overscroll-behavior:contain;scrollbar-gutter:stable;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 3%,var(--dsw-alias-bg-layer-1));scrollbar-color:var(--dsw-alias-border-l2) transparent }
.caw-graph svg { display:block;flex:none;margin:auto }
.caw-phase-band { fill:color-mix(in srgb,var(--dsw-alias-bg-base) 65%,transparent);stroke:var(--dsw-alias-border-l1);stroke-width:1 }
.caw-edge { stroke:var(--dsw-alias-label-secondary);stroke-width:1.2;opacity:.55 }
.caw-edge[data-source=true] { stroke-width:1;opacity:.25 }
.caw-structural .caw-node-outline { fill:var(--dsw-alias-bg-layer-1);stroke:var(--dsw-alias-border-l1) }
.caw-structural-label { fill:var(--dsw-alias-label-secondary);font-size:11px;pointer-events:none }
.caw-svg-node { cursor:pointer;outline:none }
.caw-node-outline { fill:var(--dsw-alias-bg-base);stroke:var(--dsw-alias-border-l2);stroke-width:1 }
.caw-svg-node:hover .caw-node-outline { stroke:var(--dsw-alias-brand-primary) }
.caw-svg-node:focus-visible .caw-node-outline { stroke:var(--dsw-alias-brand-primary);stroke-width:3 }
.caw-svg-node[data-state=running] .caw-node-outline { stroke:var(--dsw-alias-brand-primary);stroke-width:1.5 }
.caw-svg-node[data-state=failed] .caw-node-outline { stroke:var(--dsw-alias-state-error-primary) }
.caw-graph-card { display:flex;flex-direction:column;gap:8px;height:100%;padding:12px 14px;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:1.4;pointer-events:none }
.caw-node-badge { flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;font-size:10px;font-weight:650;color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,currentColor 12%,var(--dsw-alias-bg-base));border:1px solid color-mix(in srgb,currentColor 24%,transparent) }
.caw-node-badge[data-color="1"] { color:var(--dsw-alias-state-success-primary) }
.caw-node-badge[data-color="2"] { color:var(--dsw-alias-label-secondary) }
.caw-node-head { display:flex;align-items:center;gap:8px;min-width:0 }
.caw-node-label { flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600 }
.caw-node-head .caw-state { flex:none;font-size:10px }
.caw-node-instruction { height:32px;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;overflow-wrap:anywhere }
.caw-node-source { overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font:10px/14px ui-monospace,SFMono-Regular,Consolas,monospace }
.caw-graph-footer { flex:none;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:9px 14px;border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font-size:11px }
.caw-empty { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:300px;padding:32px;text-align:center;color:var(--dsw-alias-label-secondary) }
.caw-empty h3 { margin:0;color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600 }
.caw-skeleton { width:min(420px,85%);height:14px;border-radius:4px;background:var(--dsw-alias-bg-layer-2) }
.caw-skeleton:nth-child(2) { width:min(280px,65%) }
.caw-editor { flex:none;margin:0 0 18px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden }
.caw-editor-title { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid var(--dsw-alias-border-l1) }
.caw-editor-title h3 { margin:0;font-size:15px;font-weight:600 }
.caw-editor-fields { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 20px;padding:18px }
.caw-editor-fields>label:first-child,.caw-editor-fields>.caw-script,.caw-editor-fields>details,.caw-editor-fields>.caw-row { grid-column:1 / -1 }
.caw-editor label { display:flex;flex-direction:column;gap:6px;color:var(--dsw-alias-label-secondary);font-size:12px }
.caw-script { min-width:0 }
.caw-script textarea { min-height:300px;flex:1;resize:vertical;background:var(--dsw-alias-bg-base) }
.caw-editor-actions { display:flex;flex-direction:column;gap:10px;padding:14px 18px;border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base) }
.caw-editor-actions .caw-row { justify-content:space-between }
.caw-state { font-size:11px;display:inline-flex;gap:5px;align-items:center;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums }
.caw-state[data-state=running] { color:var(--dsw-alias-brand-primary) }
.caw-state[data-state=completed] { color:var(--dsw-alias-state-success-primary) }
.caw-state[data-state=failed],.caw-state[data-state=errored],.caw-error { color:var(--dsw-alias-state-error-primary) }
.caw-error { margin:0 0 14px;padding:12px 16px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow-wrap:anywhere;display:flex;align-items:center;gap:12px;flex-wrap:wrap }
.caw-section { margin-top:24px;min-width:0 }
.caw-section:first-child { margin-top:0 }
.caw-section h3,.caw-content>h3 { margin:0 0 12px;font-size:15px;font-weight:600 }
.caw-code { margin:10px 0;background:var(--dsw-alias-bg-layer-1);padding:14px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:380px;overflow:auto;font:12px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace }
.caw-log { padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l1);font-size:12px;overflow-wrap:anywhere }
.caw-log time { color:var(--dsw-alias-label-secondary);margin-right:12px;font-variant-numeric:tabular-nums }
.caw-panel summary { cursor:pointer;padding:6px 0;color:var(--dsw-alias-label-secondary);font-size:12px }
.caw-panel table { border-collapse:collapse;width:100%;font-size:12px }
.caw-panel th,.caw-panel td { padding:9px 12px;text-align:left;border-bottom:1px solid var(--dsw-alias-border-l1);vertical-align:top;overflow-wrap:anywhere }
.caw-metrics { display:flex;gap:24px;flex-wrap:wrap }
.caw-metrics strong { display:block;font-size:22px;font-variant-numeric:tabular-nums }
.caw-board { display:flex;gap:12px;overflow:auto }
.caw-board>section { flex:1;min-width:150px;background:var(--dsw-alias-bg-layer-1);padding:12px;border-radius:8px }
.caw-timeline { display:flex;flex-direction:column;gap:20px }
.caw-phase { border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden }
.caw-phase>summary { display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:14px 16px;background:var(--dsw-alias-bg-layer-1);list-style:revert }
.caw-phase>summary strong { color:var(--dsw-alias-label-primary);font-size:13px }
.caw-phase>summary .caw-meta { margin-left:auto;font-variant-numeric:tabular-nums }
.caw-task { display:flex;flex-direction:column;gap:8px;width:100%;text-align:left;padding:14px 16px;border:0;border-top:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;overflow-wrap:anywhere }
.caw-task:hover { background:var(--dsw-alias-bg-layer-1) }
.caw-task-head { display:flex;align-items:center;gap:10px;flex-wrap:wrap }
.caw-task-head>.caw-state { margin-left:auto }
.caw-task-instruction { color:var(--dsw-alias-label-secondary);font-size:12px;max-width:75ch }
.caw-intervention { padding:16px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);margin-bottom:16px }
.caw-intervention textarea { width:100%;margin:10px 0 }
.caw-detail-heading { display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px }
.caw-detail-heading h3 { margin:0;font-size:15px }
@container(max-width:720px) { .caw-editor-fields { grid-template-columns:minmax(0,1fr) }.caw-header-actions { width:100%;margin-left:0;gap:6px }.caw-selection { flex-basis:100% }.caw-selection select { max-width:none }.caw-run-context { align-items:flex-start }.caw-graph-toolbar { align-items:flex-start }.caw-graph-kinds,.caw-zoom { width:100%;flex-wrap:wrap }.caw-summary-metrics { gap:6px 12px }.caw-run-heading h2 { font-size:15px }.caw-script textarea { min-height:240px } }

.caw-fusion { margin-bottom:16px }
.caw-fusion-roles { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:14px 18px 0 }
.caw-fusion-role { display:flex;flex-direction:column;gap:4px;min-width:0;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base) }
.caw-fusion-role strong { font-weight:650;font-size:12px }
.caw-fusion-role span { font-size:11px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere }
.caw-fusion-fields>label:first-child { grid-column:1 / -1 }
.caw-fusion-fields textarea { width:100%;resize:vertical;min-height:96px;background:var(--dsw-alias-bg-base) }
.caw-fusion .caw-editor-title p { margin-top:5px }
.caw-fusion-summary { padding:12px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:10px;margin-bottom:14px }
.caw-fusion-summary-header { display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap }
.caw-fusion-summary-task { margin:0;white-space:pre-wrap;overflow-wrap:anywhere;max-height:110px;overflow:auto }
.caw-fusion-checks { display:flex;gap:10px;flex-wrap:wrap;color:var(--dsw-alias-label-secondary);font-size:12px }
.caw-fusion-checks>span { border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);border-radius:7px;padding:6px 10px }
.caw-fusion-blockers { border-left:3px solid var(--dsw-alias-state-error-primary);padding-left:12px }
.caw-fusion-blockers ul { margin:5px 0 0;padding-left:20px }
@container(max-width:720px) { .caw-fusion-roles { grid-template-columns:minmax(0,1fr) } }
@media(prefers-reduced-motion:reduce) { .caw-panel * { scroll-behavior:auto;transition:none;animation:none } }
.caw-card .caw-btn,.caw-tool .caw-btn { display:inline-block;min-height:0;padding:6px 10px;border-radius:6px;font:inherit }
.caw-card .caw-error,.caw-tool .caw-error { margin:0;padding:10px 16px;border:0;border-radius:0;display:block }
.caw-card { border:1px solid var(--dsw-alias-border-l2);border-radius:10px;overflow:hidden;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);max-width:100%;margin:8px 0;font:inherit }.caw-card-summary { display:block;width:100%;padding:14px 16px;text-align:left;background:transparent;color:inherit;border:0;font:inherit }.caw-card-meta { display:block }.caw-card-summary strong { overflow-wrap:anywhere;min-width:0 }.caw-card footer .caw-btn { white-space:normal;overflow-wrap:anywhere;text-align:left }.caw-phase-progress { display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap;overflow-wrap:anywhere }.caw-dot { flex:none }.caw-chip { display:inline-flex;flex-direction:column;align-items:center;gap:6px;max-width:120px;min-width:0;text-align:center }.caw-chip>span:last-child { min-width:0;overflow-wrap:anywhere }.caw-avatar { flex:none;display:inline-flex;align-items:center;justify-content:center;width:23px;height:23px;border-radius:5px;background:color-mix(in srgb,currentColor 13%,var(--dsw-alias-bg-base));font-weight:650;border:1px solid color-mix(in srgb,currentColor 30%,transparent) }.caw-card .caw-meta { margin-top:7px }.caw-card footer { display:flex;justify-content:space-between;padding:8px 12px;border-top:1px solid var(--dsw-alias-border-l1) }.caw-card :focus-visible,.caw-tool :focus-visible { outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-3px }.caw-phase-dots { display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:12px 0 }.caw-dot { width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-border-l2) }.caw-dot[data-state=running] { background:var(--dsw-alias-brand-primary) }.caw-dot[data-state=completed] { background:var(--dsw-alias-state-success-primary) }.caw-dot[data-state=failed] { background:var(--dsw-alias-state-error-primary) }.caw-dot[data-state=waiting] { background:var(--dsw-alias-label-secondary) }.caw-chips { display:flex;gap:5px;flex-wrap:wrap }.caw-chip { padding:2px 7px;border-radius:5px;font-size:11px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);overflow-wrap:anywhere }.caw-chip[data-color="0"] { color:var(--dsw-alias-brand-primary) }.caw-chip[data-color="1"] { color:var(--dsw-alias-state-success-primary) }.caw-chip[data-color="2"] { color:var(--dsw-alias-label-secondary) }

`;
  function installWorkflowUI(ctx, React) {
    const h = React.createElement;
    const { useState, useEffect, useLayoutEffect, useRef } = React;
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dynamic-workflow: dictionaries");
    const t = ctx.locale.bind(NS);
    const feeds = /* @__PURE__ */ new Map();
    const mainSelections = /* @__PURE__ */ new Map();
    const editorStates = /* @__PURE__ */ new Map();
    function useFeed(sessionId, runId) {
      const [, redraw] = useState(0);
      let feed = feeds.get(sessionId);
      if (!feed) {
        feed = { collection: { runs: [], workflows: [] }, runs: /* @__PURE__ */ new Map(), listeners: /* @__PURE__ */ new Map(), queue: /* @__PURE__ */ new Set(), live: false, error: "", pending: null };
        feeds.set(sessionId, feed);
      }
      const publish = () => {
        for (const listener of feed.listeners.keys()) listener();
      };
      const drain = () => {
        if (feed.pending) return feed.pending;
        if (!feed.listeners.size || !feed.collectionDirty && !feed.queue.size) return Promise.resolve();
        const signal = feed.abort?.signal;
        feed.pending = (async () => {
          try {
            while (feed.listeners.size && !signal?.aborted && (feed.collectionDirty || feed.queue.size)) {
              if (feed.collectionDirty) {
                feed.collectionDirty = false;
                feed.collection = await api(sessionId, void 0, signal);
                feed.collectionLoaded = true;
              }
              const id = feed.queue.values().next().value;
              if (id !== void 0) {
                feed.queue.delete(id);
                if ([...feed.listeners.values()].includes(id)) {
                  const response = await fetch(`${API}/state?sessionId=${encodeURIComponent(sessionId)}&id=${encodeURIComponent(id)}`, { credentials: "same-origin", signal });
                  const body = await response.json();
                  if (!response.ok || !body.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
                  feed.runs.set(id, body.value);
                }
              }
              feed.error = "";
              publish();
            }
          } catch (err) {
            if (err.name !== "AbortError") feed.error = err.message;
          } finally {
            feed.pending = null;
            publish();
            if (signal?.aborted && feed.listeners.size) void drain();
          }
        })();
        return feed.pending;
      };
      const refresh = (id) => {
        feed.collectionDirty = true;
        for (const watched of new Set(feed.listeners.values())) if (watched && (id === void 0 || id === watched)) feed.queue.add(watched);
        return drain();
      };
      useEffect(() => {
        const update = () => redraw((value) => value + 1);
        feeds.set(sessionId, feed);
        feed.listeners.set(update, runId);
        if (!feed.stream) {
          feed.abort = new AbortController();
          const stream = feed.stream = new EventSource(`${API}/events?sessionId=${encodeURIComponent(sessionId)}`, { withCredentials: true });
          stream.onopen = () => {
            feed.live = true;
            publish();
            void refresh();
          };
          stream.onerror = () => {
            feed.live = false;
            publish();
          };
          stream.onmessage = (message) => {
            let event;
            try {
              event = JSON.parse(message.data);
            } catch {
              return;
            }
            if (typeof event.runId !== "string") return;
            feed.changed ??= /* @__PURE__ */ new Set();
            feed.changed.add(event.runId);
            if (!feed.timer) feed.timer = setTimeout(() => {
              feed.timer = null;
              feed.collectionDirty = true;
              for (const id of feed.changed) if ([...feed.listeners.values()].includes(id)) feed.queue.add(id);
              feed.changed.clear();
              void drain();
            }, 120);
          };
        }
        if (!runId || !feed.runs.has(runId)) void refresh(runId);
        return () => {
          feed.listeners.delete(update);
          if (!feed.listeners.size) {
            clearTimeout(feed.timer);
            feed.timer = null;
            feed.stream.close();
            feed.stream = null;
            feed.abort.abort();
            feeds.delete(sessionId);
          }
        };
      }, [sessionId, runId]);
      return { ...feed, refresh: () => refresh(runId) };
    }
    async function api(sessionId, input, signal) {
      const result = input === void 0 ? await fetch(`${API}/state?sessionId=${encodeURIComponent(sessionId)}`, { credentials: "same-origin", signal }) : await fetch(`${API}/action`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, sessionId }), signal });
      const body = await result.json();
      if (!result.ok || body.ok !== true) throw new Error(body.error ?? `HTTP ${result.status}`);
      return body.value;
    }
    const code = (value) => h("pre", { className: "caw-code" }, typeof value === "string" ? value : JSON.stringify(value, null, 2));
    const button = (label, onClick, disabled = false, primary = false, extra = {}) => h("button", { type: "button", className: `caw-btn${primary ? " primary" : ""}`, onClick, disabled, ...extra }, label);
    const { FusionComposer, FusionSummary } = createFusionView(React, { t, button });
    const { FusionTerminal } = createFusionTerminalView(React, { t, button });
    const state = (status) => h("span", { className: "caw-state", "data-state": status }, t(status ?? "unknown"));
    function FlowGraph({ analysis, kind, setKind, run, onNode }) {
      const [zoom, setZoom] = useState(1);
      const markerId = React.useId();
      const [availableWidth, setAvailableWidth] = useState(void 0);
      const model2 = graphModel(analysis, kind, availableWidth);
      const graphRef = useRef(null);
      const fit = () => setZoom(Math.min(1, Math.max(0.25, ((graphRef.current?.clientWidth ?? model2.width) - 2) / model2.width)));
      useLayoutEffect(() => {
        const element = graphRef.current;
        if (!element) return;
        const measure = () => {
          const width = element.clientWidth;
          if (width > 0) setAvailableWidth((previous) => previous === width ? previous : width);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
      }, []);
      useLayoutEffect(() => {
        setZoom(1);
      }, [availableWidth]);
      useLayoutEffect(() => {
        setZoom(1);
        if (graphRef.current) {
          graphRef.current.scrollTop = 0;
          graphRef.current.scrollLeft = 0;
        }
      }, [analysis, kind]);
      const sourceIds = new Set(model2.nodes.filter((node) => node.kind === "source" || node.id === "entry").map((node) => node.id));
      const tasks = phaseModel(run ?? { analysis }).flatMap((phase) => phase.tasks);
      const instructions = new Map(tasks.map((task) => [task.source ?? task.id, task.instruction]));
      return h(
        "section",
        { className: "caw-graph-shell", "aria-label": t("overview") },
        h(
          "div",
          { className: "caw-graph-toolbar" },
          h("div", { className: "caw-graph-kinds", role: "group", "aria-label": t("graphKind") }, ["graph", "causality", "flow", "handoff"].map((value) => button(t(value), () => setKind(value), false, false, { "aria-pressed": kind === value }))),
          h(
            "div",
            { className: "caw-zoom", role: "group", "aria-label": t("zoom") },
            button(t("zoomOutShort"), () => setZoom((value) => Math.max(0.25, value - 0.15)), zoom <= 0.25, false, { "aria-label": t("zoomOut") }),
            h("output", { "aria-label": t("zoom") }, `${Math.round(zoom * 100)}%`),
            button(t("zoomInShort"), () => setZoom((value) => Math.min(2, value + 0.15)), zoom >= 2, false, { "aria-label": t("zoomIn") }),
            button(t("fit"), fit),
            button("100%", () => setZoom(1), false, false, { "aria-label": t("actualSize") })
          )
        ),
        h(
          "div",
          { className: "caw-graph", ref: graphRef, "data-workflow-graph": kind, tabIndex: 0, "aria-label": t("canvasHint") },
          !model2.nodes.length ? h("div", { className: "caw-empty" }, h("h3", null, t("emptyGraphTitle")), h("p", { className: "caw-note" }, t("emptyGraph"))) : h(
            "svg",
            { width: model2.width * zoom, height: model2.height * zoom, viewBox: `0 0 ${model2.width} ${model2.height}`, role: "group", "aria-label": t(kind) },
            h("defs", null, h("marker", { id: markerId, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }, h("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "var(--dsw-alias-label-secondary)" }))),
            (model2.groups ?? []).map((group) => h(
              "g",
              { key: group.id, role: "group", "aria-label": group.label },
              h("rect", { className: "caw-phase-band", x: group.x, y: group.y, width: group.width, height: group.height, rx: 12 }),
              h("text", { x: group.x + 20, y: group.y + 28, fill: "var(--dsw-alias-label-primary)", fontSize: 13, fontWeight: 600 }, group.label),
              h("text", { x: group.x + group.width - 20, y: group.y + 28, textAnchor: "end", fill: "var(--dsw-alias-label-secondary)", fontSize: 11 }, `${group.taskCount} ${t("tasks")}`)
            )),
            model2.edges.map((edge, i) => {
              const d = graphEdgePoints(model2, edge).map(([x, y], index) => `${index ? "L" : "M"}${x},${y}`).join(" ");
              return h("path", { key: i, className: "caw-edge", "data-source": sourceIds.has(edge.from), d, fill: "none", strokeDasharray: edge.exact === false ? "4 3" : void 0, markerEnd: `url(#${markerId})` }, h("title", null, `${edge.from} \u2192 ${edge.to}`));
            }),
            model2.nodes.map((node) => {
              const sites = node.sites ?? [node.id];
              const source = [.../* @__PURE__ */ new Set([node.id, ...sites])].join(" \xB7 ");
              if (node.structural) {
                const structuralKey = { source: "structuralSource", sink: "structuralSink", join: "structuralJoin", "fan-out": "structuralFanOut", mark: "structuralMark", entry: "structuralEntry", abort: "structuralAbort", test: "structuralTest" }[node.kind ?? node.id] ?? "structuralNode";
                const label2 = t(structuralKey);
                return h(
                  "g",
                  { key: node.id, className: "caw-svg-node caw-structural", role: "button", tabIndex: 0, "aria-label": `${label2} \xB7 ${source}`, onClick: () => onNode(node), onKeyDown: (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onNode(node);
                    }
                  } },
                  h("title", null, `${label2}
${node.label}
${source}`),
                  h("rect", { className: "caw-node-outline", x: node.x, y: node.y, width: node.width, height: node.height, rx: 6 }),
                  h("text", { className: "caw-structural-label", x: node.x + node.width / 2, y: node.y + node.height / 2, textAnchor: "middle", dominantBaseline: "central" }, label2)
                );
              }
              const states = sites.map((id) => nodeState(run?.siteStates ?? run?.nodes, id));
              const status = states.includes("running") ? "running" : states.includes("failed") ? "failed" : states.includes("cancelled") ? "cancelled" : states.includes("stopped") ? "stopped" : states.length && states.every((value) => value === "completed") ? "completed" : "pending";
              const actors = (run?.actors ?? []).filter((actor) => node.actorIds?.includes(actor.siteId));
              const label = actors.length ? [...new Set(actors.map((actor) => actor.name ?? actor.siteId))].join(" \xB7 ") : node.label;
              const badge = node.actorIds?.length ? actorBadge(actors[0] ?? { siteId: node.actorIds[0], name: label }) : null;
              const instruction = sites.map((id) => instructions.get(id)).filter(Boolean).join("\n");
              return h(
                "g",
                { key: node.id, className: "caw-svg-node", "data-state": status, role: "button", tabIndex: 0, "aria-label": `${label} \xB7 ${t(status)} \xB7 ${source}${instruction ? ` \xB7 ${instruction}` : ""}`, onClick: () => onNode(node), onKeyDown: (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onNode(node);
                  }
                } },
                h("title", null, `${label}
${source}
${instruction || node.kind || ""}`),
                h("rect", { className: "caw-node-outline", x: node.x, y: node.y, width: node.width, height: node.height, rx: 10 }),
                h(
                  "foreignObject",
                  { x: node.x, y: node.y, width: node.width, height: node.height },
                  h(
                    "div",
                    { xmlns: "http://www.w3.org/1999/xhtml", className: "caw-graph-card" },
                    h("div", { className: "caw-node-head" }, badge && h("span", { className: "caw-node-badge", "data-color": badge.color }, badge.initial), h("span", { className: "caw-node-label" }, label), state(status)),
                    h("div", { className: "caw-node-instruction" }, instruction || node.kind || t("noInstruction")),
                    h("div", { className: "caw-node-source" }, source)
                  )
                )
              );
            })
          )
        ),
        h("footer", { className: "caw-graph-footer" }, h("span", null, `${model2.nodes.length} ${t("nodes")} \xB7 ${model2.edges.length} ${t("connections")}`), h("span", null, t("canvasHint")))
      );
    }
    const Artifact = createArtifactView(React, { api, t, code, downloadUrl: (sessionId, runId, item) => `${API}/artifact?sessionId=${encodeURIComponent(sessionId)}&id=${encodeURIComponent(runId)}&artifactId=${encodeURIComponent(item.id)}&version=${encodeURIComponent(item.version ?? 1)}` });
    function Metrics({ run }) {
      const progress = siteProgress(run.siteStates);
      return h("div", { className: "caw-summary-metrics" }, [
        [t("actors"), run.actors?.length],
        [t("stepProgress"), `${progress.completed}/${progress.total}`],
        [t("tokens"), run.spentTokens],
        [t("reports"), run.counts?.reports],
        [t("artifacts"), run.counts?.artifacts]
      ].map(([label, value]) => h("span", { key: label }, h("strong", null, value === void 0 ? "\u2014" : value.toLocaleString()), " ", label)));
    }
    function ActorChips({ actors, limit = actors.length }) {
      return h("span", { className: "caw-chips" }, actors.slice(0, limit).map((actor) => {
        const badge = actorBadge(actor);
        return h("span", { key: `${actor.siteId}:${actor.ordinal}`, className: "caw-chip", "data-color": badge.color, title: `${actor.siteId}@${actor.ordinal}` }, h("span", { className: "caw-avatar", "aria-hidden": true }, badge.initial), h("span", null, actor.name ?? `${actor.siteId}@${actor.ordinal}`));
      }), actors.length > limit && h("span", { className: "caw-chip" }, `+${actors.length - limit} ${t("actors")}`));
    }
    function Timeline({ run, onNode }) {
      const phases = phaseModel(run);
      if (!phases.length) return h("p", { className: "caw-note" }, t("emptyGraph"));
      return h("div", { className: "caw-timeline" }, phases.map((phase) => h(
        "details",
        { key: phase.id, className: "caw-phase", open: true },
        h("summary", null, state(phase.status), h("strong", null, phase.name ?? t("other")), h("span", { className: "caw-meta" }, `${phase.completed}/${phase.total} ${t("stepProgress")}`)),
        phase.tasks.map((task) => {
          const actors = (run.actors ?? []).filter((actor) => (task.lanes ?? [task.lane]).includes(actor.siteId));
          return h(
            "button",
            { key: task.id, className: "caw-task", type: "button", onClick: () => onNode({ ...task, sites: [task.source ?? task.id] }) },
            h("span", { className: "caw-task-head" }, actors.length ? h(ActorChips, { actors }) : h("strong", null, task.label ?? task.id), h("code", { className: "caw-task-site" }, task.source ?? task.id), state(nodeState(run.siteStates, task.source ?? task.id))),
            task.instruction && h("span", { className: "caw-task-instruction", title: task.instruction }, task.instruction)
          );
        })
      )));
    }
    function Panel({ sessionId, runId, navigation, onNavigate, main = false }) {
      const navigate = onNavigate;
      const editor = useRef(workflowEditorState(editorStates.get(sessionId), runId, navigation?.params?.saved)).current;
      const cached = editor.draft;
      const firstRevision = useRef(navigation?.revision).current;
      const [selected, setSelected] = useState(runId), [localRun, setRun] = useState(null);
      const feed = useFeed(sessionId, selected);
      const collection = feed.collection;
      const run = feed.runs.get(selected) ?? localRun;
      const mergeRows = (base, extra, key) => [...new Map([...extra ?? [], ...base ?? []].map((row) => [key(row), row])).values()];
      const [script, setScript] = useState(cached?.script ?? SAMPLE), [name, setName] = useState(cached?.name ?? t("untitled"));
      const [argsText, setArgsText] = useState(cached?.argsText ?? "{}"), [concurrency, setConcurrency] = useState(cached?.concurrency ?? 4), [scope, setScope] = useState(cached?.scope ?? "project");
      const [analysis, setAnalysis] = useState(cached?.analysis ?? null), [analyzedScript, setAnalyzedScript] = useState(cached?.analyzedScript ?? "");
      const [tab, setTab] = useState(cached?.tab ?? workflowView(navigation?.params?.view)), [kind, setKind] = useState(cached?.kind ?? "graph"), [picked, setPicked] = useState(cached?.picked ?? null);
      const [error, setError] = useState(""), [busy, setBusy] = useState(false);
      const [editorOpen, setEditorOpen] = useState(cached?.editorOpen ?? !runId);
      const [fusionOpen, setFusionOpen] = useState(cached?.fusionOpen ?? false);
      const [terminalMode, setTerminalMode] = useState(cached?.terminalMode ?? true);
      const [fusionDraft, setFusionDraft] = useState(cached?.fusionDraft);
      const [modelRoute, setModelRoute] = useState(cached?.modelRoute ?? "");
      const [pageMore, setPageMore] = useState({});
      const [additionalNodes, setAdditionalNodes] = useState(null), [additionalEvents, setAdditionalEvents] = useState(null), [additionalReports, setAdditionalReports] = useState(null);
      const [answers, setAnswers] = useState(cached?.answers ?? {}), [apiHelp, setApiHelp] = useState(null);
      const refresh = feed.refresh;
      useEffect(() => {
        if (!cached || navigation?.revision !== firstRevision) setTab(workflowView(navigation?.params?.view));
      }, [navigation?.revision]);
      useEffect(() => {
        const saved = navigation?.params?.saved;
        if (saved && (!cached || navigation?.revision !== firstRevision)) {
          setSelected(null);
          setRun(null);
          setScript(saved.script);
          setName(saved.name);
          setScope(saved.scope);
          setAnalysis(null);
          setPicked(null);
          setEditorOpen(true);
        }
      }, [navigation?.revision]);
      const initialized = useRef(cached?.initialized ?? null);
      const editorSnapshot = useRef(null);
      editorSnapshot.current = { key: editor.key, draft: { script, name, argsText, concurrency, scope, analysis, analyzedScript, tab, kind, picked, modelRoute, answers, editorOpen, fusionOpen, fusionDraft, terminalMode, initialized: initialized.current } };
      useEffect(() => () => {
        editorStates.set(sessionId, editorSnapshot.current);
      }, [sessionId]);
      useEffect(() => {
        if (!run || initialized.current === run.id) return;
        initialized.current = run.id;
        setScript(run.script);
        setName(run.name);
        setAnalysis(run.analysis);
        setAnalyzedScript(run.script);
        if (run.args?.preset === "fusion.v1") setTab((previous) => previous === "timeline" ? "overview" : previous);
        setArgsText(JSON.stringify(run.args ?? {}, null, 2));
        setConcurrency(run.concurrency ?? 4);
        setModelRoute(run.provider ? JSON.stringify({ provider: run.provider, model: run.model }) : "");
      }, [run]);
      const perform = async (input) => {
        setBusy(true);
        setError("");
        try {
          const result = await api(sessionId, input);
          await refresh();
          return result;
        } catch (err) {
          setError(err.message);
          return null;
        } finally {
          setBusy(false);
        }
      };
      const createFusion = async (payload) => {
        const draft = await perform(payload);
        if (draft?.id) {
          setFusionOpen(false);
          setEditorOpen(false);
          navigate(draft.id);
        }
        return draft;
      };
      const choose = (row) => {
        setFusionOpen(false);
        navigate(row.id);
      };
      const getArgs = () => {
        const value = JSON.parse(argsText);
        if (value === null || Array.isArray(value) || typeof value !== "object") throw new Error(t("invalidArgs"));
        return value;
      };
      const launch = async () => {
        try {
          const input = { script, name, args: getArgs(), concurrency: Number(concurrency), ...modelRoute ? JSON.parse(modelRoute) : {} };
          const draft = selected && run?.status === "draft" && run.script === script && run.name === name && run.concurrency === input.concurrency && JSON.stringify(run.args ?? {}) === JSON.stringify(input.args) && run.provider === input.provider && run.model === input.model ? run : await perform({ action: "create", ...input });
          if (!draft) return;
          const result = await perform({ action: "launch", id: draft.id });
          if (result) {
            navigate(result.id);
          }
        } catch (err) {
          setError(err.message);
        }
      };
      const pageCursors = useRef({ nodes: 0, reports: 0, events: -1 });
      useEffect(() => {
        pageCursors.current = { nodes: 0, reports: 0, events: -1 };
        setPageMore({});
        setAdditionalNodes(null);
        setAdditionalEvents(null);
        setAdditionalReports(null);
      }, [selected]);
      const loadAll = async (action, setValue) => {
        setBusy(true);
        setError("");
        try {
          const cursor = pageCursors.current[action];
          const page = await api(sessionId, { action, id: selected, limit: 1e3, ...action === "events" ? { afterSequence: cursor } : { after: cursor } });
          const rows = page[action];
          setPageMore((previous) => ({ ...previous, [action]: action === "events" ? rows.length === 1e3 : page.hasMore }));
          pageCursors.current[action] = action === "events" ? rows.at(-1)?.sequence ?? cursor : page.nextCursor;
          setValue((previous) => {
            const values = new Map((previous ?? (action === "events" ? run?.events : action === "nodes" ? run?.nodes : run?.reports) ?? []).map((row) => [action === "events" ? row.sequence : `${row.instance?.siteId ?? row.siteId}:${row.instance?.ordinal ?? row.ordinal}`, row]));
            for (const row of rows) values.set(action === "events" ? row.sequence : `${row.instance?.siteId ?? row.siteId}:${row.instance?.ordinal ?? row.ordinal}`, row);
            return [...values.values()];
          });
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      };
      const valid = analysis?.ok === true && analyzedScript === script;
      const visibleNodes = mergeRows(run?.nodes, additionalNodes, (row) => `${row.siteId}:${row.ordinal}`);
      const visibleEvents = mergeRows(run?.events, additionalEvents, (row) => row.sequence).sort((a, b) => a.sequence - b.sequence);
      const detailNodes = visibleNodes.filter((node) => picked && (picked.sites ?? [picked.id]).some((id) => node.siteId === id || node.site_id === id || node.id === id));
      const questions = (run?.questions ?? []).filter((question) => question.status === "waiting" && question.live !== false);
      const holds = (run?.holds ?? []).filter((hold) => hold.state !== "pending");
      const currentAnalysis = analyzedScript === script ? analysis : null;
      const running = ["running", "starting"].includes(run?.status);
      const displayId = run?.id ?? selected;
      const runRows = (collection.runs ?? []).some((row) => row.id === selected) || !selected ? collection.runs ?? [] : [{ id: selected, name: run?.name ?? selected, status: run?.status }, ...collection.runs ?? []];
      const savedRows = mergeRows(collection.workflows, navigation?.params?.saved ? [navigation.params.saved] : [], (row) => JSON.stringify([row.scope, row.name]));
      const savedIndex = savedRows.findIndex((row) => row.scope === navigation?.params?.saved?.scope && row.name === navigation?.params?.saved?.name);
      const selectionValue = selected ? `run:${selected}` : savedIndex >= 0 ? `saved:${savedIndex}` : "new";
      const selectWorkflow = (value) => {
        if (value === "new") {
          setEditorOpen(true);
          navigate(null);
          return;
        }
        const row = runRows.find((row2) => `run:${row2.id}` === value);
        if (row) {
          choose(row);
          return;
        }
        const saved = savedRows.find((row2, index) => `saved:${index}` === value);
        if (saved) navigate(null, { saved });
      };
      const inspectNode = (node) => {
        setPicked(node);
        setTab("details");
      };
      const inspectFusion = () => {
        setTab("details");
        setFusionOpen(false);
      };
      return h(
        "div",
        { className: main ? "caw-center" : "caw-dock" },
        h("style", null, css),
        h(
          "section",
          { className: "caw-panel", "aria-label": run?.name ?? t("title"), "data-workflow-panel": "", "aria-busy": busy || Boolean(selected && !run && !feed.error) },
          h(
            "div",
            { className: "caw-sticky" },
            h(
              "header",
              { className: "caw-top" },
              h(
                "div",
                { className: "caw-selection" },
                h(
                  "select",
                  { "aria-label": t("selectWorkflow"), value: selectionValue, disabled: busy, onChange: (event) => selectWorkflow(event.target.value) },
                  h("option", { value: "new" }, t("newWorkflow")),
                  runRows.length > 0 && h("optgroup", { label: t("history") }, runRows.map((row) => h("option", { key: row.id, value: `run:${row.id}` }, `${row.name} \xB7 ${row.status ? `${t(row.status)} \xB7 ` : ""}${row.id.slice(0, 8)}`))),
                  savedRows.length > 0 && h("optgroup", { label: t("saved") }, savedRows.map((row, index) => h("option", { key: `${row.scope}:${row.name}`, value: `saved:${index}` }, `${row.name} \xB7 ${t(row.scope)}`)))
                ),
                h("span", { className: "caw-meta", role: "status" }, t(feed.live ? "connected" : "disconnected"))
              ),
              h(
                "div",
                { className: "caw-header-actions" },
                button(t("create"), () => {
                  setFusionOpen(false);
                  setEditorOpen(true);
                  navigate(null);
                }, busy),
                button(t("fusionOpen"), () => {
                  setFusionOpen((value) => !value);
                  setEditorOpen(false);
                }, busy, false, { "aria-expanded": fusionOpen, "aria-controls": "fusion-composer-panel" }),
                button(t(editorOpen ? "hideEditor" : "editScript"), () => setEditorOpen((value) => !value), busy, false, { "aria-expanded": editorOpen }),
                button(t("save"), () => perform({ action: "save", name, script, scope }), busy || !valid),
                running && button(t("stop"), () => perform({ action: "stop", id: selected }), busy),
                selected && run?.status === "stopped" && run.stopReason !== "superseded" && button(t("resume"), () => perform({ action: "resume", id: selected }).then((value) => {
                  if (value) setRun(value);
                }), busy, true),
                valid && !running && !editorOpen && button(t("run"), launch, busy, true)
              )
            ),
            h(
              "div",
              { className: "caw-run-context" },
              h("div", { className: "caw-run-heading" }, h("h2", null, run?.name ?? (selected ? t("loading") : name)), run && state(run.status), displayId && h("code", { className: "caw-run-id", title: displayId }, displayId.slice(0, 8))),
              run && h(Metrics, { run })
            ),
            h("div", { className: "caw-tabs", role: "group", "aria-label": t("title") }, ["overview", "timeline", "details", "results"].map((value) => button(t(value), () => setTab(value), false, false, { "aria-pressed": tab === value })))
          ),
          (error || feed.error) && h("div", { className: "caw-error", role: "alert" }, error || feed.error, button(t("refresh"), () => feed.refresh(), busy)),
          selected && !run && !feed.error && h("div", { className: "caw-empty", role: "status" }, h("span", { className: "caw-skeleton", "aria-hidden": true }), h("span", { className: "caw-skeleton", "aria-hidden": true }), h("span", null, t("loading"))),
          h(
            "div",
            { className: "caw-body" },
            fusionOpen && h("div", { id: "fusion-composer-panel" }, h(FusionComposer, { modelRoutes: collection.modelRoutes ?? [], busy, onCreate: createFusion, draft: fusionDraft, onDraftChange: setFusionDraft })),
            run?.args?.preset === "fusion.v1" && h(FusionSummary, { run, onDetails: inspectFusion }),
            editorOpen && h("section", { className: "caw-editor", "aria-label": t("authoring") }, h("div", { className: "caw-editor-title" }, h("h3", null, t("authoring")), button(t("hideEditor"), () => setEditorOpen(false))), h(
              "div",
              { className: "caw-editor-fields" },
              h("label", null, t("name"), h("input", { value: name, onChange: (event) => setName(event.target.value), maxLength: 120 })),
              h("label", { className: "caw-script" }, t("script"), h("textarea", { value: script, spellCheck: false, onChange: (event) => setScript(event.target.value) })),
              h("div", { className: "caw-row" }, button(t("useSample"), () => {
                setScript(SAMPLE);
                setAnalysis(null);
              }, busy), button(t("tools"), async () => {
                const result = await perform({ action: "help" });
                if (result) setApiHelp(result.facade);
              }, busy)),
              apiHelp && h("details", null, h("summary", null, t("tools")), code(apiHelp)),
              h("label", null, t("model"), h("select", { value: modelRoute, onChange: (event) => setModelRoute(event.target.value) }, h("option", { value: "" }, t("inheritModel")), (collection.modelRoutes ?? []).map((route) => h("option", { key: `${route.provider}/${route.model}`, value: JSON.stringify({ provider: route.provider, model: route.model }) }, `${route.provider}/${route.model}`)))),
              h("label", null, t("args"), h("textarea", { rows: 2, value: argsText, onChange: (event) => setArgsText(event.target.value) })),
              h("div", { className: "caw-row" }, h("label", null, t("concurrency"), h("input", { type: "number", min: 1, max: 64, value: concurrency, onChange: (event) => setConcurrency(event.target.value) })), h("label", null, t("saveScope"), h("select", { value: scope, onChange: (event) => setScope(event.target.value) }, ["project", "global"].map((value) => h("option", { key: value, value }, t(value))))))
            ), h(
              "div",
              { className: "caw-editor-actions" },
              h("div", { className: "caw-row" }, button(busy ? t("loading") : t("analyze"), async () => {
                const result = await perform({ action: "analyze", script });
                if (result) {
                  setAnalysis(result);
                  setAnalyzedScript(script);
                  setTab("overview");
                  setEditorOpen(false);
                }
              }, busy || !script.trim()), button(t("save"), () => perform({ action: "save", name, script, scope }), busy || !valid)),
              h("p", { className: "caw-note", role: "status" }, valid ? t("ready") : t("stale")),
              h("div", { className: "caw-row" }, button(t("run"), launch, busy || !valid || running, true), running && button(t("stop"), () => perform({ action: "stop", id: selected }), busy), selected && run?.status === "stopped" && run.stopReason !== "superseded" && button(t("resume"), () => perform({ action: "resume", id: selected }).then((value) => {
                if (value) setRun(value);
              }), busy), selected && button(t("amend"), async () => {
                try {
                  const result = await perform({ action: "amend", id: selected, script, name, args: getArgs(), concurrency: Number(concurrency), ...modelRoute ? JSON.parse(modelRoute) : {} });
                  if (result) {
                    navigate(result.id);
                  }
                } catch (err) {
                  setError(err.message);
                }
              }, busy || !valid)),
              h("p", { className: "caw-note" }, t("billing"))
            )),
            h(
              "div",
              { className: "caw-main" },
              h(
                "div",
                { className: "caw-content" },
                currentAnalysis?.diagnostics?.length > 0 && code(currentAnalysis.diagnostics),
                questions.length > 0 && h("section", { className: "caw-section caw-intervention" }, h("h3", null, t("questions")), questions.filter((q) => !q.answer && q.status !== "resolved").map((q, i) => h("div", { key: q.id ?? i }, h("p", null, q.question ?? q.prompt ?? q.message), h("textarea", { "aria-label": t("inputAnswer"), value: answers[q.id] ?? "", onChange: (e) => setAnswers({ ...answers, [q.id]: e.target.value }) }), button(t("answer"), () => perform({ action: "answer", id: selected, questionId: q.id, answer: answers[q.id] ?? "" }), busy)))),
                (run?.holes ?? []).filter((hole) => hole.status !== "filled" && hole.value === void 0).map((hole, i) => h("section", { key: hole.id ?? i, className: "caw-section caw-intervention" }, h("h3", null, `${t("holes")}: ${hole.name ?? hole.id}`), code(hole), h("textarea", { "aria-label": t("fill"), value: answers[hole.id] ?? "", onChange: (e) => setAnswers({ ...answers, [hole.id]: e.target.value }) }), button(t("fill"), async () => {
                  try {
                    await perform({ action: "fill_hole", id: selected, holeId: hole.id, body: answers[hole.id] ?? "" });
                  } catch (err) {
                    setError(err.message);
                  }
                }, busy))),
                holds.length > 0 && h("section", { className: "caw-section caw-intervention" }, h("h3", null, t("holds")), h("p", { className: "caw-note" }, t("holdNote")), holds.map((hold, i) => h("div", { key: hold.nodeId ?? i }, code(hold), h("textarea", { "aria-label": t("accept"), value: answers[hold.nodeId] ?? "", onChange: (e) => setAnswers({ ...answers, [hold.nodeId]: e.target.value }) }), h("div", { className: "caw-row" }, button(t("retry"), () => perform({ action: "resolve_hold", id: selected, nodeId: hold.nodeId, resolution: "retry" }), busy), button(t("accept"), async () => {
                  try {
                    await perform({ action: "resolve_hold", id: selected, nodeId: hold.nodeId, resolution: "accept", value: JSON.parse(answers[hold.nodeId]) });
                  } catch (err) {
                    setError(err.message);
                  }
                }, busy))))),
                tab === "timeline" && h(Timeline, { run: run ?? { analysis: currentAnalysis }, onNode: inspectNode }),
                tab === "overview" && h(
                  React.Fragment,
                  null,
                  run?.args?.preset === "fusion.v1" && h(
                    "div",
                    { className: "caw-row", role: "group", "aria-label": t("fusionTerminalTitle"), style: { marginBottom: 12 } },
                    button(t("fusionTerminalView"), () => setTerminalMode(true), false, false, { "aria-pressed": terminalMode }),
                    button(t("fusionTerminalGraph"), () => setTerminalMode(false), false, false, { "aria-pressed": !terminalMode })
                  ),
                  terminalMode && run?.args?.preset === "fusion.v1" ? h(FusionTerminal, { run: { ...run, events: visibleEvents, reports: mergeRows(run?.reports, additionalReports, (row) => String(row.instance?.siteId) + ":" + String(row.instance?.ordinal)) }, onLogs: inspectFusion }) : h(FlowGraph, { analysis: currentAnalysis, kind, setKind, run, onNode: inspectNode }),
                  run?.resumedFrom && h("p", { className: "caw-note" }, `${t("source")}: ${run.resumedFrom}`)
                ),
                tab === "details" && h(
                  React.Fragment,
                  null,
                  run?.nativeTeam && h("details", null, h("summary", null, "DSH Teams / Subagents"), code({ team: run.nativeTeam, members: run.actors })),
                  h("div", { className: "caw-detail-heading" }, h("h3", null, t("node")), button(t("backToGraph"), () => setTab("overview"))),
                  picked ? code({ site: picked, instances: detailNodes }) : h("p", { className: "caw-note" }, t("noNode")),
                  h("details", null, h("summary", null, `${t("details")} (${run?.nodes?.length ?? 0})`), h("p", { className: "caw-note" }, `${visibleNodes.length} / ${run?.counts?.nodes ?? "\u2014"}`), code(visibleNodes), (pageMore.nodes ?? run?.nodesPage?.hasMore) && button(t("loadMore"), () => loadAll("nodes", setAdditionalNodes), busy)),
                  h("section", { className: "caw-section" }, h("h3", null, t("events")), (pageMore.events ?? run?.eventsPage?.earlierOmitted) && h("p", { className: "caw-note" }, t("clipped")), visibleEvents.map((event, i) => h("div", { className: "caw-log", key: event.sequence ?? i }, h("time", null, event.timeCreated ? new Date(event.timeCreated).toLocaleTimeString() : ""), event.event?.message ?? event.event?.type ?? event.message ?? event.type ?? JSON.stringify(event), h("details", null, h("summary", null, t("details")), code(event)))), (pageMore.events ?? run?.eventsPage?.earlierOmitted) && button(t("loadMore"), () => loadAll("events", setAdditionalEvents), busy), !run?.events?.length && h("p", { className: "caw-note" }, t("noEvents")))
                ),
                tab === "results" && h(React.Fragment, null, run?.result !== void 0 && h("section", null, h("h3", null, t("output")), code(run.result)), (run?.artifacts ?? []).map((item, i) => h(Artifact, { key: `${item.id}:${item.version ?? i}`, item, reports: run?.reports, sessionId, runId: selected, revision: run?.updatedAt })), run?.reports?.length > 0 && h("section", { className: "caw-section" }, h("h3", null, t("reports")), code(mergeRows(run.reports, additionalReports, (row) => `${row.instance.siteId}:${row.instance.ordinal}`)), (pageMore.reports ?? run.reportsPage?.hasMore) && button(t("loadMore"), () => loadAll("reports", setAdditionalReports), busy)), run?.result === void 0 && !run?.artifacts?.length && !run?.reports?.length && h("p", { className: "caw-note" }, t("noResults"))),
                run?.error && h("p", { className: "caw-error" }, typeof run.error === "string" ? run.error : JSON.stringify(run.error))
              )
            )
          )
        )
      );
    }
    function MainView({ sessionId }) {
      return h(SessionView, { key: sessionId, sessionId });
    }
    function SessionView({ sessionId }) {
      const feed = useFeed(sessionId, null);
      const [selection, setSelection] = useState(() => mainSelections.get(sessionId) ?? null);
      const revision = useRef(selection?.revision ?? 0);
      const commit = (value) => {
        const next = { ...value, revision: ++revision.current };
        mainSelections.set(sessionId, next);
        setSelection(next);
      };
      useEffect(() => {
        if (selection === null && feed.collectionLoaded) commit(workflowSelection(null, feed.collection.runs));
      }, [selection, feed.collectionLoaded]);
      const navigate = (runId, view) => commit({ runId: runId ?? null, view: workflowView(typeof view === "string" ? view : "overview"), ...view?.saved ? { saved: view.saved } : {} });
      if (!selection) return h("div", { className: "caw-center" }, h("style", null, css), h("h2", null, t("mainTitle")), h("p", { role: feed.error ? "alert" : "status", className: "caw-empty" }, feed.error || t("loading")), feed.error && button(t("refresh"), () => feed.refresh()));
      return h(Panel, { key: JSON.stringify([sessionId, selection.runId, selection.saved?.scope, selection.saved?.name]), sessionId, runId: selection.runId, navigation: { revision: selection.revision, params: { view: selection.view, saved: selection.saved } }, onNavigate: navigate, main: true });
    }
    function RunCard({ sessionId, runId, recorded, inspect }) {
      const feed = useFeed(sessionId, runId);
      const run = feed.runs.get(runId) ?? recorded;
      const phases = phaseModel(run);
      const actors = run?.actors ?? [];
      return h(
        "section",
        { className: "caw-card", "aria-label": run?.name ?? t("title") },
        h("style", null, css),
        h(
          "div",
          { className: "caw-card-summary" },
          h("span", { className: "caw-row" }, state(run?.status), h("strong", null, run?.name ?? t("title"))),
          h("span", { className: "caw-card-meta caw-meta" }, `${run?.analysis ? phases.length : "\u2014"} ${t("stages")} \xB7 ${run?.actors ? actors.length : "\u2014"} ${t("actors")}`),
          h("span", { className: "caw-phase-dots" }, phases.map((phase) => h("span", { key: phase.id, className: "caw-phase-progress" }, h("span", { className: "caw-dot", "data-state": phase.status, "aria-hidden": true }), h("span", null, `${phase.name ?? t("other")} ${phase.completed}/${phase.total}`), state(phase.status)))),
          h(ActorChips, { actors, limit: 5 }),
          h("span", { className: "caw-card-meta caw-meta" }, t("mainEntryHint"))
        ),
        h("footer", null, h("span", { className: "caw-meta" }, `${t("artifacts")} \xB7 ${(run?.artifacts?.find((item) => item.primary) ?? run?.artifacts?.[0])?.title ?? run?.artifacts?.[0]?.id ?? run?.counts?.artifacts ?? "\u2014"}`), inspect && button(t("details"), inspect)),
        feed.error && h("p", { className: "caw-error", role: "alert" }, feed.error)
      );
    }
    function ToolView(props) {
      let args = {}, recorded;
      try {
        args = JSON.parse(props.block.call?.argsRaw ?? props.block.argsRaw ?? "{}");
      } catch {
      }
      if (props.phase === "result" && !props.block.isError) {
        try {
          recorded = JSON.parse(props.block.content.filter((item) => item.type === "text").map((item) => item.text).join("\n"));
        } catch {
        }
      }
      const runId = recorded?.id ?? args.id;
      if (!props.block.isError && typeof runId === "string") return h(RunCard, { sessionId: props.sessionId, runId, recorded, inspect: props.inspect });
      return h("div", { className: "caw-tool" }, h("style", null, css), h("span", null, `${t("title")} \xB7 ${args.action ?? props.phase}`), props.inspect && button(t("details"), props.inspect), props.block.isError && h("div", { role: "alert", className: "caw-error" }, code(props.block.content)));
    }
    ctx.slots.inject("conversation.view", () => ctx.slots.register({ name: "conversation.view", id: WORKFLOW_VIEW_ID, order: 25, locale: NS, label: () => t("mainTitle") }, MainView));
    ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({ name: "tool.call.toolview", key: "zcode_workflow", locale: NS }, ToolView));
    ctx.effect(() => () => {
      for (const feed of feeds.values()) {
        clearTimeout(feed.timer);
        feed.stream?.close();
        feed.abort?.abort();
      }
      ;
      feeds.clear();
      mainSelections.clear();
      editorStates.clear();
    }, "dynamic-workflow: shared feeds");
  }

  // composer-assist-client.js
  window.__ModuleLoader__.load({
    id: "dsh-composer-assist",
    factory(require2) {
      const React = require2("react");
      const h = React.createElement;
      const { useEffect, useRef, useState } = React;
      const NS2 = "composerAssist";
      const API2 = "/api/composer-assist";
      const zh2 = {
        "strip.next": "\u9884\u6D4B\u8F93\u5165\u6846",
        "strip.complete": "\u8865\u5168\u8349\u7A3F",
        "strip.accept": "Tab \u63A5\u53D7",
        "strip.acceptHint": "Tab \u63A5\u53D7\uFF08\u2190/\u2192 \u5207\u6362\u5019\u9009\uFF09",
        "strip.preview": "\u9884\u89C8 \xB7 \u672A\u586B\u5165\u8349\u7A3F",
        "strip.cycle": "\u2190/\u2192 \u5207\u6362\u5019\u9009",
        "strip.dismiss": "\u5FFD\u7565",
        "strip.draftChanged": "\u8349\u7A3F\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u9884\u6D4B",
        "strip.confidence": "\u7F6E\u4FE1\u5EA6",
        "strip.picked": "\u5DF2\u9009",
        "strip.candidates": "\u5019\u9009\u5EFA\u8BAE",
        "strip.rowLabel": "\u7B2C {n} \u6761\uFF0C\u5171 {total} \u6761",
        "strip.confidenceHigh": "\u8F83\u9AD8",
        "strip.confidenceMedium": "\u4E2D\u7B49",
        "strip.confidenceLow": "\u8F83\u4F4E",
        "strip.thinking": "\u6B63\u5728\u751F\u6210\u2026",
        "strip.failed": "\u751F\u6210\u5931\u8D25",
        "predict.again": "\u91CD\u65B0\u9884\u6D4B\u8F93\u5165\u6846",
        "predict.short": "\u9884\u6D4B",
        "predict.title": "\u9884\u6D4B\u8F93\u5165\u6846",
        "predict.busy": "\u9884\u6D4B\u4E2D\u2026",
        "polish.short": "\u6DA6\u8272",
        "polish.title": "\u6DA6\u8272\u63D0\u793A\u8BCD",
        "polish.busy": "\u6DA6\u8272\u4E2D\u2026",
        "polish.failed": "\u6DA6\u8272\u5931\u8D25",
        "assist.title": "\u6DA6\u8272\u6216\u9884\u6D4B\u8F93\u5165\u6846",
        "assist.more": "\u66F4\u591A\u64CD\u4F5C\u4E0E\u8BBE\u7F6E",
        "settings.title": "\u8F93\u5165\u6846\u9884\u6D4B",
        "settings.nav": "\u9884\u6D4B",
        "settings.restore": "\u6062\u590D\u9ED8\u8BA4\u503C",
        "settings.restoreHint": "\u628A\u8FD9\u51E0\u4E2A\u6570\u503C\u6539\u56DE\u63D2\u4EF6\u9ED8\u8BA4\u503C\uFF0C\u4E0D\u52A8\u5F00\u5173\u548C\u6A21\u578B\u9009\u62E9\u3002",
        "settings.description": "\u5728\u8F93\u5165\u6846\u4E0A\u65B9\u9884\u6D4B\u4F60\u60F3\u8F93\u5165\u7684\u5185\u5BB9\u3001\u8865\u5168\u8349\u7A3F\uFF0C\u6216\u70B9 \u2728 \u6DA6\u8272\u63D0\u793A\u8BCD\u3002",
        "settings.enabled": "\u542F\u7528",
        "settings.learn": "\u63A5\u53D7\u5B66\u4E60",
        "settings.learnHint": "\u8BB0\u5F55\u4F60\u63A5\u53D7/\u5FFD\u7565\u7684\u5EFA\u8BAE\u6765\u8C03\u6574\u540E\u7EED\u9884\u6D4B\u3002\u9ED8\u8BA4\u5173\u95ED\u3002",
        "settings.reset": "\u6E05\u9664\u7EDF\u8BA1",
        "settings.resetHint": "\u6E05\u7A7A\u5DF2\u8BB0\u5F55\u7684\u63A5\u53D7/\u5FFD\u7565\u8BA1\u6570\u3002",
        "settings.resetFailed": "\u6E05\u9664\u7EDF\u8BA1\u5931\u8D25",
        "settings.mode": "\u6A21\u5F0F",
        "settings.mode.auto": "\u81EA\u52A8\u9884\u6D4B\uFF08\u56DE\u590D\u7ED3\u675F\u540E\uFF09",
        "settings.mode.word": "\u5355\u8BCD\u8865\u5168\uFF08\u8F93\u5165\u65F6\uFF09",
        "settings.mode.both": "\u4E24\u8005\u90FD\u8981",
        "settings.mode.off": "\u53EA\u5728\u624B\u52A8\u8C03\u7528\u65F6",
        "settings.display": "\u663E\u793A\u4F4D\u7F6E",
        "settings.displayHint": "\u5EFA\u8BAE\u680F = \u8F93\u5165\u6846\u4E0A\u65B9\u72EC\u7ACB\u4E00\u884C\uFF08\u63A8\u8350\uFF09\uFF1B\u884C\u5185 = \u753B\u5728\u8F93\u5165\u6846\u91CC\u3002",
        "settings.display.bar": "\u8F93\u5165\u6846\u4E0A\u65B9\u7684\u5EFA\u8BAE\u680F\uFF08\u63A8\u8350\uFF09",
        "settings.display.inline": "\u8F93\u5165\u6846\u5185",
        "settings.model": "\u9884\u6D4B\u6A21\u578B",
        "settings.model.inherit": "\u8DDF\u968F\u672C\u4F1A\u8BDD\u6A21\u578B",
        "settings.enabledHint": "\u5173\u95ED\u540E\u884C\u4E3A\u4E0E\u672A\u5B89\u88C5\u65F6\u5B8C\u5168\u4E00\u81F4\u3002",
        "settings.modeHint": "\u81EA\u52A8 = \u6BCF\u8F6E\u56DE\u7B54\u540E\u9884\u6D4B\u4E00\u6B21\uFF1B\u5355\u8BCD = \u8F93\u5165\u65F6\u8865\u5168\u540E\u534A\u53E5\u3002",
        "settings.modelHint": "\u7559\u7A7A\u5219\u8DDF\u968F\u672C\u4F1A\u8BDD\u4E0A\u6B21\u771F\u5B9E\u7528\u8FC7\u7684\u6A21\u578B\u3002",
        "settings.model.search": "\u641C\u7D22\u6A21\u578B\u6216\u4F9B\u5E94\u5546",
        "settings.model.noMatch": "\u6CA1\u6709\u5339\u914D\u7684\u6A21\u578B",
        "settings.model.loading": "\u6B63\u5728\u8BFB\u53D6\u6A21\u578B\u5217\u8868\u2026",
        "settings.model.routeMissing": "\u65E0\u6CD5\u8BFB\u53D6\u6A21\u578B\u5217\u8868\uFF1A\u5BBF\u4E3B\u63A5\u53E3\u672A\u5C31\u7EEA\uFF0C\u8BF7\u91CD\u542F DSH \u540E\u91CD\u8BD5",
        "settings.model.badResponse": "\u5BBF\u4E3B\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u6A21\u578B\u5217\u8868",
        "settings.group.behavior": "\u884C\u4E3A",
        "settings.group.budget": "\u9650\u5236\u4E0E\u5F00\u9500",
        "settings.summary.on": "\u5DF2\u542F\u7528",
        "settings.group.learning": "\u5B66\u4E60",
        "settings.summary.off": "\u5DF2\u5173\u95ED",
        "settings.maxOutputTokens": "\u8F93\u51FA\u4E0A\u9650",
        "settings.maxOutputTokensHint": "\u63A8\u7406\u578B\u6A21\u578B\u5148\u82B1\u63A8\u7406\u9884\u7B97\uFF0C\u592A\u5C0F\u4F1A\u5BFC\u81F4\u8FD4\u56DE\u7A7A\u5EFA\u8BAE\u3002",
        "settings.debounceMs": "\u8F93\u5165\u505C\u987F",
        "settings.debounceMsHint": "\u5355\u8BCD\u8865\u5168\u7B49\u4F60\u505C\u624B\u8FD9\u4E48\u4E45\u624D\u53D1\u8BF7\u6C42\u3002",
        "settings.timeoutMs": "\u8D85\u65F6",
        "settings.timeoutMsHint": "\u8D85\u65F6\u540E\u9759\u9ED8\u4E22\u5F03\uFF0C\u4E0D\u6253\u6270\u8F93\u5165\u3002\u5355\u6B21\u6A21\u578B\u8C03\u7528\u7684\u4E0A\u9650\u3002",
        "settings.maxInputChars": "\u4E0A\u4E0B\u6587\u4E0A\u9650",
        "settings.maxInputCharsHint": "\u53D1\u7ED9\u9884\u6D4B\u6A21\u578B\u7684\u6700\u8FD1\u5BF9\u8BDD\u957F\u5EA6\u3002",
        "settings.minConfidence": "\u7F6E\u4FE1\u5EA6\u95E8\u69DB",
        "settings.minConfidenceHint": "\u4F4E\u4E8E\u6B64\u503C\u7684\u9884\u6D4B\u4F1A\u88AB\u4E22\u5F03\uFF1B0 \u8868\u793A\u5168\u90E8\u4FDD\u7559\uFF0C\u53EA\u5728\u5EFA\u8BAE\u680F\u6807\u6CE8\u7F6E\u4FE1\u5EA6\u3002",
        "settings.costNote": "\u6BCF\u6B21\u9884\u6D4B\u90FD\u662F\u4E00\u6B21\u771F\u5B9E\u8BA1\u8D39\u7684\u6A21\u578B\u8C03\u7528\uFF1B\u5173\u6389\u5F00\u5173\u5373\u53EF\u5B8C\u5168\u505C\u6B62\u3002",
        "settings.saveFailed": "\u8BBE\u7F6E\u4FDD\u5B58\u5931\u8D25",
        "settings.noModels": "\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u6A21\u578B\uFF0C\u8BF7\u5148\u5728\u300C\u6A21\u578B\u300D\u8BBE\u7F6E\u91CC\u914D\u7F6E\u3002",
        "settings.catalogFailed": "\u8BFB\u53D6\u6A21\u578B\u76EE\u5F55\u5931\u8D25\uFF1A",
        "settings.open": "\u8F93\u5165\u6846\u9884\u6D4B\u8BBE\u7F6E",
        "settings.close": "\u5173\u95ED",
        "settings.subagentNote": "\u5B50\u667A\u80FD\u4F53\u53EF\u7528\u7684\u6A21\u578B\u7531 DSH \u539F\u751F\u300C\u5B50\u667A\u80FD\u4F53\u6A21\u578B\u9009\u62E9\u8BBE\u7F6E\u300D\u7BA1\u7406\uFF0C\u4E0D\u5728\u672C\u63D2\u4EF6\u91CC\u6539\u3002"
      };
      const en2 = {
        "strip.next": "Predicted input",
        "strip.complete": "Draft continuation",
        "strip.accept": "Tab to accept",
        "strip.acceptHint": "Tab to accept (\u2190/\u2192 to cycle)",
        "strip.preview": "Preview \xB7 not inserted",
        "strip.cycle": "\u2190/\u2192 switch candidates",
        "strip.dismiss": "Dismiss",
        "strip.draftChanged": "Draft changed; predict again",
        "strip.confidence": "confidence",
        "strip.picked": "ticked",
        "strip.candidates": "Candidate suggestions",
        "strip.rowLabel": "Candidate {n} of {total}",
        "strip.confidenceHigh": "high",
        "strip.confidenceMedium": "medium",
        "strip.confidenceLow": "low",
        "strip.thinking": "Generating\u2026",
        "strip.failed": "Generation failed",
        "predict.again": "Predict input again",
        "predict.short": "Predict",
        "predict.title": "Predict input",
        "predict.busy": "Predicting\u2026",
        "polish.short": "Polish",
        "polish.title": "Polish prompt",
        "polish.busy": "Polishing\u2026",
        "polish.failed": "Polish failed",
        "assist.title": "Polish or predict the composer",
        "assist.more": "More actions and settings",
        "settings.title": "Composer prediction",
        "settings.nav": "Prediction",
        "settings.restore": "Restore defaults",
        "settings.restoreHint": "Resets these numbers to the plugin defaults; leaves switches and model choice alone.",
        "settings.description": "Predict what you are about to type, complete a draft, or polish it with \u2728.",
        "settings.enabled": "Enabled",
        "settings.learn": "Acceptance learning",
        "settings.learnHint": "Remember what you accept and dismiss to tune later predictions. Off by default.",
        "settings.reset": "Clear stats",
        "settings.resetHint": "Erase the recorded accept/dismiss counters.",
        "settings.resetFailed": "Could not clear the stats",
        "settings.mode": "Mode",
        "settings.mode.auto": "Auto (after a reply)",
        "settings.mode.word": "Word completion (while typing)",
        "settings.mode.both": "Both",
        "settings.mode.off": "Manual only",
        "settings.display": "Where it shows",
        "settings.displayHint": "Bar is its own row above the composer (recommended); Inline draws it inside.",
        "settings.display.bar": "Bar above the composer (recommended)",
        "settings.display.inline": "Inside the composer",
        "settings.model": "Prediction model",
        "settings.model.inherit": "Follow this session",
        "settings.enabledHint": "Off behaves exactly like the plugin not being installed.",
        "settings.modeHint": "Auto = once after each reply; Word = continue the draft while typing.",
        "settings.modelHint": "Empty follows the model this session actually used last.",
        "settings.model.search": "Search models or providers",
        "settings.model.noMatch": "No matching model",
        "settings.model.loading": "Loading models\u2026",
        "settings.model.routeMissing": "Cannot read models: the Host route is not ready; restart DSH and retry",
        "settings.model.badResponse": "The Host returned an unreadable model list",
        "settings.group.behavior": "Behaviour",
        "settings.group.budget": "Limits and cost",
        "settings.summary.on": "On",
        "settings.group.learning": "Learning",
        "settings.summary.off": "Off",
        "settings.maxOutputTokens": "Output cap",
        "settings.maxOutputTokensHint": "Reasoning models spend budget on reasoning first; a small cap yields an empty suggestion.",
        "settings.debounceMs": "Typing pause",
        "settings.debounceMsHint": "How long the draft must stay still before completion is requested.",
        "settings.timeoutMs": "Timeout",
        "settings.timeoutMsHint": "A timeout drops the request silently and never blocks typing.",
        "settings.maxInputChars": "Context cap",
        "settings.maxInputCharsHint": "How much recent conversation is sent to the prediction model.",
        "settings.minConfidence": "Confidence bar",
        "settings.minConfidenceHint": "Predictions below this are dropped; 0 keeps them and only shows the confidence badge.",
        "settings.costNote": "Every prediction is a real billed model call; switch this off to stop it entirely.",
        "settings.saveFailed": "Could not save settings",
        "settings.noModels": "No models are available; configure one under Models first.",
        "settings.catalogFailed": "Could not read the model catalog: ",
        "settings.open": "Composer prediction settings",
        "settings.close": "Close",
        "settings.subagentNote": 'Which models subagents may use is owned by the native "Subagent model selection" setting, not by this plugin.'
      };
      Object.assign(zh2, {
        "timing.queue": "\u6392\u961F",
        "timing.prepare": "\u51C6\u5907",
        "timing.model": "\u6A21\u578B",
        "timing.validate": "\u6821\u9A8C",
        "timing.waiting": "\u7B49\u5F85\u670D\u52A1\u7AEF\u9636\u6BB5\u6570\u636E",
        "timing.total": "\u603B\u8017\u65F6",
        "timing.elapsed": "\u5DF2\u7B49\u5F85",
        "timing.complete": "\u5DF2\u5B8C\u6210",
        "timing.timeout": "\u8D85\u65F6",
        "timing.failed": "\u8BF7\u6C42\u5931\u8D25",
        "timing.stale-source": "\u7ED3\u679C\u5DF2\u8FC7\u671F",
        "timing.low-confidence": "\u4F4E\u4E8E\u7F6E\u4FE1\u5EA6\u95E8\u69DB",
        "timing.empty-transcript": "\u7F3A\u5C11\u5BF9\u8BDD\u4E0A\u4E0B\u6587",
        "timing.empty-input": "\u8349\u7A3F\u4E3A\u7A7A",
        "timing.model-empty": "\u65E0\u5019\u9009\u7ED3\u679C",
        "timing.note": "\u6392\u961F=\u7B49\u5F85\u4E0A\u4E00\u8C03\u7528\u9000\u51FA\uFF1B\u51C6\u5907=\u4E0A\u4E0B\u6587\u4E0E\u6A21\u578B\u51C6\u5907\uFF1B\u6A21\u578B\u542B\u4F9B\u5E94\u5546\u53CA\u7F51\u7EDC\u7B49\u5F85\uFF1B\u6821\u9A8C\u542B\u54CD\u5E94\u89E3\u6790\u548C\u6765\u6E90\u6838\u5BF9\u3002\u5206\u6BB5\u4E0D\u542B\u5168\u90E8\u4F20\u8F93/\u9875\u9762\u5F00\u9500\uFF1B\u2014\u8868\u793A\u672A\u53D6\u5F97\u6570\u636E\u3002\u4EC5\u5F53\u524D\u9875\u9762\u5185\u5B58\u4FDD\u7559\u6700\u8FD18\u4E2A\u4F1A\u8BDD\u7684\u6700\u65B0\u8BF7\u6C42\u7EDF\u8BA1\uFF0C\u4E0D\u8BB0\u5F55\u6B63\u6587\u3002"
      });
      Object.assign(en2, {
        "timing.queue": "Queue",
        "timing.prepare": "Prepare",
        "timing.model": "Model",
        "timing.validate": "Validate",
        "timing.waiting": "Waiting for server timing",
        "timing.total": "Total",
        "timing.elapsed": "Elapsed",
        "timing.complete": "Complete",
        "timing.timeout": "Timed out",
        "timing.failed": "Request failed",
        "timing.stale-source": "Stale result",
        "timing.low-confidence": "Below confidence threshold",
        "timing.empty-transcript": "No conversation context",
        "timing.empty-input": "Empty draft",
        "timing.model-empty": "No candidate",
        "timing.note": "Queue waits for an earlier call; prepare includes context and model preparation; model includes provider/network wait; validation includes response parsing and source checks. Segments exclude some transport/page overhead; \u2014 means unavailable. Only the latest request for 8 sessions is retained in page memory; no prompt text."
      });
      const settingsStore = {
        value: null,
        listeners: /* @__PURE__ */ new Set(),
        set(next) {
          this.value = next;
          for (const listener of this.listeners) listener();
        },
        subscribe(listener) {
          this.listeners.add(listener);
          return () => {
            this.listeners.delete(listener);
          };
        }
      };
      async function readSettings() {
        try {
          const response = await fetch(`${API2}/settings`);
          const body = await readJsonResponse(response, "settings");
          if (body.ok !== true) throw new ResponseShapeError("settings: request was refused");
          if (body.settings === null || typeof body.settings !== "object" || Array.isArray(body.settings)) {
            throw new ResponseShapeError('settings: "settings" is not an object');
          }
          settingsStore.error = void 0;
          if (body.defaults !== void 0) settingsStore.defaults = body.defaults;
          settingsStore.set(body.settings);
          return body.settings;
        } catch (failure) {
          settingsStore.error = failure instanceof Error ? failure.message : String(failure);
          return void 0;
        }
      }
      async function saveSettings(patch) {
        const response = await fetch(`${API2}/settings`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch)
        });
        const body = await response.json();
        if (body?.settings !== void 0) settingsStore.set(body.settings);
        return body;
      }
      async function withTimeout(work, milliseconds) {
        const abort = new AbortController();
        let timer;
        try {
          return await Promise.race([
            new Promise((_, reject) => {
              timer = setTimeout(() => {
                const error = new DOMException("Suggestion timed out", "TimeoutError");
                abort.abort(error);
                reject(error);
              }, milliseconds);
            }),
            work(abort.signal)
          ]);
        } finally {
          clearTimeout(timer);
        }
      }
      const timingBySession = /* @__PURE__ */ new Map();
      const ignoredUntil = /* @__PURE__ */ new Map();
      class ResponseShapeError extends Error {
      }
      async function readJsonResponse(response, what) {
        const raw = typeof response.text === "function" ? await response.text() : JSON.stringify(await response.json());
        let body;
        try {
          body = JSON.parse(raw);
        } catch {
          throw new ResponseShapeError(response.ok ? `${what}: response is not JSON` : `${what}: HTTP ${response.status}${raw === "" ? "" : ` (${raw.slice(0, 80)})`}`);
        }
        if (body === null || typeof body !== "object" || Array.isArray(body)) {
          throw new ResponseShapeError(`${what}: response is not an object`);
        }
        return body;
      }
      const isPositiveInt = (value) => Number.isSafeInteger(value) && value >= 0;
      function requireString(body, key, what) {
        if (typeof body[key] !== "string") throw new ResponseShapeError(`${what}: "${key}" is not a string`);
        return body[key];
      }
      function requireFinite(body, key, what) {
        if (!Number.isFinite(body[key]) || body[key] < 0) {
          throw new ResponseShapeError(`${what}: "${key}" is not a non-negative number`);
        }
        return body[key];
      }
      async function request(kind, sessionId, draft, revision, source, cause) {
        const configured = settingsStore.value?.timeoutMs;
        const deadline = Number.isFinite(configured) ? Math.max(2e3, Math.min(12e4, configured)) : 2e4;
        const id = currentRequestId(sessionId);
        const timing = { kind, started: performance.now(), pending: true, stage: "waiting", host: null };
        timingBySession.delete(sessionId);
        timingBySession.set(sessionId, timing);
        while (timingBySession.size > 8) timingBySession.delete(timingBySession.keys().next().value);
        notifyStore();
        try {
          const result = await withTimeout(async (signal) => {
            const response = await fetch(`${API2}/suggest`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ kind, sessionId, draft, revision, source, cause }),
              signal
            });
            signal.throwIfAborted();
            timing.stage = "validate";
            timing.receivedAt = performance.now();
            if (timingBySession.get(sessionId) === timing) notifyStore();
            const body = await readJsonResponse(response, `suggest(${kind})`);
            signal.throwIfAborted();
            if (typeof body.ok !== "boolean") throw new ResponseShapeError('suggest: "ok" is not a boolean');
            if (body.ok !== true) {
              if (typeof body.error !== "string" || body.error === "") {
                throw new ResponseShapeError("suggest: failure without an error message");
              }
              throw new Error(body.error);
            }
            const owned = body.sessionId === sessionId && body.revision === revision && typeof body.source === "string";
            const phases = ["queue", "prepare", "model", "validate"];
            if (owned && phases.includes(body.timing?.phase) && phases.every((key) => Number.isFinite(body.timing[key]) && body.timing[key] >= 0)) {
              timing.host = { phase: body.timing.phase, ...Object.fromEntries(phases.map((key) => [key, body.timing[key]])) };
            }
            if (!owned) {
              reportProbe({
                phase: "not-owned",
                reason: "not-owned",
                sameSession: body?.sessionId === sessionId,
                revisionMatches: body?.revision === revision,
                hasSource: typeof body?.source === "string",
                source: body?.source,
                sourceBound: body?.sourceBound,
                sourceBefore: body?.sourceBefore,
                sourceAfter: body?.sourceAfter,
                hostReason: body?.reason
              });
              return { text: "", candidates: [], confidence: null, reason: "stale-source" };
            }
            const text = typeof body.text === "string" ? body.text : "";
            if (text === "" && body.reason !== void 0) {
              reportProbe({ phase: "empty-result", reason: body.reason, transcriptChars: body.transcriptChars });
              return { text: "", candidates: [], confidence: null, reason: body.reason };
            }
            signal.throwIfAborted();
            const candidates = Array.isArray(body.candidates) ? body.candidates.filter((item) => typeof item === "string" && item.trim() !== "").slice(0, 3) : [];
            if (candidates.length === 0 && text !== "") candidates.push(text);
            const confidence = Number.isFinite(body.confidence) && body.confidence >= 0 && body.confidence <= 1 ? body.confidence : null;
            return { text: candidates[0] ?? "", candidates, confidence, source: body.source };
          }, deadline + 1e3);
          timing.status = id !== currentRequestId(sessionId) || draftBySession.get(sessionId)?.revision !== revision ? "stale-source" : ["timeout", "stale-source", "low-confidence", "empty-transcript", "empty-input", "model-empty"].includes(result.reason) ? result.reason : result.text === "" ? "model-empty" : "complete";
          return result;
        } catch (error) {
          timing.status = error?.name === "TimeoutError" ? "timeout" : "failed";
          throw error;
        } finally {
          timing.pending = false;
          timing.total = performance.now() - timing.started;
          timing.clientValidation = timing.receivedAt === void 0 ? 0 : performance.now() - timing.receivedAt;
          if (timingBySession.get(sessionId) === timing) notifyStore();
        }
      }
      async function recordFeedback(action, text) {
        try {
          const response = await fetch(`${API2}/feedback`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action, text, kind: "next" })
          });
          return await response.json();
        } catch {
          return void 0;
        }
      }
      const GHOST_CLASS = "composer-assist-ghost";
      const GHOST_STYLE_ID = "composer-assist-ghost-style";
      function ensureGhostStyle() {
        if (typeof document === "undefined" || document.getElementById(GHOST_STYLE_ID) !== null) return;
        const style = document.createElement("style");
        style.id = GHOST_STYLE_ID;
        style.textContent = `
.${GHOST_CLASS} {
  grid-area: 1 / 1;
  min-width: 0;
  margin: 4px 8px 4px 14px;
  pointer-events: none;
  user-select: none;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  color: var(--dsw-alias-label-secondary);
}
[data-composer-input][data-composer-assist-continuation] p:last-child::after {
  color: var(--dsw-alias-label-secondary);
  opacity: 1;
}
.${GHOST_CLASS}[hidden] { display: none; }
/* The host's own placeholder occupies the same line and inset; showing both
   stacks two sentences on one baseline. While a ghost is visible it stands in
   for the placeholder. */
[data-composer-card] :has(> .${GHOST_CLASS}:not([hidden])) { display: grid; }
[data-composer-card] :has(> .${GHOST_CLASS}:not([hidden])) > [data-composer-input] { grid-area: 1 / 1; }
[data-composer-card] :has(> .${GHOST_CLASS}:not([hidden])) > [data-composer-placeholder] { display: none; }
`;
        document.head.appendChild(style);
      }
      function composerInputElement() {
        if (typeof document === "undefined") return void 0;
        return document.querySelector("[data-composer-card] [data-composer-input]") ?? document.querySelector('[data-composer-card] [contenteditable="true"]') ?? void 0;
      }
      function ghostHostFor(element) {
        const grow = element?.parentElement;
        return grow === null || grow === void 0 ? void 0 : grow;
      }
      function ghostSpanFor(element) {
        const host = ghostHostFor(element);
        if (host === void 0) return void 0;
        let span = host.querySelector(`.${GHOST_CLASS}`);
        if (span === null) {
          span = document.createElement("span");
          span.className = GHOST_CLASS;
          span.setAttribute("aria-hidden", "true");
          span.hidden = true;
          host.appendChild(span);
        }
        return span;
      }
      const ownedHints = /* @__PURE__ */ new Map();
      function paintGhost(element, text, continuation = false) {
        clearGhosts();
        if (element === void 0 || text === "") return;
        const existing = getComputedStyle(element).getPropertyValue("--dsh-composer-hint").trim();
        if (existing !== "" && existing !== '""') return;
        if (continuation) {
          const value = `"${CSS.escape(text)}"`;
          ownedHints.set(element, {
            value,
            previous: element.style.getPropertyValue("--dsh-composer-hint"),
            priority: element.style.getPropertyPriority("--dsh-composer-hint")
          });
          element.style.setProperty("--dsh-composer-hint", value);
          element.setAttribute("data-composer-assist-continuation", "");
          return;
        }
        const span = ghostSpanFor(element);
        if (span === void 0 || span === null) return;
        span.textContent = text;
        span.hidden = false;
      }
      function measureAlignment() {
        try {
          if (typeof document === "undefined") return void 0;
          const card = document.querySelector("[data-composer-card]");
          const bar = document.querySelector("[data-composer-assist-bar]");
          if (card === null || bar === null) return { present: false };
          const c = card.getBoundingClientRect(), b = bar.getBoundingClientRect();
          return {
            present: true,
            cardLeft: Math.round(c.left),
            cardRight: Math.round(c.right),
            barLeft: Math.round(b.left),
            barRight: Math.round(b.right),
            deltaLeft: Math.round(b.left - c.left),
            deltaRight: Math.round(b.right - c.right)
          };
        } catch {
          return void 0;
        }
      }
      function reportProbe(extra) {
        try {
          const input = composerInputElement();
          const span = typeof document === "undefined" ? null : document.querySelector(`.${GHOST_CLASS}`);
          const box = input?.getBoundingClientRect();
          const rect = span?.getBoundingClientRect();
          const style = span === null || span === void 0 ? null : getComputedStyle(span);
          const placeholder = typeof document === "undefined" ? null : document.querySelector("[data-composer-card] [data-composer-placeholder]");
          const placeholderStyle = placeholder === null ? null : getComputedStyle(placeholder);
          const report = {
            at: Date.now(),
            ghostPresent: span !== null && span !== void 0,
            ghostText: span?.textContent ?? "",
            ghostHidden: span?.hidden ?? null,
            ghostDisplay: style?.display ?? null,
            ghostFontSize: style?.fontSize ?? null,
            placeholderPresent: placeholder !== null,
            placeholderDisplay: placeholderStyle?.display ?? null,
            placeholderVisible: placeholder !== null && placeholderStyle?.display !== "none" && placeholderStyle?.visibility !== "hidden",
            ghostColor: style?.color ?? null,
            insideComposer: box !== void 0 && rect !== void 0 && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1 && rect.left >= box.left - 1 && rect.right <= box.right + 1,
            composerBox: box === void 0 ? null : { top: box.top, bottom: box.bottom, left: box.left, right: box.right },
            ghostBox: rect === void 0 ? null : { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
            ...extra
          };
          void fetch(`${API2}/probe`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(report)
          }).catch(() => {
          });
          return report;
        } catch {
          return void 0;
        }
      }
      function clearGhosts() {
        if (typeof document === "undefined") return;
        for (const [element, hint] of ownedHints) {
          element.removeAttribute("data-composer-assist-continuation");
          if (element.style.getPropertyValue("--dsh-composer-hint") === hint.value) {
            if (hint.previous !== "") element.style.setProperty("--dsh-composer-hint", hint.previous, hint.priority);
            else element.style.removeProperty("--dsh-composer-hint");
          }
        }
        ownedHints.clear();
        for (const span of document.querySelectorAll(`.${GHOST_CLASS}`)) {
          span.hidden = true;
          span.textContent = "";
        }
      }
      function disposeGhosts() {
        if (typeof document === "undefined") return;
        clearGhosts();
        for (const span of document.querySelectorAll(`.${GHOST_CLASS}`)) span.remove();
        document.getElementById(GHOST_STYLE_ID)?.remove();
      }
      const manualRequest = {
        current: void 0,
        /** Whether a suggestion is on screen right now (read by the tool-row button). */
        hasSuggestion: void 0,
        /** Subscribe to that boolean so the button label follows it. */
        subscribe: void 0
      };
      const listeners = /* @__PURE__ */ new Set();
      function runRequest(kind, sessionId, draft, cause, source) {
        if (kind === "complete" && hasDraftRequest(sessionId, draft)) return Promise.resolve(null);
        const id = nextRequestId(sessionId);
        const revision = trackDraft(sessionId, draft).revision;
        const token = {};
        pendingBySession.set(sessionId, { id, token, draft, revision, bounded: true });
        publishStore();
        reportProbe({ phase: "begin", trace: `req-${id}`, owner: sessionId, kind, cause });
        return request(kind, sessionId, draft, revision, source, cause).then((result) => {
          const idMoved = id !== currentRequestId(sessionId);
          const draftMoved = draftBySession.get(sessionId)?.revision !== revision;
          const stale = idMoved || draftMoved;
          reportProbe({
            phase: "result",
            trace: `req-${id}`,
            kind,
            textLength: result.text.length,
            stale,
            idMoved,
            draftMoved,
            owner: sessionId,
            confidence: result.confidence
          });
          if (stale || result.text === "") return null;
          const record = {
            kind,
            text: result.text,
            draftAt: draft,
            source: result.source,
            candidates: result.candidates,
            confidence: result.confidence
          };
          if (kind !== "polish") rememberSuggestion(sessionId, record);
          return record;
        }).catch(() => null).finally(() => {
          if (pendingBySession.get(sessionId)?.token === token) pendingBySession.delete(sessionId);
          publishStore();
        });
      }
      const sessionStorageKey = "dsh.composer-assist.predictions.v2";
      function restoreSessionState() {
        const state = {
          requests: /* @__PURE__ */ new Map(),
          suggestions: /* @__PURE__ */ new Map(),
          candidates: /* @__PURE__ */ new Map(),
          drafts: /* @__PURE__ */ new Map(),
          pending: /* @__PURE__ */ new Map(),
          listeners: /* @__PURE__ */ new Set()
        };
        try {
          const entries = JSON.parse(sessionStorage.getItem(sessionStorageKey) ?? "[]");
          if (!Array.isArray(entries)) return state;
          for (const entry of entries.slice(-8)) {
            if (!Array.isArray(entry)) continue;
            const [id, record, index] = entry;
            if (typeof id !== "string" || record === null || typeof record !== "object" || !["next", "complete"].includes(record.kind) || typeof record.text !== "string" || record.text === "" || typeof record.draftAt !== "string" || typeof record.source !== "string") continue;
            const candidates = Array.isArray(record.candidates) ? record.candidates.filter((text) => typeof text === "string" && text !== "").slice(0, 3) : [];
            state.suggestions.set(id, {
              kind: record.kind,
              text: record.text,
              draftAt: record.draftAt,
              candidates,
              source: record.source,
              confidence: Number.isFinite(record.confidence) && record.confidence >= 0 && record.confidence <= 1 ? record.confidence : null
            });
            state.candidates.set(id, Number.isSafeInteger(index) && index >= 0 ? Math.min(index, Math.max(1, candidates.length) - 1) : 0);
          }
        } catch {
        }
        return state;
      }
      const sessionStateKey = Symbol.for("dsh.composer-assist.session-state.v2");
      const sessionState = window[sessionStateKey] ??= restoreSessionState();
      const requestSeqBySession = sessionState.requests;
      const draftBySession = sessionState.drafts;
      function trackDraft(sessionId, draft) {
        let state = draftBySession.get(sessionId);
        if (state === void 0 || state.draft !== draft) {
          state = { draft, revision: (state?.revision ?? 0) + 1 };
          draftBySession.set(sessionId, state);
        }
        return state;
      }
      function hasDraftRequest(sessionId, draft) {
        const active = pendingBySession.get(sessionId);
        return active?.draft === draft && active.revision === draftBySession.get(sessionId)?.revision;
      }
      async function sourceMatches(sessionId, source) {
        return withTimeout(async (signal) => {
          const response = await fetch(`${API2}/turn?sessionId=${encodeURIComponent(sessionId)}`, { signal });
          const body = await readJsonResponse(response, "turn");
          signal.throwIfAborted();
          return body.ok === true && typeof source === "string" && body.source === source;
        }, 5e3);
      }
      function nextRequestId(sessionId) {
        const next = (requestSeqBySession.get(sessionId) ?? 0) + 1;
        requestSeqBySession.set(sessionId, next);
        if (requestSeqBySession.size > 32) requestSeqBySession.delete(requestSeqBySession.keys().next().value);
        return next;
      }
      function currentRequestId(sessionId) {
        return requestSeqBySession.get(sessionId) ?? 0;
      }
      const suggestionBySession = sessionState.suggestions;
      const candidateIndexBySession = sessionState.candidates;
      let instanceSeq = 0;
      const pendingBySession = sessionState.pending;
      for (const [owner, active] of pendingBySession) {
        if (active?.bounded === true) continue;
        nextRequestId(owner);
        pendingBySession.delete(owner);
      }
      const storeListeners = sessionState.listeners;
      function onStoreChange(listener) {
        storeListeners.add(listener);
        return () => {
          storeListeners.delete(listener);
        };
      }
      function publishStore() {
        try {
          sessionStorage.setItem(sessionStorageKey, JSON.stringify(
            [...suggestionBySession].map(([id, record]) => [id, record, candidateIndexBySession.get(id) ?? 0])
          ));
        } catch {
        }
        notifyStore();
      }
      function notifyStore() {
        for (const listener of [...storeListeners]) {
          try {
            listener();
          } catch {
          }
        }
      }
      function rememberSuggestion(sessionId, value) {
        if (sessionId === void 0) return;
        if (value === null) {
          suggestionBySession.delete(sessionId);
          candidateIndexBySession.delete(sessionId);
          pickedBySession.delete(sessionId);
        } else {
          suggestionBySession.delete(sessionId);
          suggestionBySession.set(sessionId, value);
          candidateIndexBySession.set(sessionId, 0);
        }
        while (suggestionBySession.size > 8) suggestionBySession.delete(suggestionBySession.keys().next().value);
        publishStore();
      }
      const acceptedBySession = /* @__PURE__ */ new Map();
      function candidateIndex(sessionId) {
        return candidateIndexBySession.get(sessionId) ?? 0;
      }
      function candidateTotal(sessionId) {
        const record = suggestionBySession.get(sessionId);
        if (record === null || record === void 0) return 0;
        return Array.isArray(record.candidates) && record.candidates.length > 0 ? record.candidates.length : 1;
      }
      const pickedBySession = /* @__PURE__ */ new Map();
      function togglePicked(sessionId, index) {
        const total = candidateTotal(sessionId);
        if (total <= 1) return false;
        const set = pickedBySession.get(sessionId) ?? /* @__PURE__ */ new Set();
        if (set.has(index)) set.delete(index);
        else set.add(index);
        if (set.size === 0) pickedBySession.delete(sessionId);
        else pickedBySession.set(sessionId, set);
        publishStore();
        return set.has(index);
      }
      function pickedText(sessionId) {
        const set = pickedBySession.get(sessionId);
        if (set === void 0 || set.size === 0) return "";
        const record = suggestionBySession.get(sessionId);
        if (record === null || record === void 0) return "";
        const list = Array.isArray(record.candidates) && record.candidates.length > 0 ? record.candidates : [record.text];
        return [...set].sort((a, b) => a - b).map((index) => String(list[index] ?? "")).filter((text) => text !== "").join("\n");
      }
      function currentCandidate(sessionId) {
        const record = suggestionBySession.get(sessionId);
        if (record === null || record === void 0) return "";
        const total = candidateTotal(sessionId);
        const index = Math.min(candidateIndex(sessionId), total - 1);
        if (Array.isArray(record.candidates) && record.candidates.length > 0) {
          return String(record.candidates[index] ?? "");
        }
        return record.text;
      }
      function cycleCandidate(sessionId, delta) {
        const total = candidateTotal(sessionId);
        if (total <= 1) return false;
        const next = (candidateIndex(sessionId) + delta + total) % total;
        candidateIndexBySession.set(sessionId, next);
        publishStore();
        return true;
      }
      const acceptRef = { current: void 0 };
      const stripStyle = {
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        // Align with the composer card: same cap and side clearances the host uses for
        // its own dock cards, centred in the stack. This slot is a sibling of the input
        // bar, whose wrapper carries `padding: 0 <side-clearance>`; without the same
        // inset the bar is one clearance too wide on each side.
        boxSizing: "border-box",
        width: "calc(100% - 2 * var(--dsh-composer-side-clearance, 16px))",
        maxWidth: "var(--dsh-composer-card-max-width)",
        margin: "0 auto 8px",
        padding: "10px 12px",
        borderRadius: "12px",
        border: "1px solid var(--dsw-alias-border-l1)",
        // A faint brand wash plus the card layer: distinct from the composer below
        // without the heavy accent bar the design brief rejected.
        background: "color-mix(in srgb, var(--dsw-alias-brand-primary) 3%, var(--dsw-alias-bg-layer-1))",
        color: "var(--dsw-alias-label-primary)",
        fontSize: "13px",
        lineHeight: "1.5"
      };
      const stripBadge = {
        flex: "0 0 auto",
        fontSize: "11px",
        fontWeight: "650",
        lineHeight: "1.6",
        color: "var(--dsw-alias-brand-primary)",
        whiteSpace: "nowrap"
      };
      const stripText = {
        flex: "1 1 auto",
        minWidth: 0,
        color: "var(--dsw-alias-label-primary)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      };
      const stripActions = { flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px" };
      const candidateRow = {
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        boxSizing: "border-box",
        padding: "8px 12px",
        marginTop: "6px",
        borderRadius: "8px",
        cursor: "pointer",
        border: "1px solid var(--dsw-alias-border-l1)",
        background: "var(--dsw-alias-bg-layer-2)",
        color: "var(--dsw-alias-label-primary)",
        textAlign: "left"
      };
      const candidateRowShown = {
        ...candidateRow,
        border: "2px solid var(--dsw-alias-brand-primary)",
        padding: "7px 11px",
        background: "var(--dsw-alias-bg-layer-1)"
      };
      const candidateRowPicked = {
        ...candidateRow,
        border: "1px solid var(--dsw-alias-brand-primary)",
        background: "var(--dsw-alias-brand-primary)",
        color: "var(--dsw-alias-bg-base)"
      };
      const candidateTextPicked = {
        flex: "1 1 auto",
        minWidth: 0,
        color: "var(--dsw-alias-bg-base)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      };
      const candidateIndexLabel = {
        flex: "0 0 auto",
        width: "14px",
        textAlign: "right",
        fontSize: "10px",
        fontWeight: "650",
        lineHeight: "1.6",
        color: "var(--dsw-alias-label-secondary)"
      };
      function SuggestionStrip({ sessionId, useInput, useSession, inputActions, settings, t }) {
        const draft = useInput((state) => state.draft);
        trackDraft(sessionId, draft);
        const phase = useInput((state) => state.phase);
        const phaseRef = useRef(phase);
        phaseRef.current = phase;
        const blank = useSession((session) => session.blank);
        const running = useSession((session) => session.running);
        const [pending, setPending] = useState(null);
        const [busy, setBusy] = useState(false);
        const [failed, setFailed] = useState(false);
        const askRef = useRef(void 0);
        const sessionIdRef = useRef(sessionId);
        sessionIdRef.current = sessionId;
        const pendingRef = useRef(null);
        const draftRef = useRef(draft);
        draftRef.current = draft;
        const enabled = settings !== null && settings.enabled === true;
        const mode = settings?.mode ?? "auto";
        const instanceId = useRef(void 0);
        if (instanceId.current === void 0) instanceId.current = `i${++instanceSeq}`;
        useEffect(() => {
          reportProbe({ phase: "mount", instanceId: instanceId.current, sessionId });
          return () => {
            reportProbe({ phase: "unmount", instanceId: instanceId.current, sessionId: sessionIdRef.current });
          };
        }, []);
        useEffect(() => {
          const apply = () => {
            const restored = suggestionBySession.get(sessionId) ?? null;
            setPending(restored === null ? null : { ...restored });
            setBusy(pendingBySession.has(sessionId));
          };
          apply();
          reportProbe({
            phase: "restore",
            instanceId: instanceId.current,
            sessionId,
            hasStored: suggestionBySession.get(sessionId) != null,
            storedSize: suggestionBySession.size,
            keys: [...suggestionBySession.keys()].map((k) => k.slice(-6))
          });
          setFailed(false);
          return onStoreChange(apply);
        }, [sessionId]);
        useEffect(() => {
          if (!enabled) return void 0;
          let stopped = false;
          const verify = async () => {
            const stored2 = suggestionBySession.get(sessionId);
            if (stored2 === void 0) return;
            try {
              const matches = await sourceMatches(sessionId, stored2.source);
              if (!stopped && !matches && suggestionBySession.get(sessionId) === stored2) rememberSuggestion(sessionId, null);
            } catch {
            }
          };
          void verify();
          const timer = setInterval(() => {
            void verify();
          }, 5e3);
          return () => {
            stopped = true;
            clearInterval(timer);
          };
        }, [sessionId, enabled, running, pending?.source]);
        const clear = (via) => {
          reportProbe({
            phase: "clear",
            via: via ?? "unknown",
            instanceId: instanceId.current,
            sessionId,
            hadPending: pending !== null
          });
          if (via !== "hide") nextRequestId(sessionId);
          if (via !== "hide") rememberSuggestion(sessionId, null);
          setPending(null);
          setBusy(false);
          setFailed(false);
          for (const listener of listeners) listener();
        };
        const ask = async (kind, at, cause, source) => {
          const owner = sessionId;
          const automatic = cause !== "manual";
          if (automatic && pendingBySession.has(owner)) return;
          reportProbe({ phase: "request", kind, cause: cause ?? "unknown", draft: at, owner });
          setFailed(false);
          await runRequest(kind, owner, at, cause, source);
          if (sessionIdRef.current === owner) {
            const stored2 = suggestionBySession.get(owner);
            setPending(stored2 === void 0 ? null : { ...stored2 });
            setBusy(pendingBySession.has(owner));
            for (const listener of listeners) listener();
          }
        };
        const lastDraft = useRef({ sessionId, draft });
        useEffect(() => {
          const previous = lastDraft.current;
          lastDraft.current = { sessionId, draft };
          const sameSession = previous.sessionId === sessionId;
          const sent = sameSession && previous.draft.trim() !== "" && draft === "";
          if (!sent) return;
          clear("send");
          ignoredUntil.set(sessionId, Date.now());
        }, [draft, sessionId]);
        useEffect(() => {
          if (!enabled || mode !== "auto" && mode !== "both") return void 0;
          let stopped = false;
          const poll = async () => {
            if (stopped) return;
            try {
              const peek = await fetch(`${API2}/turn?sessionId=${encodeURIComponent(sessionId)}`);
              const seen = await readJsonResponse(peek, "turn");
              const since = ignoredUntil.get(sessionId) ?? 0;
              const muted = seen.auto !== null && seen.auto !== void 0 && typeof seen.auto.at === "number" && seen.auto.at <= since;
              if (seen.auto !== null && seen.auto !== void 0 && !muted && suggestionBySession.get(sessionId) === void 0) {
                if (seen.turn !== null && seen.turn !== void 0) {
                  void fetch(`${API2}/turn?sessionId=${encodeURIComponent(sessionId)}&consume=1`);
                }
                reportProbe({ phase: "adopt-host", sessionId, count: Array.isArray(seen.auto.candidates) ? seen.auto.candidates.length : 1 });
                rememberSuggestion(sessionId, {
                  kind: "next",
                  text: seen.auto.text,
                  draftAt: "",
                  source: seen.auto.source,
                  candidates: seen.auto.candidates,
                  confidence: seen.auto.confidence
                });
                return;
              }
              if (stopped || seen.turn === null || seen.turn === void 0) return;
              if (draftRef.current !== "") return;
              if (running === true) return;
              const claim = await fetch(`${API2}/turn?sessionId=${encodeURIComponent(sessionId)}&consume=1`);
              const claimed = await readJsonResponse(claim, "turn");
              if (claimed.turn === null || claimed.turn === void 0) return;
              if (blank || draftRef.current !== "") return;
            } catch {
            }
          };
          void poll();
          const timers = [];
          if (running) {
            timers.push(setInterval(() => {
              void poll();
            }, 1e3));
          } else {
            timers.push(setTimeout(() => {
              void poll();
            }, 900), setTimeout(() => {
              void poll();
            }, 2200));
            timers.push(setInterval(() => {
              void poll();
            }, 5e3));
          }
          return () => {
            stopped = true;
            timers.forEach((t2) => {
              clearInterval(t2);
              clearTimeout(t2);
            });
          };
        }, [enabled, mode, blank, sessionId, running]);
        useEffect(() => {
          if (!enabled || mode !== "word" && mode !== "both") return;
          if (draft.trim() === "" || hasDraftRequest(sessionId, draft)) return;
          if (suggestionBySession.get(sessionId)?.draftAt === draft) return;
          const timer = setTimeout(() => {
            if (draftRef.current === draft && !hasDraftRequest(sessionId, draft)) void ask("complete", draft, "typing");
          }, settings?.debounceMs ?? 600);
          return () => {
            clearTimeout(timer);
          };
        }, [draft, enabled, mode, sessionId, settings?.debounceMs]);
        askRef.current = ask;
        pendingRef.current = pending;
        manualRequest.current = (kind) => {
          reportProbe({ phase: "manual-fire", kind: kind ?? "next", hasAsk: askRef.current !== void 0, enabled });
          pendingBySession.set(sessionId, { id: currentRequestId(sessionId) + 1, token: {}, bounded: true });
          publishStore();
          void askRef.current?.(kind ?? "next", draftRef.current, "manual");
        };
        manualRequest.hasSuggestion = () => pendingRef.current !== null;
        manualRequest.isBusy = () => pendingBySession.has(sessionId);
        manualRequest.subscribe = (listener) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        };
        useEffect(() => {
          for (const listener of listeners) listener();
        }, [pending, failed]);
        useEffect(() => {
          if (pending === null && !busy && !failed) return void 0;
          const timer = setTimeout(() => {
            const measured = measureAlignment();
            if (measured !== void 0) reportProbe({ phase: "align", ...measured });
          }, 60);
          return () => {
            clearTimeout(timer);
          };
        }, [pending, busy, failed, sessionId]);
        useEffect(() => {
          let accepting = false;
          const accept = () => {
            const stored2 = suggestionBySession.get(sessionId);
            if (pending === null || stored2 === void 0 || stored2.draftAt !== draftRef.current || phaseRef.current !== "plain" || accepting) return false;
            const revision = draftBySession.get(sessionId)?.revision;
            const picked = pickedText(sessionId);
            const text2 = picked !== "" ? picked : currentCandidate(sessionId);
            accepting = true;
            inputActions.setDraft(stored2.kind === "complete" ? `${stored2.draftAt}${text2}` : text2);
            void (async () => {
              try {
                void recordFeedback("accept", text2);
                if (stored2.kind === "next") acceptedBySession.set(sessionId, stored2);
                else acceptedBySession.delete(sessionId);
                clear("accept");
              } catch {
              } finally {
                accepting = false;
              }
            })();
            return true;
          };
          acceptRef.current = accept;
          return () => {
            if (acceptRef.current === accept) acceptRef.current = void 0;
          };
        }, [pending, inputActions]);
        useEffect(() => {
          const onKey = (event) => {
            if (pending === null) return;
            const target = event.target;
            const insideComposer = target instanceof Element && target.closest("[data-composer-card]") !== null;
            if (!insideComposer) return;
            if (event.isComposing === true || event.keyCode === 229) return;
            if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
            if (event.defaultPrevented) return;
            if (draftRef.current === "") {
              const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
              if (step !== 0 && cycleCandidate(sessionId, step)) {
                event.preventDefault();
                return;
              }
            }
            if (event.key === " ") {
              if (draftRef.current === "" && candidateTotal(sessionId) > 1) {
                togglePicked(sessionId, candidateIndex(sessionId));
                event.preventDefault();
                return;
              }
            }
            if (event.key === "Escape") clear("hide");
          };
          window.addEventListener("keydown", onKey);
          return () => {
            window.removeEventListener("keydown", onKey);
          };
        }, [pending]);
        useEffect(() => {
          if (!enabled || draft !== "") return;
          if (suggestionBySession.get(sessionId) !== void 0 || pendingBySession.has(sessionId)) return;
          const saved = acceptedBySession.get(sessionId);
          if (saved === void 0) return;
          acceptedBySession.delete(sessionId);
          rememberSuggestion(sessionId, saved);
          setPending(saved);
        }, [enabled, draft, sessionId]);
        const inline = settings?.display === "inline";
        const continuation = pending?.kind === "complete" && pending.draftAt === draft && draft !== "";
        const ghost = enabled && pending !== null && (pending.kind === "next" && draft === "" || continuation) ? currentCandidate(sessionId) : "";
        useEffect(() => {
          if (!inline) {
            clearGhosts();
            return void 0;
          }
          ensureGhostStyle();
          const element = composerInputElement();
          if (element === void 0) return void 0;
          paintGhost(element, ghost, continuation);
          reportProbe({ phase: "paint", ghost });
          return void 0;
        }, [ghost, inline, sessionId, continuation]);
        useEffect(() => () => {
          clearGhosts();
        }, []);
        reportProbe({
          phase: "render",
          instanceId: instanceId.current,
          sessionId,
          enabled,
          inline,
          hasPending: pending !== null,
          busy,
          failed,
          willRender: enabled && (pending !== null || busy || failed)
        });
        if (!enabled) return null;
        if (inline && pending === null && !busy && !failed) return null;
        if (!inline && pending === null && !busy && !failed) return null;
        const badge = busy ? t("strip.thinking") : failed ? t("strip.failed") : t(pending?.kind === "complete" ? "strip.complete" : "strip.next");
        const stored = pending !== null ? suggestionBySession.get(sessionId) : null;
        const text = currentCandidate(sessionId);
        const total = candidateTotal(sessionId);
        const candidateList = Array.isArray(stored?.candidates) && stored.candidates.length > 0 ? stored.candidates : stored === null ? [] : [stored.text];
        const pickedForSession = pickedBySession.get(sessionId);
        const confidence = stored?.confidence;
        const pickedCount = pickedForSession === void 0 ? 0 : pickedForSession.size;
        const counter = total > 1 ? `${candidateIndex(sessionId) + 1}/${total}${pickedCount > 0 ? ` \xB7 ${pickedCount} ${t("strip.picked")}` : ""}` : "";
        const confidenceText = typeof confidence === "number" ? `${t("strip.confidence")} ${confidence >= 0.7 ? t("strip.confidenceHigh") : confidence >= 0.4 ? t("strip.confidenceMedium") : t("strip.confidenceLow")}` : null;
        const current = pending !== null && pending.draftAt === draft;
        const listed = total > 1 && current;
        const rootStyle = inline ? { ...stripStyle, padding: "2px 4px", marginBottom: "4px", border: "none", borderRadius: 0, background: "transparent" } : listed ? { ...stripStyle, flexDirection: "column", alignItems: "stretch", gap: "0" } : stripStyle;
        const acceptButton = pending !== null && h("button", {
          type: "button",
          onClick: () => {
            acceptRef.current?.();
          },
          disabled: pending.draftAt !== draft,
          title: pending.draftAt !== draft ? t("strip.draftChanged") : total > 1 && draft === "" ? t("strip.acceptHint") : t("strip.accept"),
          style: {
            opacity: pending.draftAt !== draft ? "0.45" : "1",
            cursor: pending.draftAt !== draft ? "not-allowed" : "pointer",
            border: "none",
            background: "var(--dsw-alias-brand-primary)",
            color: "var(--dsw-alias-bg-base)",
            borderRadius: "8px",
            padding: "3px 12px",
            fontSize: "12px",
            fontWeight: "600",
            lineHeight: "1.6",
            whiteSpace: "nowrap"
          }
        }, t("strip.accept"));
        const dismissButton = pending !== null && h("button", {
          type: "button",
          onClick: () => {
            void recordFeedback("dismiss", currentCandidate(sessionId));
            clear("dismiss");
          },
          title: t("strip.dismiss"),
          style: {
            cursor: "pointer",
            border: "1px solid var(--dsw-alias-border-l1)",
            background: "transparent",
            color: "var(--dsw-alias-label-secondary)",
            borderRadius: "8px",
            padding: "3px 10px",
            fontSize: "12px",
            lineHeight: "1.6",
            whiteSpace: "nowrap"
          }
        }, t("strip.dismiss"));
        const header = h(
          "div",
          {
            style: { display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }
          },
          h("span", { style: stripBadge }, inline && ghost !== "" ? t("strip.preview") : badge),
          // Everything that qualifies the suggestion sits in one muted run, separated by a
          // middot, so the header reads as a sentence instead of a row of competing chips.
          h("span", {
            style: {
              flex: "0 0 auto",
              minWidth: 0,
              overflow: "hidden",
              fontSize: "11px",
              lineHeight: "1.6",
              color: "var(--dsw-alias-label-secondary)",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis"
            }
          }, [confidenceText, counter, inline && total > 1 && draft === "" ? t("strip.cycle") : null].filter((part) => part !== null && part !== "").join(" \xB7 ")),
          h("span", { style: { flex: "1 1 auto" } }),
          h("span", { style: stripActions }, acceptButton, dismissButton)
        );
        const list = listed ? h(
          "div",
          {
            style: { display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" },
            role: "group",
            "aria-label": t("strip.candidates")
          },
          [...Array(total).keys()].map((index) => h(
            "button",
            {
              key: index,
              type: "button",
              "aria-pressed": pickedForSession?.has(index) === true,
              "aria-label": t("strip.rowLabel").replace("{n}", String(index + 1)).replace("{total}", String(total)),
              onClick: () => {
                candidateIndexBySession.set(sessionId, index);
                togglePicked(sessionId, index);
              },
              style: pickedForSession?.has(index) === true ? candidateRowPicked : index === candidateIndex(sessionId) ? candidateRowShown : candidateRow
            },
            h("span", {
              // On the filled row the numeral has to invert too, or it disappears.
              style: pickedForSession?.has(index) === true ? { ...candidateIndexLabel, color: "var(--dsw-alias-bg-base)" } : candidateIndexLabel
            }, `${index + 1}`),
            h("span", {
              style: pickedForSession?.has(index) === true ? candidateTextPicked : stripText
            }, String(candidateList[index] ?? ""))
          ))
        ) : h("span", { style: inline && ghost !== "" ? {
          ...stripText,
          position: "absolute",
          width: "1px",
          height: "1px",
          overflow: "hidden",
          clipPath: "inset(50%)"
        } : { ...stripText, paddingTop: "2px" } }, pending !== null ? text : "");
        return h("div", {
          style: rootStyle,
          role: "status",
          "aria-live": "polite",
          "data-composer-assist-bar": ""
        }, header, list);
      }
      function RequestTiming({ sessionId, settings, t }) {
        const [, redraw] = useState(0);
        const timing = timingBySession.get(sessionId);
        useEffect(() => {
          const off = onStoreChange(() => redraw((value) => value + 1));
          redraw((value) => value + 1);
          return off;
        }, [sessionId]);
        useEffect(() => {
          if (!settings?.enabled || !timing?.pending) return;
          const timer = setInterval(() => redraw((value) => value + 1), 500);
          return () => clearInterval(timer);
        }, [sessionId, settings?.enabled, timing?.pending]);
        if (!settings?.enabled || timing === void 0) return null;
        const elapsed = timing.pending ? performance.now() - timing.started : timing.total;
        const validation = timing.receivedAt === void 0 ? 0 : timing.pending ? performance.now() - timing.receivedAt : timing.clientValidation;
        const format = (ms) => ms === void 0 ? "\u2014" : ms < 1e3 ? `${Math.round(ms)}ms` : `${(ms / 1e3).toFixed(1)}s`;
        const values = ["queue", "prepare", "model"].map((key) => `${t(`timing.${key}`)} ${format(timing.host?.[key])}`);
        values.push(`${t("timing.validate")} ${timing.host !== null ? format(timing.host.validate + validation) : timing.receivedAt === void 0 ? "\u2014" : `\u2265${format(validation)}`}`);
        const stage = timing.host?.phase ?? timing.stage;
        const label = timing.pending ? timing.stage === "waiting" ? t("timing.waiting") : `${t("timing.validate")}\u2026` : ["timeout", "failed"].includes(timing.status) ? `${t(`timing.${timing.status}`)} \xB7 ${t(`timing.${stage}`)}` : t(`timing.${timing.status}`);
        return h("div", {
          "data-composer-timing": true,
          title: t("timing.note"),
          style: {
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 10px",
            alignItems: "center",
            boxSizing: stripStyle.boxSizing,
            width: stripStyle.width,
            maxWidth: stripStyle.maxWidth,
            margin: "0 auto",
            padding: "2px 0 4px",
            fontSize: "11px",
            lineHeight: "1.5",
            color: "var(--dsw-alias-label-secondary)"
          }
        }, [
          h("span", { key: "status", role: "status", "aria-live": "polite" }, `${t(timing.kind === "polish" ? "polish.short" : timing.kind === "complete" ? "strip.complete" : "predict.short")} \xB7 ${label}`),
          h("span", { key: "elapsed" }, `${t(timing.pending ? "timing.elapsed" : "timing.total")} ${format(elapsed)}`),
          h("span", { key: "segments" }, values.join(" \xB7 "))
        ]);
      }
      function AssistButton({ sessionId, useInput, inputActions, t, loadCatalog }) {
        const draft = useInput((state) => state.draft);
        const phase = useInput((state) => state.phase);
        trackDraft(sessionId, draft);
        const live = useRef({ sessionId, draft, phase });
        live.current = { sessionId, draft, phase };
        const mounted = useRef(true);
        useEffect(() => {
          mounted.current = true;
          return () => {
            mounted.current = false;
          };
        }, []);
        const [polishBusy, setPolishBusy] = useState(false);
        const [polishFailed, setPolishFailed] = useState(false);
        const polishIdle = draft.trim() !== "" && phase === "plain" && !polishBusy;
        const [predictBusy, setPredictBusy] = useState(false);
        const [hasSuggestion, setHasSuggestion] = useState(false);
        const busyTimer = useRef(void 0);
        useEffect(() => {
          const read = () => {
            setHasSuggestion(manualRequest.hasSuggestion?.() === true);
          };
          read();
          const timer = setInterval(read, 1e3);
          const off = manualRequest.subscribe?.(read);
          return () => {
            clearInterval(timer);
            off?.();
            clearTimeout(busyTimer.current);
          };
        }, []);
        const [open, setOpen] = useState(false);
        const [showSettings, setShowSettings] = useState(false);
        const box = useRef(null);
        const button = useRef(null);
        const menuAnchor = useRef(null);
        const [anchor, setAnchor] = useState(null);
        const openMenu = () => {
          const rect = menuAnchor.current?.getBoundingClientRect();
          if (rect !== void 0 && rect !== null) setAnchor({ left: rect.left, bottom: window.innerHeight - rect.top });
          setOpen(true);
        };
        useEffect(() => {
          if (!open) return;
          const onKey = (event) => {
            if (event.key === "Escape") {
              setShowSettings(false);
              setOpen(false);
            }
          };
          const onDown = (event) => {
            const target = event.target;
            if (box.current?.contains(target) === true || menuAnchor.current?.contains(target) === true) return;
            setShowSettings(false);
            setOpen(false);
          };
          document.addEventListener("keydown", onKey);
          document.addEventListener("mousedown", onDown);
          return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onDown);
          };
        }, [open]);
        const runPolish = async () => {
          setOpen(false);
          if (!polishIdle) return;
          setPolishBusy(true);
          setPolishFailed(false);
          try {
            const result = await runRequest("polish", sessionId, draft, "manual");
            const stillMine = () => mounted.current && live.current.sessionId === sessionId && live.current.draft === draft && live.current.phase === "plain";
            const text = result?.text ?? "";
            if (text !== "" && stillMine()) inputActions.setDraft(text);
            else if (text === "" && stillMine()) setPolishFailed(true);
          } catch {
            if (mounted.current) setPolishFailed(true);
          } finally {
            if (mounted.current) setPolishBusy(false);
          }
        };
        const runPredict = () => {
          setOpen(false);
          const fire = manualRequest.current;
          if (fire === void 0) {
            reportProbe({ phase: "click-miss", reason: "no-channel" });
            return;
          }
          if (manualRequest.isBusy?.() === true) return;
          setPredictBusy(true);
          reportProbe({ phase: "manual-fire", cause: "click" });
          try {
            fire("next");
          } catch {
          }
          const poll = () => {
            if (mounted.current !== true) return;
            if (manualRequest.isBusy?.() === true) {
              busyTimer.current = setTimeout(poll, 250);
              return;
            }
            busyTimer.current = void 0;
            setPredictBusy(false);
          };
          busyTimer.current = setTimeout(poll, 250);
        };
        const busy = polishBusy || predictBusy;
        const polishLabel = polishFailed ? t("polish.failed") : polishBusy ? t("polish.busy") : t("polish.title");
        const predictLabel = predictBusy ? t("predict.busy") : hasSuggestion ? t("predict.again") : t("predict.title");
        const item = {
          display: "flex",
          alignItems: "center",
          gap: "6px",
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          border: "none",
          background: "transparent",
          color: "var(--dsw-alias-label-primary)",
          borderRadius: "6px",
          padding: "6px 8px",
          fontSize: "12px",
          lineHeight: "1.5"
        };
        const inert = { ...item, cursor: "default", color: "var(--dsw-alias-label-secondary)", opacity: "0.6" };
        const primary = draft.trim() === "" ? "predict" : "polish";
        const primaryLabel = primary === "polish" ? polishLabel : predictLabel;
        const primaryBusy = primary === "polish" ? polishBusy : predictBusy;
        const primaryEnabled = primary === "polish" ? polishIdle : !predictBusy;
        const runPrimary = () => {
          if (primary === "polish") void runPolish();
          else runPredict();
        };
        return h(
          "div",
          { style: { position: "relative", display: "inline-flex" } },
          h(
            "div",
            {
              ref: menuAnchor,
              style: {
                display: "inline-flex",
                alignItems: "stretch",
                border: open || polishIdle ? "1px solid var(--dsw-alias-brand-primary)" : "1px solid var(--dsw-alias-border-l1)",
                background: open || polishIdle ? "var(--dsw-alias-bg-layer-1)" : "transparent",
                borderRadius: "6px",
                overflow: "hidden",
                opacity: busy ? "0.6" : "1"
              }
            },
            h("button", {
              ref: button,
              type: "button",
              onClick: runPrimary,
              // Never disabled: a stuck busy state must not make the menu unreachable.
              "aria-disabled": busy || void 0,
              title: polishFailed ? t("polish.failed") : primaryLabel,
              "aria-label": primaryLabel,
              "data-composer-assist": true,
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                cursor: primaryEnabled && !busy ? "pointer" : "default",
                border: "none",
                background: "transparent",
                color: polishFailed ? "var(--dsw-alias-state-error-primary)" : polishIdle || primary === "predict" ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-label-secondary)",
                padding: "2px 6px",
                minHeight: "24px",
                fontSize: "12px",
                fontWeight: "600",
                lineHeight: "1.5",
                whiteSpace: "nowrap"
              }
            }, [
              h("span", { key: "icon", "aria-hidden": true }, primaryBusy ? "\u22EF" : primary === "polish" ? "\u2728" : "\u2192"),
              h("span", { key: "label" }, t(primary === "polish" ? "polish.short" : "predict.short"))
            ]),
            h("button", {
              type: "button",
              onClick: () => {
                if (open) {
                  setShowSettings(false);
                  setOpen(false);
                } else openMenu();
              },
              "aria-haspopup": "menu",
              "aria-expanded": open,
              title: t("assist.more"),
              "aria-label": t("assist.more"),
              "data-composer-assist-more": true,
              style: {
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                border: "none",
                borderLeft: "1px solid var(--dsw-alias-border-l1)",
                background: open ? "var(--dsw-alias-bg-layer-2)" : "transparent",
                color: open ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-label-secondary)",
                padding: "2px 6px",
                minHeight: "24px",
                minWidth: "24px",
                fontSize: "12px",
                lineHeight: "1.5"
              }
            }, h("span", { "aria-hidden": true }, "\u2699"))
          ),
          open && h(
            "div",
            {
              ref: box,
              role: "menu",
              "aria-label": t("assist.more"),
              "data-composer-assist-menu": true,
              style: {
                position: "fixed",
                zIndex: 60,
                left: `${anchor?.left ?? 0}px`,
                bottom: `${anchor?.bottom ?? 0}px`,
                minWidth: showSettings ? "min(440px, calc(100vw - 32px))" : "180px",
                maxWidth: "calc(100vw - 24px)",
                boxSizing: "border-box",
                padding: "4px",
                maxHeight: "min(70vh, 560px)",
                overflowY: "auto",
                border: "1px solid var(--dsw-alias-border-l1)",
                borderRadius: "10px",
                background: "var(--dsw-alias-bg-layer-1)",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)"
              }
            },
            h("button", {
              type: "button",
              role: "menuitem",
              disabled: !polishIdle,
              onClick: () => {
                void runPolish();
              },
              title: polishLabel,
              style: polishIdle ? item : inert
            }, [
              h("span", { key: "icon", "aria-hidden": true }, polishBusy ? "\u22EF" : "\u2728"),
              h("span", { key: "label" }, polishLabel)
            ]),
            h("button", {
              type: "button",
              role: "menuitem",
              "aria-disabled": predictBusy || void 0,
              onClick: runPredict,
              title: predictLabel,
              style: predictBusy ? inert : item
            }, [
              h("span", { key: "icon", "aria-hidden": true }, predictBusy ? "\u22EF" : "\u2192"),
              h("span", { key: "label" }, predictLabel)
            ]),
            h(
              "div",
              { style: { borderTop: "1px solid var(--dsw-alias-border-l1)", margin: "4px 0 0", paddingTop: "4px" } },
              h("button", {
                type: "button",
                role: "menuitem",
                "aria-expanded": showSettings,
                onClick: () => setShowSettings((value) => !value),
                title: t("settings.title"),
                style: item
              }, [
                h("span", { key: "icon", "aria-hidden": true }, "\u2699"),
                h("span", { key: "label" }, t("settings.title"))
              ]),
              showSettings && h(
                "div",
                { style: { padding: "4px 4px 8px" } },
                h(SettingsSection, { t, loadCatalog, embedded: true })
              )
            )
          )
        );
      }
      function ModelPicker({ catalog, value, t, loading, error, onOpen, onPick }) {
        const [open, setOpen] = useState(false);
        const [query, setQuery] = useState("");
        const box = useRef(null);
        const field = useRef(null);
        useEffect(() => {
          if (!open) return;
          const onDown = (event) => {
            if (box.current?.contains(event.target) === true) return;
            setOpen(false);
          };
          const onKey = (event) => {
            if (event.key === "Escape") setOpen(false);
          };
          document.addEventListener("mousedown", onDown);
          document.addEventListener("keydown", onKey);
          return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
          };
        }, [open]);
        const selected = catalog.find((entry) => `${entry.provider}\0${entry.id}` === value);
        const label = selected === void 0 ? value === "" ? t("settings.model.inherit") : value.replace("\0", " \xB7 ") : `${selected.provider} \xB7 ${selected.name}`;
        const needle = query.trim().toLowerCase();
        const pickerField = {
          background: "var(--dsw-alias-bg-layer-2)",
          color: "var(--dsw-alias-label-primary)",
          border: "1px solid var(--dsw-alias-border-l1)",
          borderRadius: "8px",
          padding: "6px 10px",
          fontSize: "13px"
        };
        const matches = needle === "" ? catalog : catalog.filter((entry) => `${entry.provider} ${entry.id} ${entry.name}`.toLowerCase().includes(needle));
        const option = {
          display: "flex",
          alignItems: "baseline",
          gap: "8px",
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          border: "none",
          background: "transparent",
          color: "var(--dsw-alias-label-primary)",
          borderRadius: "6px",
          padding: "6px 8px",
          fontSize: "12px",
          lineHeight: "1.5"
        };
        return h(
          "div",
          { ref: box, style: { position: "relative", minWidth: "260px" } },
          h(
            "button",
            {
              type: "button",
              "aria-haspopup": "listbox",
              "aria-expanded": open,
              "data-model-picker": true,
              title: label,
              onClick: () => {
                const next = !open;
                setOpen(next);
                if (next) {
                  setQuery("");
                  onOpen?.();
                  field.current?.focus();
                }
              },
              style: {
                ...pickerField,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                cursor: "pointer",
                textAlign: "left"
              }
            },
            h("span", { style: { flex: "1 1 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label),
            h("span", { "aria-hidden": true, style: { color: "var(--dsw-alias-label-secondary)" } }, "\u25BE")
          ),
          open && h(
            "div",
            {
              style: {
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                zIndex: 40,
                width: "min(360px, 80vw)",
                boxSizing: "border-box",
                padding: "6px",
                border: "1px solid var(--dsw-alias-border-l1)",
                borderRadius: "10px",
                background: "var(--dsw-alias-bg-layer-1)"
              }
            },
            h("input", {
              ref: field,
              type: "search",
              value: query,
              placeholder: t("settings.model.search"),
              "aria-label": t("settings.model.search"),
              onChange: (event) => setQuery(event.target.value),
              style: { ...pickerField, width: "100%", minWidth: 0, marginBottom: "6px", boxSizing: "border-box" }
            }),
            h(
              "div",
              { role: "listbox", style: { maxHeight: "240px", overflowY: "auto" } },
              h("button", {
                type: "button",
                role: "option",
                "aria-selected": value === "",
                onClick: () => {
                  onPick?.(null);
                  setOpen(false);
                },
                style: option
              }, t("settings.model.inherit")),
              matches.map((entry) => h(
                "button",
                {
                  key: `${entry.provider}\0${entry.id}`,
                  type: "button",
                  role: "option",
                  "aria-selected": `${entry.provider}\0${entry.id}` === value,
                  onClick: () => {
                    onPick?.(entry);
                    setOpen(false);
                  },
                  style: `${entry.provider}\0${entry.id}` === value ? { ...option, background: "var(--dsw-alias-bg-layer-2)" } : option
                },
                h("span", { style: { flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" } }, entry.name),
                h("span", { style: { flex: "0 0 auto", fontSize: "11px", color: "var(--dsw-alias-label-secondary)" } }, entry.provider)
              )),
              // Say which of the three reasons applies: a failed read, a slow one, or a
              // filter that simply matched nothing. They need different user actions.
              matches.length === 0 && h("div", {
                style: {
                  padding: "8px",
                  fontSize: "12px",
                  lineHeight: "1.5",
                  color: error !== "" ? "var(--dsw-alias-state-error-primary)" : "var(--dsw-alias-label-secondary)",
                  wordBreak: "break-word"
                }
              }, error !== "" ? error : loading ? t("settings.model.loading") : t("settings.model.noMatch"))
            )
          )
        );
      }
      function SettingsSection({ t, loadCatalog, embedded = false }) {
        const [settings, setSettings] = useState(settingsStore.value);
        const [catalog, setCatalog] = useState([]);
        const [error, setError] = useState("");
        useEffect(() => {
          if (settingsStore.value === null) void readSettings();
          return settingsStore.subscribe(() => {
            setSettings(settingsStore.value);
          });
        }, []);
        useEffect(() => {
          if (settingsStore.value !== null) void refreshCatalog();
        }, [settings !== null]);
        const save = async (patch) => {
          setError("");
          const body = await saveSettings(patch);
          if (body?.ok !== true) setError(t("settings.saveFailed"));
        };
        const [catalogState, setCatalogState] = useState("idle");
        const [catalogError, setCatalogError] = useState("");
        const refreshCatalog = async () => {
          if (catalog.length > 0 || catalogState === "loading") return;
          setCatalogState("loading");
          setCatalogError("");
          try {
            const rows = await loadCatalog();
            setCatalog(Array.isArray(rows) ? rows : []);
            setCatalogState("done");
          } catch (failure) {
            setCatalogError(failure instanceof Error ? failure.message : String(failure));
            setCatalogState("failed");
          }
        };
        const current = settings;
        const labelStyle = { fontSize: "13px", fontWeight: "600", lineHeight: "1.5", color: "var(--dsw-alias-label-primary)" };
        const hintStyle = { fontSize: "12px", lineHeight: "1.5", color: "var(--dsw-alias-label-secondary)", marginTop: "1px" };
        const selectStyle = {
          background: "var(--dsw-alias-bg-layer-2)",
          color: "var(--dsw-alias-label-primary)",
          border: "1px solid var(--dsw-alias-border-l1)",
          borderRadius: "8px",
          padding: "6px 10px",
          fontSize: "13px",
          lineHeight: "1.5",
          // Sized to its own longest option, not a fixed width: a hard 200px clipped
          // "输入框上方的建议栏（推荐）" mid-word.
          boxSizing: "border-box",
          width: "auto",
          minWidth: "210px",
          maxWidth: "300px"
        };
        const value = current?.provider !== void 0 && current?.provider !== "" ? `${current.provider}\0${current.model}` : "";
        const number = (key, min, max) => h("input", {
          type: "number",
          min,
          max,
          value: current?.[key] ?? "",
          onChange: (event) => {
            const parsed = Number(event.target.value);
            if (Number.isFinite(parsed)) void save({ [key]: parsed });
          },
          style: { ...selectStyle, minWidth: "120px" }
        });
        const sectionHeading = (title) => h("div", {
          style: {
            fontSize: "12px",
            fontWeight: "600",
            lineHeight: "1.5",
            color: "var(--dsw-alias-label-secondary)",
            margin: "20px 0 2px"
          }
        }, title);
        const control = {
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "10px"
        };
        const settingRow = (label, hint, node, { top = true } = {}) => h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "24px",
              padding: "11px 0",
              borderTop: top ? "1px solid var(--dsw-alias-border-l1)" : "none"
            }
          },
          h(
            "div",
            { style: { minWidth: 0 } },
            h("div", { style: labelStyle }, label),
            h("div", { style: hintStyle }, hint)
          ),
          h("div", { style: control }, node)
        );
        const toggle = (key, checked) => h("input", {
          type: "checkbox",
          checked,
          onChange: (event) => {
            void save({ [key]: event.target.checked });
          }
        });
        const modeValue = current?.mode ?? "auto";
        const displayValue = current?.display === "inline" ? "inline" : "bar";
        const unit = (key, bounds, suffix, per = 1) => {
          const stored = current?.[key];
          const shown = Number.isFinite(stored) ? stored / per : "";
          return h(
            "div",
            {
              style: { display: "flex", alignItems: "center", gap: "8px" }
            },
            h("input", {
              type: "number",
              step: key === "minConfidence" ? 0.05 : per === 1 ? 1 : 0.5,
              min: bounds[0] / per,
              max: bounds[1] / per,
              value: shown,
              onChange: (event) => {
                const parsed = Number(event.target.value);
                if (!Number.isFinite(parsed)) return;
                void save({ [key]: key === "minConfidence" ? parsed : Math.round(parsed * per) });
              },
              style: { ...selectStyle, width: "110px", minWidth: "110px", textAlign: "right" }
            }),
            h("span", {
              style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)", minWidth: "26px" }
            }, suffix)
          );
        };
        return h(
          "div",
          { style: { padding: embedded ? "0" : "4px 0 32px", maxWidth: "680px" } },
          // No heading at all. The settings nav already labels this page, and the popover
          // is opened from a menu item that names it — a third copy was pure repetition.
          h("p", {
            style: {
              fontSize: "12px",
              lineHeight: "1.6",
              margin: "0 0 2px",
              color: "var(--dsw-alias-label-secondary)"
            }
          }, t("settings.description")),
          sectionHeading(t("settings.group.behavior")),
          h(
            "div",
            null,
            settingRow(
              t("settings.enabled"),
              t("settings.enabledHint"),
              toggle("enabled", current?.enabled === true),
              { top: false }
            ),
            settingRow(
              t("settings.mode"),
              t("settings.modeHint"),
              h("select", {
                style: selectStyle,
                value: modeValue,
                onChange: (event) => {
                  void save({ mode: event.target.value });
                }
              }, ["auto", "word", "both", "off"].map((mode) => h("option", { key: mode, value: mode }, t(`settings.mode.${mode}`))))
            ),
            settingRow(
              t("settings.display"),
              t("settings.displayHint"),
              h("select", {
                style: selectStyle,
                value: displayValue,
                onChange: (event) => {
                  void save({ display: event.target.value });
                }
              }, ["bar", "inline"].map((display) => h("option", { key: display, value: display }, t(`settings.display.${display}`))))
            ),
            settingRow(
              t("settings.model"),
              t("settings.modelHint"),
              h(ModelPicker, {
                catalog,
                value,
                t,
                loading: catalogState === "loading",
                error: catalogState === "failed" ? catalogError : "",
                onOpen: () => {
                  void refreshCatalog();
                },
                onPick: (entry) => {
                  void save(entry === null ? { provider: "", model: "" } : { provider: entry.provider, model: entry.id });
                }
              })
            )
          ),
          sectionHeading(t("settings.group.budget")),
          h(
            "div",
            null,
            settingRow(
              t("settings.maxOutputTokens"),
              t("settings.maxOutputTokensHint"),
              unit("maxOutputTokens", [100, 4e3], "tok"),
              { top: false }
            ),
            settingRow(
              t("settings.debounceMs"),
              t("settings.debounceMsHint"),
              unit("debounceMs", [200, 5e3], "s", 1e3)
            ),
            settingRow(
              t("settings.timeoutMs"),
              t("settings.timeoutMsHint"),
              unit("timeoutMs", [2e3, 12e4], "s", 1e3)
            ),
            settingRow(
              t("settings.maxInputChars"),
              t("settings.maxInputCharsHint"),
              unit("maxInputChars", [1e3, 1e5], "chars")
            ),
            settingRow(
              t("settings.minConfidence"),
              t("settings.minConfidenceHint"),
              unit("minConfidence", [0, 1], "0\u20131")
            )
          ),
          // One way back: a mistyped budget or timeout had no undo except remembering the
          // old number. Values come from the Host's own DEFAULTS, not a client copy.
          h(
            "div",
            { style: { display: "flex", justifyContent: "flex-end", padding: "10px 0 0" } },
            h("button", {
              type: "button",
              onClick: async () => {
                const d = settingsStore.defaults;
                if (d === void 0) return;
                setError("");
                const patch = {};
                for (const key of ["maxOutputTokens", "debounceMs", "timeoutMs", "maxInputChars", "minConfidence"]) {
                  if (d[key] !== void 0) patch[key] = d[key];
                }
                const body = await saveSettings(patch);
                if (body?.ok !== true) setError(t("settings.saveFailed"));
              },
              title: t("settings.restoreHint"),
              style: {
                cursor: "pointer",
                border: "none",
                background: "transparent",
                color: "var(--dsw-alias-label-secondary)",
                padding: "2px 4px",
                fontSize: "12px",
                textDecoration: "underline"
              }
            }, t("settings.restore"))
          ),
          sectionHeading(t("settings.group.learning")),
          h(
            "div",
            null,
            settingRow(
              t("settings.learn"),
              t("settings.learnHint"),
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "10px" } },
                toggle("learn", current?.learn === true),
                h("button", {
                  type: "button",
                  onClick: async () => {
                    setError("");
                    const body = await recordFeedback("reset", "");
                    if (body?.ok !== true) setError(t("settings.resetFailed"));
                    await readSettings();
                  },
                  title: t("settings.resetHint"),
                  style: {
                    cursor: "pointer",
                    border: "1px solid var(--dsw-alias-border-l1)",
                    background: "transparent",
                    color: "var(--dsw-alias-label-secondary)",
                    borderRadius: "8px",
                    padding: "5px 12px",
                    fontSize: "12px"
                  }
                }, t("settings.reset"))
              ),
              { top: false }
            )
          ),
          h("p", {
            style: {
              fontSize: "12px",
              lineHeight: "1.6",
              margin: "20px 0 0",
              color: "var(--dsw-alias-label-secondary)"
            }
          }, t("settings.costNote")),
          h("p", {
            style: {
              fontSize: "12px",
              lineHeight: "1.6",
              margin: "8px 0 0",
              color: "var(--dsw-alias-label-secondary)"
            }
          }, t("settings.subagentNote")),
          error !== "" && h("p", { style: { fontSize: "12px", color: "var(--dsw-alias-state-error-primary)", marginTop: "12px" } }, error)
        );
      }
      return {
        inject: ["slots", "locale", "shortcuts", "remote", "remote.session"],
        apply(ctx) {
          installWorkflowUI(ctx, React);
          ctx.effect(() => ctx.locale.register(NS2, { zh: zh2, en: en2 }), "composer-assist: dictionaries");
          void readSettings();
          const t = ctx.locale.bind(NS2);
          const loadCatalog = async () => {
            const response = await fetch(`${API2}/models`);
            let body;
            try {
              body = await readJsonResponse(response, "models");
            } catch (failure) {
              if (!response.ok) throw new Error(`${t("settings.model.routeMissing")} (HTTP ${response.status})`);
              throw new Error(`${t("settings.model.badResponse")}: ${failure.message}`);
            }
            if (body.ok !== true) throw new Error(body.error ?? body.reason ?? t("settings.model.badResponse"));
            if (!Array.isArray(body.models)) throw new Error(t("settings.model.badResponse"));
            const rows = [];
            for (const entry of body.models) {
              if (entry === null || typeof entry !== "object") continue;
              if (typeof entry.provider !== "string" || typeof entry.id !== "string") continue;
              rows.push({
                provider: entry.provider,
                id: entry.id,
                name: typeof entry.name === "string" && entry.name !== "" ? entry.name : entry.id
              });
            }
            return rows;
          };
          const useSettings = () => {
            const [value, setValue] = useState(settingsStore.value);
            useEffect(() => {
              setValue(settingsStore.value);
              return settingsStore.subscribe(() => {
                setValue(settingsStore.value);
              });
            }, []);
            return value;
          };
          function StripSlot(props) {
            const settings = useSettings();
            return h(
              React.Fragment,
              null,
              h(SuggestionStrip, { ...props, settings, t }),
              h(RequestTiming, { sessionId: props.sessionId, settings, t })
            );
          }
          ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
            name: "conversation.input.dock",
            id: "composer-assist",
            order: 10,
            locale: NS2
          }, StripSlot));
          ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
            name: "conversation.input.left",
            id: "composer-assist-assist",
            order: 10,
            locale: NS2,
            inject: () => ({ loadCatalog })
          }, AssistButton));
          ctx.slots.inject("settings.section", () => ctx.slots.register({
            name: "settings.section",
            id: "composer-assist",
            order: 35,
            locale: NS2,
            // Short label: this is a nav row, and the full name lives in the menu item.
            label: () => t("settings.nav"),
            inject: () => ({ loadCatalog })
          }, SettingsSection));
          ctx.effect(() => () => {
            disposeGhosts();
          }, "composer-assist: release inline ghost");
          ctx.effect(() => ctx.shortcuts.observeFixedInput((input) => {
            if (input.type !== "keydown") return;
            if (input.gesture.code !== "Tab") return;
            if (input.gesture.shift || input.gesture.control || input.gesture.alt || input.gesture.meta) return;
            if (input.gesture.composing || input.gesture.defaultPrevented) return;
            if (input.context.region !== "editable" || input.context.modal !== null) return;
            const focused = document.activeElement;
            if (!(focused instanceof Element) || focused.closest("[data-composer-input]") === null) return;
            if (acceptRef.current?.() !== true) return;
            input.consume();
          }), "composer-assist: Tab accepts a prediction");
        }
      };
    }
  });
})();