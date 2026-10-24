// workflow/host/compiler-worker.js
import { parentPort, workerData } from "node:worker_threads";

// workflow/host/compile-sync.js
import {
  analyzeWorkflowScript,
  createWorkflowProgram,
  collectSites,
  synthesizeAskSchemas,
  buildAskSpecs,
  lowerWorkflow,
  collectSitePhases,
  collectPhaseNames,
  inputHash,
  spliceHoleBody,
  checkSiteStability
} from "@zcode/dynamic-workflow";
var cache = /* @__PURE__ */ new Map();
var plain = (value) => JSON.parse(JSON.stringify(value, (_key, item) => item instanceof Map ? Object.fromEntries(item) : item instanceof Set ? [...item] : item));
function compile(script) {
  if (typeof script !== "string" || !script.trim() || Buffer.byteLength(script) > 512 * 1024) throw new Error("\u5DE5\u4F5C\u6D41\u811A\u672C\u5FC5\u987B\u662F\u975E\u7A7A TypeScript\uFF0C\u4E14\u4E0D\u8D85\u8FC7 512 KiB");
  if (cache.has(script)) return cache.get(script);
  const analysis = analyzeWorkflowScript(script);
  const program = createWorkflowProgram(script);
  const table = collectSites(program);
  const synthesis = synthesizeAskSchemas(program, table);
  const diagnostics = [...analysis.diagnostics, ...synthesis.diagnostics];
  const publicAnalysis = plain({ ...analysis, core: void 0, diagnostics, ok: analysis.ok && synthesis.diagnostics.length === 0, schemas: synthesis.schemas, phases: collectPhaseNames(analysis.flow) });
  const lowered = publicAnalysis.ok ? lowerWorkflow(program, table) : void 0;
  const compiled = { analysis: publicAnalysis, table, askSpecs: buildAskSpecs(table, synthesis.schemas), lowered, sitePhases: analysis.core ? collectSitePhases(analysis.core) : /* @__PURE__ */ new Map(), hash: inputHash(script) };
  cache.set(script, compiled);
  return compiled;
}
function requireCompiled(script) {
  const compiled = compile(script);
  if (!compiled.analysis.ok) {
    const error = new Error(compiled.analysis.diagnostics.map((d) => `${d.line}:${d.column} ${d.message}`).join("\n"));
    error.code = "WorkflowCompileError";
    error.diagnostics = compiled.analysis.diagnostics;
    throw error;
  }
  return compiled;
}
function compileHole(script, siteId, body) {
  if (typeof body !== "string" || !body.trim()) throw new Error("\u7559\u767D\u8865\u5168\u4EE3\u7801\u4E0D\u80FD\u4E3A\u7A7A");
  const before = requireCompiled(script);
  const splice = spliceHoleBody(script, before.table, siteId, body);
  if (!splice) throw new Error("\u8BE5\u7559\u767D\u4E0D\u5B58\u5728\u6216\u5DF2\u7ECF\u8865\u5168");
  const next = requireCompiled(splice.text);
  const stable = checkSiteStability(before.table, next.table, siteId, splice.insertedAtLine, splice.insertedLines);
  if (!stable.ok) throw new Error(stable.detail);
  return { script: splice.text, compiled: next };
}

// workflow/host/compiler-worker.js
var pack = ({ table: _table, ...compiled }) => compiled;
try {
  const value = workerData.kind === "hole" ? (() => {
    const result = compileHole(workerData.script, workerData.siteId, workerData.body);
    return { script: result.script, compiled: pack(result.compiled) };
  })() : pack(compile(workerData.script));
  const serialized = JSON.stringify(value, (_key, item) => item instanceof Map ? Object.fromEntries(item) : item);
  if (Buffer.byteLength(serialized) > 8 * 1024 * 1024) throw Object.assign(new Error("\u5DE5\u4F5C\u6D41\u5206\u6790\u4EA7\u7269\u8D85\u8FC7 8 MiB\uFF0C\u8BF7\u7F29\u5C0F\u6D41\u7A0B\u89C4\u6A21\u6216\u51CF\u5C11\u5C55\u5F00\u7684\u8F85\u52A9\u51FD\u6570"), { code: "WorkflowAnalysisLimit" });
  parentPort.postMessage({ ok: true, value });
} catch (error) {
  parentPort.postMessage({ ok: false, error: { message: error.message, code: error.code ?? "WorkflowCompileError", diagnostics: error.diagnostics } });
}
