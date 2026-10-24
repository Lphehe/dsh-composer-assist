// workflow/plugin.js
import { FACADE_DTS, SNIPPET_FACADE_DTS } from "@zcode/dynamic-workflow";

// workflow/host/manager.js
import { randomUUID as randomUUID2 } from "node:crypto";
import { join as join3 } from "node:path";
import { homedir } from "node:os";
import { mkdirSync as mkdirSync3 } from "node:fs";
import { runWorkflowScript } from "@zcode/dynamic-workflow-runtime";
import { validate as validate2, inputHash, refToString as refToString3 } from "@zcode/dynamic-workflow";

// workflow/host/journal.js
import { mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
var json = (value) => JSON.stringify(value);
var parse = (row) => row === void 0 ? void 0 : JSON.parse(row.data);
var marks = (values) => values.map(() => "?").join(",");
async function openJournal(directory) {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = await import("node:sqlite"));
  } catch (cause) {
    throw new Error("\u52A8\u6001\u5DE5\u4F5C\u6D41\u9700\u8981\u652F\u6301 node:sqlite \u7684 Host Node \u8FD0\u884C\u65F6", { cause });
  }
  mkdirSync(directory, { recursive: true, mode: 448 });
  const path = join(directory, "workflow.sqlite");
  const db = new DatabaseSync(path);
  chmodSync(path, 384);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, owner TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS actors (id INTEGER PRIMARY KEY, run TEXT REFERENCES runs(id), site TEXT, ordinal INTEGER, data TEXT NOT NULL, UNIQUE(run,site,ordinal));
    CREATE TABLE IF NOT EXISTS nodes (id INTEGER PRIMARY KEY, run TEXT REFERENCES runs(id), site TEXT, ordinal INTEGER, kind TEXT, data TEXT NOT NULL, result TEXT, UNIQUE(run,site,ordinal));
    CREATE TABLE IF NOT EXISTS events (run TEXT REFERENCES runs(id), sequence INTEGER, type TEXT, data TEXT NOT NULL, item TEXT, time INTEGER, PRIMARY KEY(run,sequence));
    CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, owner TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS effects (id TEXT PRIMARY KEY, run TEXT REFERENCES runs(id), state TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS artifacts (run TEXT REFERENCES runs(id), id TEXT, version INTEGER, bytes BLOB NOT NULL, data TEXT NOT NULL, PRIMARY KEY(run,id,version));
    CREATE INDEX IF NOT EXISTS nodes_run_kind ON nodes(run,kind,id);
    CREATE INDEX IF NOT EXISTS events_run_type ON events(run,type,sequence);
    CREATE INDEX IF NOT EXISTS documents_owner_kind ON documents(owner,kind);
    CREATE INDEX IF NOT EXISTS effects_run_state ON effects(run,state);`);
  const statement = (sql) => db.prepare(sql);
  const displayStatus = `CASE WHEN json_extract(n.data,'$.status')='running' AND n.kind='ask' AND
    (SELECT json_extract(e.data,'$.outcome') FROM events e WHERE e.run=n.run
      AND e.type IN ('node-queued','node-dispatched','node-settled')
      AND json_extract(e.data,'$.instance.siteId')=n.site AND json_extract(e.data,'$.instance.ordinal')=n.ordinal
      ORDER BY e.sequence DESC LIMIT 1)='cancelled'
    THEN 'cancelled' WHEN json_extract(n.data,'$.status')='running' AND n.kind='ask'
      AND (SELECT json_extract(r.data,'$.status') FROM runs r WHERE r.id=n.run)='stopped'
    THEN 'stopped' ELSE json_extract(n.data,'$.status') END`;
  const requireRun = (id) => {
    const row = journal.getRun(id);
    if (!row) throw new Error(`journal: unknown run ${id}`);
    return row;
  };
  const updateRun = (id, change) => {
    const row = requireRun(id);
    change(row);
    statement("UPDATE runs SET data=? WHERE id=?").run(json(row), id);
  };
  const journal = {
    createRun(record) {
      statement("INSERT INTO runs VALUES (?,?,?)").run(record.runId, record.parentSessionId ?? "", json(record));
    },
    getRun(id) {
      return parse(statement("SELECT data FROM runs WHERE id=?").get(id));
    },
    listRuns(owner, limit = 100) {
      return statement("SELECT data FROM runs WHERE owner=? ORDER BY rowid DESC LIMIT ?").all(owner, limit).map(parse);
    },
    updateRunStatus(id, status, settlement) {
      updateRun(id, (record) => {
        record.status = status;
        for (const key of ["failure", "stopReason", "supersededBy"]) delete record[key];
        if (status === "pending" || status === "running") delete record.result;
        else {
          for (const key of ["failure", "stopReason", "supersededBy"]) if (settlement?.[key] !== void 0) record[key] = settlement[key];
          if (settlement?.result !== void 0) record.result = settlement.result;
        }
      });
    },
    updateRunUsage(id, spentTokens) {
      updateRun(id, (record) => {
        record.spentTokens = spentTokens;
      });
    },
    updateRunCaps(id, caps) {
      updateRun(id, (record) => {
        record.caps = caps;
      });
    },
    updateRunScript(id, scriptText, scriptHash) {
      updateRun(id, (record) => {
        Object.assign(record, { scriptText, scriptHash });
      });
    },
    putActor(record) {
      statement("INSERT INTO actors(run,site,ordinal,data) VALUES(?,?,?,?) ON CONFLICT(run,site,ordinal) DO UPDATE SET data=excluded.data").run(record.runId, record.siteId, record.ordinal, json(record));
    },
    getActor(run, site, ordinal) {
      return parse(statement("SELECT data FROM actors WHERE run=? AND site=? AND ordinal=?").get(run, site, ordinal));
    },
    listActors(run, opts) {
      const rows = statement(`SELECT data FROM actors WHERE run=?${opts.name === void 0 ? "" : " AND json_extract(data,'$.name')=?"} ORDER BY id`).all(...opts.name === void 0 ? [run] : [run, opts.name]).map(parse);
      if (!opts.withPersona) for (const row of rows) delete row.persona;
      return rows;
    },
    putNode(record) {
      const { result, ...rest } = record;
      statement("INSERT INTO nodes(run,site,ordinal,kind,data,result) VALUES(?,?,?,?,?,?) ON CONFLICT(run,site,ordinal) DO UPDATE SET kind=excluded.kind,data=excluded.data,result=excluded.result").run(record.runId, record.siteId, record.ordinal, record.kind, json(rest), result === void 0 ? null : json(result));
    },
    getNode(run, site, ordinal, opts) {
      const row = statement(`SELECT data${opts?.withResult === false ? "" : ",result"} FROM nodes WHERE run=? AND site=? AND ordinal=?`).get(run, site, ordinal);
      if (!row) return void 0;
      const value = parse(row);
      if (row.result !== void 0 && row.result !== null) value.result = JSON.parse(row.result);
      return value;
    },
    listNodes(run, opts) {
      if (opts.kinds !== "all" && opts.kinds.length === 0) return [];
      const bindings = [run, ...opts.kinds === "all" ? [] : opts.kinds];
      const filter = opts.kinds === "all" ? "" : ` AND kind IN (${marks(opts.kinds)})`;
      const rows = statement(`SELECT data${opts.withResult ? ",result" : ""} FROM nodes WHERE run=?${filter} ORDER BY id LIMIT ?`).iterate(...bindings, opts.limit ?? -1);
      const results = [];
      let bytes = 0;
      for (const row of rows) {
        const length = row.result === null || row.result === void 0 ? 0 : Buffer.byteLength(row.result);
        if (opts.withResult && opts.maxResultBytes !== void 0 && results.length > 0 && bytes + length > opts.maxResultBytes) break;
        const value = parse(row);
        if (row.result !== void 0 && row.result !== null) value.result = JSON.parse(row.result);
        results.push(value);
        bytes += length;
      }
      return results;
    },
    pageNodes(run, { after = 0, limit = 300, maxResultBytes = 2 * 1024 * 1024, kinds = ["ask", "world-read", "world-run"], artifactId } = {}) {
      if (!kinds.length) return { nodes: [], nextCursor: after, hasMore: false };
      const rows = statement(`SELECT id,json_set(n.data,'$.status',${displayStatus}) AS data,result FROM nodes n WHERE run=? AND id>? AND kind IN (${marks(kinds)})${artifactId === void 0 ? "" : " AND json_extract(n.data,'$.artifactId')=?"} ORDER BY id LIMIT ?`).iterate(run, after, ...kinds, ...artifactId === void 0 ? [] : [artifactId], limit + 1);
      const nodes = [];
      let bytes = 0;
      let nextCursor = after;
      let hasMore = false;
      for (const row of rows) {
        const length = row.result === null ? 0 : Buffer.byteLength(row.result);
        if (nodes.length >= limit || nodes.length > 0 && bytes + length > maxResultBytes) {
          hasMore = true;
          break;
        }
        const value = parse(row);
        if (row.result !== null) value.result = JSON.parse(row.result);
        nodes.push(value);
        nextCursor = row.id;
        bytes += length;
      }
      return { nodes, nextCursor, hasMore };
    },
    siteStates(run) {
      return statement(`SELECT site AS siteId,${displayStatus} AS status,count(*) AS count FROM nodes n WHERE run=? AND kind IN ('ask','world-read','world-run') GROUP BY site,status`).all(run);
    },
    countNodes(run, kind) {
      return statement("SELECT count(*) AS count FROM nodes WHERE run=? AND kind=?").get(run, kind).count;
    },
    sumResultBytes(run, kind) {
      return statement("SELECT coalesce(sum(length(CAST(result AS BLOB))),0) AS bytes FROM nodes WHERE run=? AND kind=?").get(run, kind).bytes;
    },
    appendEvent(run, event) {
      const { item, ...rest } = event;
      const timeCreated = Date.now();
      const sequence = statement("SELECT coalesce(max(sequence)+1,0) AS seq FROM events WHERE run=?").get(run).seq;
      statement("INSERT INTO events VALUES(?,?,?,?,?,?)").run(run, sequence, event.type, json(rest), item === void 0 ? null : json(item), timeCreated);
      return { sequence, event: structuredClone(event), timeCreated };
    },
    listEvents(run, opts) {
      if (opts.types !== "all" && opts.types.length === 0) return [];
      const bindings = [run, ...opts.types === "all" ? [] : opts.types, opts.afterSequence ?? -1, opts.limit ?? -1];
      const filter = opts.types === "all" ? "" : ` AND type IN (${marks(opts.types)})`;
      return statement(`SELECT sequence,data,time${opts.reportItems === "all" ? ",item" : `,CASE WHEN (SELECT count(*) FROM events p WHERE p.run=e.run AND p.type='report' AND p.sequence<=e.sequence)<=${Math.max(0, Math.floor(opts.reportItems.limit))} THEN item ELSE NULL END AS item`} FROM events e WHERE run=?${filter} AND sequence>? ORDER BY sequence LIMIT ?`).all(...bindings).map((row) => {
        const event = parse(row);
        if (row.item !== null) event.item = JSON.parse(row.item);
        return { sequence: row.sequence, event, timeCreated: row.time };
      });
    },
    lastSequence(run) {
      return statement("SELECT coalesce(max(sequence),-1) AS seq FROM events WHERE run=?").get(run).seq;
    },
    putDocument(id, owner, kind, value) {
      statement("INSERT INTO documents VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,kind=excluded.kind,data=excluded.data").run(id, owner, kind, json(value));
    },
    getDocument(id) {
      return parse(statement("SELECT data FROM documents WHERE id=?").get(id));
    },
    listDocuments(owner, kind, limit = 100) {
      return statement("SELECT data FROM documents WHERE owner=? AND kind=? ORDER BY rowid DESC LIMIT ?").all(owner, kind, limit).map(parse);
    },
    listQuestions(run) {
      return statement("SELECT data FROM documents WHERE owner=? AND kind='question' ORDER BY CASE WHEN json_extract(data,'$.status')='waiting' THEN 0 ELSE 1 END,rowid DESC LIMIT 100").all(run).map(parse);
    },
    putEffect(record) {
      statement("INSERT INTO effects VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,data=excluded.data").run(record.id, record.runId, record.state, json(record));
    },
    getEffect(id) {
      return parse(statement("SELECT data FROM effects WHERE id=?").get(id));
    },
    listEffects(run, state) {
      return statement(`SELECT data FROM effects WHERE run=?${state === void 0 ? "" : " AND state=?"} ORDER BY rowid`).all(...state === void 0 ? [run] : [run, state]).map(parse);
    },
    putArtifact(run, id, version, bytes, record) {
      statement("INSERT INTO artifacts VALUES(?,?,?,?,?)").run(run, id, version, bytes, json(record));
    },
    getArtifact(run, id, version) {
      const row = statement("SELECT bytes,data FROM artifacts WHERE run=? AND id=? AND version=?").get(run, id, version);
      return row && { bytes: row.bytes, record: parse(row) };
    },
    transaction(work) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const value = work();
        db.exec("COMMIT");
        return value;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    close() {
      db.close();
    }
  };
  return journal;
}

// workflow/host/compile.js
import { Worker } from "node:worker_threads";
var queue = [];
var running = false;
var invalid = (message) => Object.assign(new Error(message), { code: "WorkflowAnalysisLimit" });
var checkSource = (script) => {
  if (typeof script !== "string" || !script.trim() || Buffer.byteLength(script) > 512 * 1024) throw invalid("\u5DE5\u4F5C\u6D41\u811A\u672C\u5FC5\u987B\u662F\u975E\u7A7A TypeScript\uFF0C\u4E14\u4E0D\u8D85\u8FC7 512 KiB");
};
function runWorker(data, signal, timeoutMs = 1e4) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./compiler-worker.js", import.meta.url), { workerData: data, execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 384, stackSizeMb: 4 } });
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      worker.terminate().catch(() => {
      }).then(() => error ? reject(error) : resolve(value));
    };
    const abort = () => finish(signal.reason instanceof Error ? signal.reason : new Error("\u5DE5\u4F5C\u6D41\u5206\u6790\u5DF2\u53D6\u6D88"));
    const timer = setTimeout(() => finish(invalid("\u5DE5\u4F5C\u6D41\u5206\u6790\u8D85\u8FC7 10 \u79D2\uFF0C\u8BF7\u7F29\u5C0F\u6D41\u7A0B\u89C4\u6A21\u6216\u51CF\u5C11\u8F85\u52A9\u51FD\u6570\u5C55\u5F00")), timeoutMs);
    timer.unref();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    worker.once("message", (response2) => {
      if (response2.ok) finish(void 0, response2.value);
      else finish(Object.assign(new Error(response2.error.message), { code: response2.error.code, diagnostics: response2.error.diagnostics }));
    });
    worker.once("error", (error) => finish(Object.assign(error, { code: error.code === "ERR_WORKER_OUT_OF_MEMORY" ? "WorkflowAnalysisLimit" : error.code })));
    worker.once("exit", (code) => {
      if (!settled) finish(invalid(`\u5DE5\u4F5C\u6D41\u5206\u6790\u8FDB\u7A0B\u5728\u8FD4\u56DE\u7ED3\u679C\u524D\u9000\u51FA\uFF08${code}\uFF09`));
    });
  });
}
function pump() {
  if (running || !queue.length) return;
  running = true;
  const job = queue.shift();
  job.signal.removeEventListener("abort", job.abort);
  Promise.resolve().then(() => runWorker(job.data, job.signal)).then(job.resolve, job.reject).finally(() => {
    running = false;
    pump();
  });
}
function schedule(data, signal) {
  signal.throwIfAborted();
  if (queue.length + Number(running) >= 8) return Promise.reject(invalid("\u5DE5\u4F5C\u6D41\u5206\u6790\u961F\u5217\u5DF2\u6EE1\uFF0C\u8BF7\u7B49\u5F85\u5F53\u524D\u5206\u6790\u5B8C\u6210"));
  return new Promise((resolve, reject) => {
    const job = { data, signal, resolve, reject, abort: void 0 };
    job.abort = () => {
      const index = queue.indexOf(job);
      if (index >= 0) {
        queue.splice(index, 1);
        reject(signal.reason ?? new Error("\u5DE5\u4F5C\u6D41\u5206\u6790\u5DF2\u53D6\u6D88"));
      }
    };
    signal.addEventListener("abort", job.abort, { once: true });
    queue.push(job);
    pump();
  });
}
function createCompilerScope() {
  const abort = new AbortController();
  const cache = /* @__PURE__ */ new Map();
  const tasks = /* @__PURE__ */ new Set();
  const track = (promise) => {
    tasks.add(promise);
    promise.finally(() => tasks.delete(promise)).catch(() => {
    });
    return promise;
  };
  const remember = (script, promise) => {
    if (cache.size >= 8) cache.delete(cache.keys().next().value);
    cache.set(script, promise);
    promise.catch(() => {
      if (cache.get(script) === promise) cache.delete(script);
    });
    return promise;
  };
  const compiler = {
    compile(script) {
      checkSource(script);
      abort.signal.throwIfAborted();
      if (cache.has(script)) return cache.get(script);
      return remember(script, track(schedule({ kind: "compile", script }, abort.signal)));
    },
    async requireCompiled(script) {
      const compiled = await compiler.compile(script);
      if (!compiled.analysis.ok) {
        const error = new Error(compiled.analysis.diagnostics.map((d) => `${d.line}:${d.column} ${d.message}`).join("\n"));
        Object.assign(error, { code: "WorkflowCompileError", diagnostics: compiled.analysis.diagnostics });
        throw error;
      }
      return compiled;
    },
    async compileHole(script, siteId, body) {
      checkSource(script);
      if (typeof body !== "string" || !body.trim() || Buffer.byteLength(body) > 512 * 1024) throw invalid("\u7559\u767D\u8865\u5168\u4EE3\u7801\u5FC5\u987B\u662F\u975E\u7A7A\u4E14\u4E0D\u8D85\u8FC7 512 KiB \u7684 TypeScript");
      const result = await track(schedule({ kind: "hole", script, siteId, body }, abort.signal));
      remember(result.script, Promise.resolve(result.compiled));
      return result;
    },
    async dispose() {
      abort.abort(new Error("\u5DE5\u4F5C\u6D41\u7F16\u8BD1\u5668\u5DF2\u5173\u95ED"));
      await Promise.allSettled([...tasks]);
      cache.clear();
    }
  };
  return compiler;
}
var defaultCompiler = createCompilerScope();

// workflow/host/dsh-driver.js
import { setTimeout as delay } from "node:timers/promises";
import { ConcurrencyController, WorkflowError as WorkflowError2, validate, refToString as refToString2 } from "@zcode/dynamic-workflow";

// workflow/host/world.js
import { randomUUID } from "node:crypto";
import { posix, extname, isAbsolute } from "node:path";
import { WORLD_READ_CAPS as CAP, ARTIFACT_CAPS, WorkflowError } from "@zcode/dynamic-workflow";
var quote = (text3) => `'${String(text3).replaceAll("'", "'\\''")}'`;
var check = (ok, message) => {
  if (!ok) throw new TypeError(message);
};
var text = (value) => typeof value === "string" && !value.includes("\0");
var capError = (message) => new WorkflowError("WorldReadCapExceeded", message);
var bounded = (value, limit) => {
  if (Buffer.byteLength(typeof value === "string" ? value : JSON.stringify(value)) > limit) throw capError(`\u4E16\u754C\u8BFB\u53D6\u8D85\u8FC7 ${limit} \u5B57\u8282\u4E0A\u9650`);
  return value;
};
var ref = (value) => {
  check(text(value) && value.length > 0 && !value.startsWith("-") && !value.includes("..") && !/[\s~^:?*\\\[]/.test(value), "Git base \u5FC5\u987B\u662F\u5355\u4E2A\u6709\u6548 ref");
  return value;
};
function createWorld(parent, { cwd: runCwd, journal, runId, signal, effect, completeEffect }) {
  const ctx = parent.ctx;
  const cwd = runCwd ?? ctx.get("workingDirectory")?.get(parent.session) ?? parent.session.header.cwd;
  check(typeof cwd === "string" && cwd.length > 0, "\u7236\u4F1A\u8BDD\u6CA1\u6709\u5DE5\u4F5C\u76EE\u5F55");
  const root = ctx.get("fs").resolve(cwd);
  async function target(path) {
    check(text(path) && path.length > 0 && !isAbsolute(path) && !path.split(/[\\/]/).includes(".."), "\u8DEF\u5F84\u5FC5\u987B\u4F4D\u4E8E\u5DE5\u4F5C\u533A\u5185");
    const resolved = await ctx.get("fs").resolve(path, { cwd, signal });
    if (!ctx.get("fs").contains(await root, resolved)) throw new WorkflowError("ArtifactPathOutsideWorkspace", "\u8DEF\u5F84\u6216\u7B26\u53F7\u94FE\u63A5\u6307\u5411\u5DE5\u4F5C\u533A\u5916");
    return resolved;
  }
  async function command(argv, { maxBytes = CAP.runStdoutMaxBytes, timeoutMs = CAP.runDefaultTimeoutMs } = {}) {
    signal.throwIfAborted();
    const policy = ctx.get("sandboxPolicy").resolve({ session: parent.session });
    const spec = ctx.get("shell").resolve({ command: `exec ${argv.map(quote).join(" ")}`, workdir: cwd, signal, timeoutMs, onExpiry: "kill", stdoutMaxBytes: maxBytes + 1, sandboxPolicy: policy });
    const process2 = await ctx.get("shell").execute(spec);
    const result = await process2.result();
    if (result.aborted || signal.aborted) throw new Error("\u4E16\u754C\u547D\u4EE4\u5DF2\u4E2D\u6B62\uFF1B\u5916\u90E8\u526F\u4F5C\u7528\u53EF\u80FD\u5DF2\u7ECF\u53D1\u751F");
    if (result.timedOut) throw new Error("\u4E16\u754C\u547D\u4EE4\u8D85\u65F6\uFF1B\u5916\u90E8\u526F\u4F5C\u7528\u53EF\u80FD\u5DF2\u7ECF\u53D1\u751F");
    if (result.sandbox?.denied || result.sandbox?.runnerFailed) throw new Error("DSH \u6C99\u7BB1\u62D2\u7EDD\u4E86\u4E16\u754C\u547D\u4EE4");
    if (result.stdout.truncated || result.stderr.truncated) throw capError("\u4E16\u754C\u547D\u4EE4\u8F93\u51FA\u8D85\u8FC7\u4E0A\u9650");
    const stdout = bounded(result.stdout.text, maxBytes);
    const stderr = bounded(result.stderr.text, maxBytes);
    check(Number.isInteger(result.exitCode), "\u547D\u4EE4\u6CA1\u6709\u5DF2\u77E5\u9000\u51FA\u7801");
    return { exitCode: result.exitCode, stdout, stderr };
  }
  async function guardedCommand(argv, { maxBytes = CAP.runStdoutMaxBytes, timeoutMs = CAP.runDefaultTimeoutMs, evidence = () => {
  } } = {}) {
    signal.throwIfAborted();
    const callId = randomUUID();
    let jobId;
    let cleanup;
    const stopJob = () => cleanup ??= (async () => {
      const job = ctx.get("jobs").get(jobId, parent.id);
      if (!job) throw new Error(`\u65E0\u6CD5\u627E\u5230\u672C\u6B21\u547D\u4EE4\u7684\u4F5C\u4E1A ${jobId}\uFF0C\u5916\u90E8\u7ED3\u679C\u4ECD\u672A\u77E5`);
      if (["completed", "killed", "failed"].includes(job.status)) return;
      ctx.get("jobs").kill(jobId, parent.id, "workflow world.run foreground deadline expired");
      const stopped = await ctx.get("jobs").wait(jobId, 5e3, parent.id);
      if (!["completed", "killed", "failed"].includes(stopped.status)) throw new Error(`\u4F5C\u4E1A ${jobId} \u5C1A\u672A\u505C\u6B62\uFF0C\u5916\u90E8\u7ED3\u679C\u4ECD\u672A\u77E5`);
    })();
    const unobserve = ctx.on("tools/post-execute", async (exec, result, next) => {
      if (exec.callId === callId) {
        const value = result.isError ? void 0 : result.value;
        if (["promoted", "background"].includes(value?.kind) && typeof value.jobId === "string") jobId = value.jobId;
        evidence({ callId, isError: result.isError, ...result.isError ? { error: result.error } : { kind: value?.kind, jobId: value?.jobId, timedOut: value?.timedOut, aborted: value?.aborted, exitCode: value?.exitCode, stdout: value?.stdout && { truncated: value.stdout.truncated, spillPath: value.stdout.spillPath }, stderr: value?.stderr && { truncated: value.stderr.truncated, spillPath: value.stderr.spillPath } } });
      }
      return next();
    }, { prepend: true });
    try {
      const result = await ctx.get("tools").execute({ callId, name: "bash", arguments: { description: "\u8FD0\u884C\u5DE5\u4F5C\u6D41\u547D\u4EE4\u5E76\u8BB0\u5F55\u7ED3\u679C", command: `exec ${argv.map(quote).join(" ")}`, workdir: cwd, timeoutMs, run_in_background: false }, agent: parent, signal });
      if (!result.isError && ["promoted", "background"].includes(result.value?.kind)) jobId = result.value.jobId;
      if (jobId) {
        await stopJob();
        throw new Error(`\u547D\u4EE4\u8D85\u8FC7\u524D\u53F0\u65F6\u9650\u5E76\u8F6C\u4E3A\u4F5C\u4E1A ${jobId}\uFF1B\u4F5C\u4E1A\u5DF2\u6536\u53E3\uFF0C\u5916\u90E8\u7ED3\u679C\u4ECD\u9700\u6838\u5BF9`);
      }
      if (result.isError) throw new Error(`DSH \u547D\u4EE4\u672A\u6210\u529F\uFF1A${result.error.message}`);
      const value = result.value;
      check(value?.kind === "foreground", "\u539F\u751F Bash \u6CA1\u6709\u8FD4\u56DE\u53EF\u6838\u5BF9\u7684\u524D\u53F0\u547D\u4EE4\u7ED3\u679C");
      if (value.aborted || signal.aborted || value.timedOut) throw new Error("\u547D\u4EE4\u5DF2\u4E2D\u6B62\u6216\u8D85\u65F6\uFF0C\u5916\u90E8\u7ED3\u679C\u672A\u77E5");
      if (value.sandbox?.denied || value.sandbox?.runnerFailed) throw new Error("DSH \u6C99\u7BB1\u62D2\u7EDD\u4E86\u4E16\u754C\u547D\u4EE4");
      const output = async (stream) => {
        if (!stream.truncated) return bounded(stream.text, maxBytes);
        const path = stream.spillPath;
        if (!path) throw capError("\u539F\u751F\u547D\u4EE4\u8F93\u51FA\u5DF2\u622A\u65AD\uFF0C\u4E14\u6CA1\u6709\u53EF\u8BFB\u53D6\u7684\u5B8C\u6574\u8F93\u51FA");
        const target2 = await ctx.get("fs").resolve(path, { cwd, signal });
        let bytes;
        try {
          bytes = await ctx.get("fs").readBytes(target2, signal, maxBytes);
        } catch (error) {
          if (error.code === "FS_TOO_LARGE") throw capError("\u5B8C\u6574\u547D\u4EE4\u8F93\u51FA\u8D85\u8FC7\u4E0A\u6E38\u5B57\u8282\u4E0A\u9650");
          throw error;
        }
        return bounded(new TextDecoder("utf-8").decode(bytes), maxBytes);
      };
      check(Number.isInteger(value.exitCode), "\u547D\u4EE4\u6CA1\u6709\u5DF2\u77E5\u9000\u51FA\u7801");
      const [stdout, stderr] = await Promise.all([output(value.stdout), output(value.stderr)]);
      return { exitCode: value.exitCode, stdout, stderr };
    } catch (error) {
      if (jobId) {
        try {
          await stopJob();
        } catch (cleanupError) {
          throw new AggregateError([error, cleanupError], `\u547D\u4EE4\u7ED3\u679C\u672A\u77E5\u4E14\u4F5C\u4E1A\u6536\u53E3\u672A\u5B8C\u6210\uFF1A${cleanupError.message}`);
        }
      }
      throw error;
    } finally {
      unobserve();
    }
  }
  async function git(args, maxBytes = CAP.gitDiffMaxBytes) {
    const result = await command(["git", "-c", "core.fsmonitor=false", "--no-pager", ...args], { maxBytes });
    if (result.exitCode !== 0) throw new Error(`Git \u8BFB\u53D6\u5931\u8D25\uFF1A${result.stderr}`);
    return result.stdout;
  }
  async function execute(op, args) {
    check(Array.isArray(args), "\u4E16\u754C\u8BFB\u53D6\u53C2\u6570\u5FC5\u987B\u662F\u6570\u7EC4");
    if (op === "read") {
      check(args.length === 1, "files.read \u53EA\u63A5\u53D7\u4E00\u4E2A\u8DEF\u5F84");
      const file = await target(args[0]);
      let content = "";
      let length = 0;
      for await (const chunk of await ctx.get("fs").streamText(file, signal)) {
        length += Buffer.byteLength(chunk);
        if (length > 1024 * 1024) throw capError("files.read \u8D85\u8FC7 1 MiB \u4E0A\u9650");
        content += chunk;
      }
      return content;
    }
    if (op === "glob" || op === "grep") {
      check(args.length >= 1 && args.length <= (op === "glob" ? 1 : 2) && text(args[0]), "files.glob/grep \u53C2\u6570\u65E0\u6548");
      if (args[1] !== void 0) check(text(args[1]), "grep glob \u5FC5\u987B\u662F\u5B57\u7B26\u4E32");
      const argv = op === "glob" ? ["rg", "--files", "--hidden", "--null", "--glob", args[0], "--glob", "!.git/**", "."] : ["rg", "--json", "--hidden", "--glob", "!.git/**", ...args[1] === void 0 ? [] : ["--glob", args[1]], "--", args[0], "."];
      const result = await command(argv, { maxBytes: 2 * 1024 * 1024 });
      if (result.exitCode > 1) throw new Error(result.stderr || "ripgrep \u8BFB\u53D6\u5931\u8D25");
      if (op === "glob") {
        const paths = result.stdout.split("\0").filter(Boolean).map((path) => path.replace(/^\.\//, "")).sort();
        if (paths.length > CAP.globMaxFiles) throw capError(`glob \u8D85\u8FC7 ${CAP.globMaxFiles} \u4E2A\u6587\u4EF6`);
        return paths;
      }
      const matches = [];
      for (const line of result.stdout.split("\n")) {
        if (!line) continue;
        const row = JSON.parse(line);
        if (row.type !== "match") continue;
        check(typeof row.data.path.text === "string" && typeof row.data.lines.text === "string", "grep \u4E0D\u652F\u6301\u975E UTF-8 \u8DEF\u5F84\u6216\u5185\u5BB9");
        matches.push({ path: row.data.path.text.replace(/^\.\//, ""), line: row.data.line_number, text: row.data.lines.text.replace(/\r?\n$/, "") });
        if (matches.length > CAP.grepMaxMatches) throw capError(`grep \u8D85\u8FC7 ${CAP.grepMaxMatches} \u6761\u547D\u4E2D`);
      }
      return bounded(matches, CAP.grepMaxSerializedBytes);
    }
    if (op === "git-diff" || op === "git-changed-files") {
      check(args.length <= (op === "git-diff" ? 2 : 1), "Git \u8BFB\u53D6\u53C2\u6570\u8FC7\u591A");
      const base = args[0] === void 0 ? "HEAD" : ref(args[0]);
      if (args[1] !== void 0) await target(args[1]);
      const path = args[1] ?? ".";
      if (op === "git-diff") return git(["diff", "--no-ext-diff", "--no-textconv", "--relative", base, "--", path]);
      const tracked = (await git(["diff", "--name-only", "-z", "--relative", base, "--", "."])).split("\0").filter(Boolean);
      if (args[0] === void 0) tracked.push(...(await git(["ls-files", "--others", "--exclude-standard", "-z", "--", "."])).split("\0").filter(Boolean));
      return [...new Set(tracked)].sort();
    }
    if (op === "git-status") {
      check(args.length === 0, "git.status \u4E0D\u63A5\u53D7\u53C2\u6570");
      const prefix = (await git(["rev-parse", "--show-prefix"])).trim();
      const status = (await git(["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", "."])).split("\0").filter(Boolean);
      const result = { clean: status.length === 0, staged: [], unstaged: [], untracked: [] };
      const branch = (await git(["rev-parse", "--abbrev-ref", "HEAD"])).trim();
      if (branch !== "HEAD") result.branch = branch;
      for (let i = 0; i < status.length; i++) {
        const row = status[i];
        const path = row.slice(3);
        if (row[0] === "R" || row[0] === "C") i++;
        if (!path.startsWith(prefix)) continue;
        const relative = path.slice(prefix.length);
        if (row.startsWith("??")) result.untracked.push(relative);
        else {
          if (row[0] !== " ") result.staged.push(relative);
          if (row[1] !== " ") result.unstaged.push(relative);
        }
      }
      return result;
    }
    if (op === "git-log") {
      check(args.length <= 1, "git.log \u53C2\u6570\u8FC7\u591A");
      const count = args[0] ?? CAP.gitLogDefaultCount;
      check(Number.isInteger(count) && count > 0, "git.log count \u5FC5\u987B\u662F\u6B63\u6574\u6570");
      if (count > CAP.gitLogMaxCount) throw capError(`git.log \u6700\u591A ${CAP.gitLogMaxCount} \u6761`);
      const fields = (await git(["log", `-${count}`, "--format=%H%x00%s%x00%an%x00%aI%x00"])).split("\0");
      const commits = [];
      for (let i = 0; i + 3 < fields.length; i += 4) commits.push({ hash: fields[i].trim(), subject: fields[i + 1], author: fields[i + 2], date: fields[i + 3] });
      return commits;
    }
    if (op === "run") {
      check(args.length >= 1 && args.length <= 3 && text(args[0]) && args[0].length > 0, "world.run \u547D\u4EE4\u65E0\u6548");
      const argv = args[1] ?? [];
      const opts = args[2] ?? {};
      check(Array.isArray(argv) && argv.every(text) && typeof opts === "object" && opts !== null && !Array.isArray(opts) && Object.keys(opts).every((key) => key === "timeoutMs"), "world.run \u53C2\u6570\u65E0\u6548");
      const timeoutMs = opts.timeoutMs ?? CAP.runDefaultTimeoutMs;
      check(Number.isFinite(timeoutMs) && timeoutMs > 0, "timeoutMs \u5FC5\u987B\u662F\u6B63\u6570");
      const pending = effect(op, args);
      if (pending.resolution === "accept") return pending.value;
      try {
        const result = await guardedCommand([args[0], ...argv], { timeoutMs, evidence: (native) => journal.putEffect({ ...journal.getEffect(pending.id), native }) });
        completeEffect(pending.id, result);
        return result;
      } catch (error) {
        completeEffect(pending.id, void 0, error);
        throw error;
      }
    }
    throw new Error(`\u4E0D\u652F\u6301\u7684\u4E16\u754C\u8BFB\u53D6\uFF1A${op}`);
  }
  async function publish(request) {
    const { id, version, op, opts = {} } = request;
    check(typeof opts === "object" && opts !== null && !Array.isArray(opts), "\u4EA7\u7269\u9009\u9879\u5FC5\u987B\u662F\u5BF9\u8C61");
    for (const key of Object.keys(opts)) check(["title", "description", "contentType", "primary"].includes(key), `\u672A\u77E5\u4EA7\u7269\u9009\u9879 ${key}`);
    for (const [key, cap] of [["title", ARTIFACT_CAPS.maxTitleLength], ["description", ARTIFACT_CAPS.maxDescriptionLength]]) if (opts[key] !== void 0) check(typeof opts[key] === "string" && opts[key].length <= cap, `${key} \u8D85\u8FC7\u4E0A\u9650`);
    if (opts.primary !== void 0) check(typeof opts.primary === "boolean", "primary \u5FC5\u987B\u662F\u5E03\u5C14\u503C");
    if (opts.contentType !== void 0) check(typeof opts.contentType === "string" && /^[\w.+-]+\/[\w.+-]+(?:; charset=utf-8)?$/.test(opts.contentType), "contentType \u65E0\u6548");
    let bytes;
    let contentType = opts.contentType;
    if (op === "markdown") {
      check(typeof request.content === "string", "Markdown \u6B63\u6587\u5FC5\u987B\u662F\u5B57\u7B26\u4E32");
      bytes = Buffer.from(request.content);
      if (bytes.length > ARTIFACT_CAPS.maxMarkdownBytes) throw new WorkflowError("ArtifactTooLarge", "Markdown \u8D85\u8FC7\u4E0A\u9650");
      contentType ??= "text/markdown; charset=utf-8";
    } else {
      const file = await target(request.path);
      try {
        bytes = await ctx.get("fs").readBytes(file, signal, ARTIFACT_CAPS.maxFileBytes);
      } catch (error) {
        throw new WorkflowError(error.code === "FS_TOO_LARGE" ? "ArtifactTooLarge" : "ArtifactSourceMissing", error.message);
      }
      contentType ??= { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".pdf": "application/pdf", ".txt": "text/plain", ".csv": "text/csv", ".json": "application/json", ".svg": "image/svg+xml", ".html": "text/html" }[extname(request.path).toLowerCase()] ?? "application/octet-stream";
    }
    const record = { id, version, kind: op, ...opts, contentType, bytes: bytes.length, publishedAt: Date.now(), uri: `dsh-workflow:${runId}/${id}/${version}`, ...request.path === void 0 ? {} : { sourcePath: posix.normalize(request.path) } };
    const existing = journal.getArtifact(runId, id, version);
    if (existing) {
      check(Buffer.from(existing.bytes).equals(bytes), "\u5DF2\u843D\u76D8\u4EA7\u7269\u4E0E\u6062\u590D\u65F6\u7684\u5185\u5BB9\u4E0D\u540C");
      return existing.record;
    }
    journal.putArtifact(runId, id, version, bytes, record);
    return record;
  }
  return { execute, publish };
}

// workflow/host/native-team.js
import { createHash } from "node:crypto";
import { refToString } from "@zcode/dynamic-workflow";
function parkWorkflowMessages(agent, messages) {
  for (const message of messages) agent.inject(message);
  return Promise.resolve({ kind: "reject" });
}
function createNativeTeam(parent, config, callbacks) {
  const { journal, runId, signal, routes, cwd } = config;
  const ctx = config.hostContext ?? parent.ctx;
  const agents = ctx.get("agents");
  const teams = ctx.get("agentTeams");
  const subagents = ctx.get("subagents");
  if (!teams || !subagents) throw new Error("\u52A8\u6001\u5DE5\u4F5C\u6D41\u9700\u8981\u542F\u7528 DSH \u539F\u751F Teams \u548C\u6807\u51C6\u5B50\u4EE3\u7406\u7BA1\u7406");
  const leadId = `dwf-team-${runId}`;
  const provider = `composer-workflow-${runId}`;
  const seen = /* @__PURE__ */ new Map();
  let leadHandle;
  let opening;
  let closed = false;
  const memberKey = (name) => `native-member:${leadId}:${name}`;
  const taskKey = (instance) => `native-task:${runId}:${refToString(instance)}`;
  const nameOf = (actor) => `actor-${createHash("sha256").update(refToString(actor)).digest("hex").slice(0, 24)}`;
  const doc = (key, kind, value) => journal.putDocument(key, runId, kind, value);
  const actorSpec = (lead, childId) => {
    const member = teams.listMembers(lead).find((row) => row.id === childId);
    return member && journal.getDocument(memberKey(member.name));
  };
  const seedEvents = async (seed) => {
    if (!seed) return void 0;
    const boundary = journal.getDocument(`transcript:${seed.sourceSessionId}:${seed.messageCount}`);
    if (!boundary) throw new Error("\u7F3A\u5C11\u5B8C\u6574\u8F6C\u5F55\u8FB9\u754C\uFF0C\u62D2\u7EDD\u63A5\u7EED\u539F\u751F\u6210\u5458");
    const source = await ctx.get("sessionQuery").readSession(seed.sourceSessionId);
    const events = source.events.slice(0, boundary.eventCount);
    if (events.at(-1)?.type !== "turn/end") throw new Error("\u539F\u751F\u6210\u5458\u79CD\u5B50\u5FC5\u987B\u7ED3\u675F\u4E8E\u5DF2\u95ED\u5408 turn");
    return events;
  };
  const unregister = subagents.registerProvider({
    name: provider,
    capabilities: { agentOptions: true, agentPreset: true, outputSchema: false, depthLimit: true },
    inheritsParentContext: false,
    async prepareContinuable({ sessionId, parent: lead }) {
      if (lead.id !== leadId || agents.get(lead.id) !== lead) throw new Error("\u5DE5\u4F5C\u6D41 provider \u7684\u7236\u4F1A\u8BDD\u4E0D\u5339\u914D");
      const spec = actorSpec(lead, sessionId);
      if (!spec) throw new Error("\u539F\u751F\u6210\u5458\u6CA1\u6709\u5BF9\u5E94\u7684 ZCode actor");
      const seed = await seedEvents(spec.seed);
      return seed === void 0 ? {} : { seed };
    }
  });
  const stopCreated = ctx.on("agent/created", async ({ agent }) => {
    if (agent.session.header.parentSession !== leadId) return;
    const lead = agents.get(leadId);
    if (!lead || closed) throw new Error("\u5DE5\u4F5C\u6D41\u56E2\u961F\u5DF2\u5173\u95ED");
    const spec = actorSpec(lead, agent.id);
    if (!spec) throw new Error("\u62D2\u7EDD\u672A\u767B\u8BB0\u7684\u5DE5\u4F5C\u6D41\u56E2\u961F\u6210\u5458");
    agent.ctx.on("agent/pre-step", ({ messages }, next) => callbacks.isActive(agent.id) ? next() : parkWorkflowMessages(agent, messages));
    await callbacks.setup(agent, spec);
    seen.set(agent.id, agent);
    callbacks.attached(agent);
  });
  async function ensureLead() {
    if (closed) throw new Error("\u5DE5\u4F5C\u6D41\u56E2\u961F\u5DF2\u5173\u95ED");
    if (leadHandle) return leadHandle.agent;
    opening ??= (async () => {
      if (agents.get(leadId)) throw new Error("\u5DE5\u4F5C\u6D41\u56E2\u961F\u5DF2\u88AB\u53E6\u4E00\u6267\u884C\u5668\u5360\u7528");
      const options = {
        parentAgent: parent,
        agentOptions: routes.base,
        signal,
        setup(leadCtx, lead) {
          leadCtx.get("agentPresets")?.composeFrom(leadCtx, parent.ctx);
          const sandboxMode = ctx.get("sandboxPolicy")?.overrideOf(parent.session);
          const preset = ctx.get("permissionPresets")?.current(parent.session);
          if (sandboxMode !== void 0) lead.session.append("sandbox/mode", { mode: sandboxMode, source: "delegation" });
          if (ctx.get("approval")) lead.session.append("approval/policy", { policy: "never", source: "delegation" });
          if (["auto", "danger-full-access"].includes(preset)) lead.session.append("permission/preset", { preset, source: "delegation" });
          leadCtx.on("agent/pre-step", ({ messages }) => parkWorkflowMessages(lead, messages));
        }
      };
      const stored = await ctx.get("sessionPersistence").stat(leadId);
      leadHandle = stored ? await agents.resume({ ...options, resumeSessionId: leadId }) : await agents.create({ ...options, sessionId: leadId, meta: { cwd, parentSession: parent.id, ...ctx.get("agentPresets")?.composedPreset(parent.ctx) ? { agentPreset: ctx.get("agentPresets").composedPreset(parent.ctx) } : {} } });
      doc(`native-team:${runId}`, "native-team", { teamSessionId: leadId, parentSessionId: parent.id, provider });
      for (const saved of journal.listDocuments(runId, "native-task", 1e3)) if (saved.instance) await settleTask(saved.instance);
      return leadHandle.agent;
    })();
    return opening;
  }
  async function createActor(actor, persona, route, seed, previous) {
    signal.throwIfAborted();
    const lead = await ensureLead();
    const name = nameOf(actor);
    let spec = journal.getDocument(memberKey(name));
    if (!spec) {
      if (!seed && previous?.sessionId) {
        const boundary = journal.getDocument(`transcript-latest:${previous.sessionId}`);
        if (!boundary) throw new Error("\u65E7 actor \u7F3A\u5C11\u5B89\u5168\u8F6C\u5F55\u8FB9\u754C\uFF0C\u8BF7\u4FEE\u8BA2\u4E3A\u65B0\u8FD0\u884C\u540E\u7EE7\u7EED");
        seed = { sourceSessionId: previous.sessionId, messageCount: boundary.messageCount };
      }
      spec = { actor, persona, route, ...seed ? { seed } : {} };
      doc(memberKey(name), "native-member", spec);
    }
    let member = teams.listMembers(lead).find((row) => row.name === name);
    if (!member) {
      const created = await teams.spawnTeammate(lead, { name, description: String(persona.name ?? refToString(actor)).slice(0, 200), context: "fresh", provider, signal, prompt: [{ type: "text", text: "Workflow actor initialized. Wait for the ZCode engine to admit your next ask; this initialization performs no model work." }] });
      member = created.member;
    }
    if (member.status === "failed" || member.status === "provisioning") throw new Error(`\u539F\u751F\u6210\u5458 ${name} \u5C1A\u4E0D\u53EF\u8FD0\u884C\uFF1A${member.status}`);
    await (agents.get(member.id) ?? seen.get(member.id))?.whenIdle();
    const link = { teamSessionId: leadId, memberName: name, sessionId: member.id };
    doc(`native-actor:${runId}:${refToString(actor)}`, "native-actor", link);
    return link;
  }
  async function send(sessionId, instructions) {
    signal.throwIfAborted();
    const lead = await ensureLead();
    const member = teams.listMembers(lead).find((row) => row.id === sessionId && row.role === "teammate");
    if (!member) throw new Error("\u76EE\u6807\u4E0D\u662F\u8BE5\u5DE5\u4F5C\u6D41\u7684\u539F\u751F\u6210\u5458");
    await teams.sendMessage(lead, { target: member.name, content: [{ type: "text", text: instructions }], signal });
    const child = agents.get(sessionId) ?? seen.get(sessionId);
    if (!child) throw new Error("\u539F\u751F\u6210\u5458\u6D88\u606F\u5DF2\u63A5\u53D7\uFF0C\u4F46\u6CA1\u6709\u53EF\u89C2\u5BDF\u7684\u6267\u884C\u4F1A\u8BDD");
    return child;
  }
  const update = (lead, task, action, extra = {}) => teams.updateTask(lead, { taskId: task.id, expectedRevision: task.revision, action, ...extra });
  async function beginTask(instance, message, sessionId) {
    const lead = await ensureLead();
    const key = taskKey(instance);
    const marker = `[ZCode ${runId}/${refToString(instance)}]`;
    const saved = journal.getDocument(key);
    let task = saved ? teams.getTask(lead, saved.taskId) : teams.listTasks(lead).find((row) => row.description.startsWith(`${marker}
`));
    if (!task) task = await teams.createTask(lead, { subject: `ZCode ${refToString(instance)}`.slice(0, 200), description: `${marker}
${message.instructions.slice(0, 6e3)}`, blockedBy: [], writeScopes: [] });
    doc(key, "native-task", { taskId: task.id, teamSessionId: leadId, sessionId, instance });
    const member = teams.listMembers(lead).find((row) => row.id === sessionId);
    if (!member) throw new Error("\u8282\u70B9\u4EFB\u52A1\u7F3A\u5C11\u539F\u751F\u6210\u5458");
    if (task.status === "completed") task = await update(lead, task, "reopen");
    if (task.status === "pending") {
      if (task.ownerName && task.ownerName !== "lead") task = await update(lead, task, "reassign", { owner: "lead" });
      task = await update(lead, task, "claim");
    }
    if (task.ownerName !== member.name) await update(lead, task, "reassign", { owner: member.name });
  }
  async function settleTask(instance) {
    const saved = journal.getDocument(taskKey(instance));
    if (!saved || !leadHandle) return;
    const lead = leadHandle.agent;
    let task = teams.getTask(lead, saved.taskId);
    const node = journal.getNode(runId, instance.siteId, instance.ordinal);
    if (node?.status === "completed") {
      if (task.status === "pending") {
        const member = teams.listMembers(lead).find((row) => row.id === saved.sessionId);
        if (task.ownerName && task.ownerName !== "lead") task = await update(lead, task, "reassign", { owner: "lead" });
        task = await update(lead, task, "claim");
        if (member) task = await update(lead, task, "reassign", { owner: member.name });
      }
      if (task.status !== "completed") await update(lead, task, "complete");
    } else {
      if (task.status === "completed") task = await update(lead, task, "reopen");
      if (task.status === "in_progress") await update(lead, task, "release");
    }
  }
  async function stop() {
    if (!opening && !signal.aborted && journal.getDocument(`native-team:${runId}`)) await ensureLead();
    closed = true;
    await opening?.catch(() => {
    });
    if (leadHandle) {
      const ids = teams.listMembers(leadHandle.agent).filter((row) => row.role === "teammate").map((row) => row.id);
      await subagents.drainChildren(leadHandle.agent, ids);
    }
  }
  async function dispose() {
    try {
      await stop();
    } finally {
      stopCreated();
      unregister();
      await leadHandle?.dispose();
    }
  }
  function interrupt(sessionId) {
    if (leadHandle) subagents.interrupt(sessionId, { kind: "ancestor", agent: leadHandle.agent });
  }
  return { createActor, send, beginTask, settleTask, interrupt, stop, dispose, leadId };
}

// workflow/host/model-stats.js
import { join as join2 } from "node:path";
import { mkdirSync as mkdirSync2, readFileSync, writeFileSync, renameSync } from "node:fs";
var SAMPLE_LIMIT = 40;
var STALE_MS = 30 * 24 * 60 * 60 * 1e3;
var empty = () => ({ latencyMs: [], tokens: 0, samples: 0, failures: 0, updatedAt: 0 });
function trim(samples) {
  return samples.slice(-SAMPLE_LIMIT);
}
function median(values) {
  if (values.length === 0) return void 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function score(entry, objective) {
  if (!entry || entry.samples === 0 && entry.failures === 0) return void 0;
  const latency = median(entry.latencyMs);
  const perCall = entry.samples === 0 ? Number.POSITIVE_INFINITY : entry.tokens / entry.samples;
  const failureRate = entry.failures / Math.max(1, entry.samples + entry.failures);
  if (objective === "cost") return perCall;
  if (objective === "latency") return latency ?? Number.POSITIVE_INFINITY;
  return (latency ?? Number.POSITIVE_INFINITY) + perCall / 100 + failureRate * 1e4;
}
function createModelStats(directory) {
  const path = join2(directory, "model-stats.json");
  let entries = {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) entries = parsed;
  } catch {
  }
  const keyOf = (route) => `${route.provider}/${route.model}`;
  let flushTimer;
  function flush() {
    flushTimer = void 0;
    try {
      mkdirSync2(directory, { recursive: true, mode: 448 });
      const temp = `${path}.${process.pid}.tmp`;
      writeFileSync(temp, JSON.stringify(entries), { mode: 384 });
      renameSync(temp, path);
    } catch {
    }
  }
  function schedule2() {
    if (flushTimer !== void 0) return;
    flushTimer = setTimeout(flush, 1e3);
    flushTimer.unref?.();
  }
  return {
    /** Record one finished request. Errors count as failures with no latency. */
    observe(route, { elapsedMs, tokens, failed }) {
      if (!route?.provider || !route?.model) return;
      const key = keyOf(route);
      const entry = entries[key] ?? empty();
      if (failed) entry.failures += 1;
      else {
        if (Number.isFinite(elapsedMs) && elapsedMs >= 0) entry.latencyMs = trim([...entry.latencyMs, Math.round(elapsedMs)]);
        if (Number.isFinite(tokens) && tokens > 0) entry.tokens += Math.round(tokens);
        entry.samples += 1;
      }
      entry.updatedAt = Date.now();
      entries[key] = entry;
      schedule2();
    },
    scoreOf(route, objective) {
      return score(entries[keyOf(route)], objective);
    },
    snapshot() {
      return JSON.parse(JSON.stringify(entries));
    },
    /** Drop records nobody has touched for a month. */
    prune(now = Date.now()) {
      for (const [key, entry] of Object.entries(entries)) if (now - (entry.updatedAt ?? 0) > STALE_MS) delete entries[key];
    },
    flush
  };
}
function pickRoute(routes, { objective, stats }) {
  if (!Array.isArray(routes) || routes.length === 0) return void 0;
  if (objective === void 0 || objective === "none" || routes.length === 1) return routes[0];
  const scored = routes.map((route, index) => ({ route, index, value: stats.scoreOf(route, objective) }));
  const known = scored.filter((item) => item.value !== void 0);
  if (known.length === 0) return routes[0];
  known.sort((a, b) => a.value - b.value || a.index - b.index);
  return known[0].route;
}

// workflow/host/dsh-driver.js
var textBlock = (text3) => [{ type: "text", text: text3 }];
var READ_TOOLS = /* @__PURE__ */ new Set(["read", "read_image", "glob", "grep", "web_search", "web_fetch", "list_agents", "team_task_list", "team_task_get", "job_output", "job_list", "tool_help", "cordis_inspect_list", "cordis_inspect_query", "session_search", "session_event_search", "session_event_read", "get_goal"]);
var err = (error) => error instanceof WorkflowError2 ? error : new WorkflowError2("DriverError", error instanceof Error ? error.message : String(error));
function parentRoute(parent) {
  const header = parent.session.requestHeader()?.config;
  const options = header?.provider && header?.model ? header : parent.options;
  if (options?.provider && options?.model) return { provider: options.provider, model: options.model, ...options.reasoningEffort === void 0 ? {} : { reasoningEffort: options.reasoningEffort }, ...options.maxTokens === void 0 ? {} : { maxTokens: options.maxTokens } };
  const fallback = parent.ctx.get("agentDefaultModel")?.currentSelection();
  if (!fallback?.provider || !fallback.model) throw new Error("\u7236\u4F1A\u8BDD\u6CA1\u6709\u53EF\u7528\u7684\u6A21\u578B\u8DEF\u7531");
  return fallback;
}
function resolveRoutes(parent, input, analysis) {
  const inherited = parentRoute(parent);
  const selection = parent.ctx.get("subagentModelSelection")?.current();
  const savedPolicy = selection;
  const allowed = savedPolicy?.enabled ? savedPolicy.allowedModels : [];
  if (savedPolicy?.enabled && allowed.length === 0) throw new Error("\u5F53\u524D\u4F1A\u8BDD\u6CA1\u6709\u5141\u8BB8\u7684\u5B50\u4EE3\u7406\u6A21\u578B");
  const defaultRoute = savedPolicy?.enabled && !allowed.some((route) => route.provider === inherited.provider && route.model === inherited.model) ? allowed[0] : inherited;
  const selected = input.objective && input.objective !== "none" && Array.isArray(input.stats?.candidates) ? pickRoute(input.stats.candidates, { objective: input.objective, stats: input.stats }) : void 0;
  const choose = (provider, model, explicit) => {
    if (explicit && !allowed.some((route) => route.provider === provider && route.model === model)) throw new Error(`\u5B50\u4EE3\u7406\u6A21\u578B ${provider}/${model} \u4E0D\u5728\u5F53\u524D\u4F1A\u8BDD\u5141\u8BB8\u5217\u8868\u4E2D`);
    return provider === inherited.provider && model === inherited.model ? { ...inherited } : { provider, model };
  };
  if (input.provider === void 0 !== (input.model === void 0)) throw new Error("provider \u548C model \u5FC5\u987B\u540C\u65F6\u6307\u5B9A");
  const chosen = selected ?? defaultRoute;
  const base = input.routePin?.base ?? choose(input.provider ?? chosen.provider, input.model ?? chosen.model, input.provider !== void 0 || savedPolicy?.enabled === true);
  const bindings = { ...input.routePin?.bindings ?? {} };
  for (const reference of analysis.modelReferences ?? []) {
    const name = reference.name ?? reference.model;
    if (bindings[name] !== void 0) continue;
    if (typeof name !== "string") throw new Error("\u5DE5\u4F5C\u6D41\u6A21\u578B\u5F15\u7528\u5F62\u72B6\u65E0\u6548");
    let matches = allowed.filter((route) => `${route.provider}/${route.model}` === name || route.model === name);
    if (!savedPolicy?.enabled && (name === inherited.model || name === `${inherited.provider}/${inherited.model}`)) matches = [inherited];
    if (matches.length !== 1) throw new Error(`\u6A21\u578B\u540D ${name} \u672A\u83B7\u6388\u6743\u6216\u4E0D\u552F\u4E00\uFF0C\u8BF7\u4F7F\u7528\u660E\u786E\u7684 provider/model`);
    bindings[name] = choose(matches[0].provider, matches[0].model, savedPolicy?.enabled === true);
  }
  return { base, bindings };
}
function createDshDriver(parent, config) {
  const { journal, runId, sink, signal, emit, routes, askQuestion, recordEffect, settleEffect, concurrency } = config;
  const ctx = parent.ctx;
  const cwd = config.cwd ?? ctx.get("workingDirectory")?.get(parent.session) ?? parent.session.header.cwd;
  const states = /* @__PURE__ */ new Map();
  const tasks = /* @__PURE__ */ new Set();
  const actors = /* @__PURE__ */ new Map();
  const controller = new ConcurrencyController(`${routes.base.provider}/${routes.base.model}`, concurrency, concurrency);
  let closing = false;
  let cleanup;
  const addTask = (task) => {
    tasks.add(task);
    task.finally(() => tasks.delete(task)).catch(() => {
    });
    return task;
  };
  const world = createWorld(parent, { cwd, journal, runId, signal, effect: recordEffect, completeEffect: settleEffect });
  const native = createNativeTeam(parent, { ...config, cwd }, {
    isActive: (id) => [...states.values()].some((state) => state.sessionId === id && !state.finished),
    async setup(child, spec) {
      const preset = ctx.get("permissionPresets")?.current(parent.session);
      await setup(child.ctx, child, spec.actor, spec.persona, { sandboxMode: ctx.get("sandboxPolicy")?.overrideOf(parent.session), approvalPolicy: ctx.get("approval") ? "never" : void 0, permissionPreset: ["auto", "danger-full-access"].includes(preset) ? preset : void 0 }, spec.route);
    },
    attached(child) {
      for (const state of states.values()) if (state.sessionId === child.id && !state.finished) state.child = child;
    }
  });
  const setBoundary = async (state, child) => {
    if (ctx.get("agents").get(child.id) === child) await ctx.get("sessions").flush(child.session);
    const count = child.session.deriveMessages().length;
    const snapshot = await ctx.get("sessionQuery").readSession(child.id);
    const checkpoint = { sessionId: child.id, messageCount: count, eventCount: snapshot.events.length };
    journal.putDocument(`transcript:${child.id}:${count}`, parent.id, "transcript", checkpoint);
    journal.putDocument(`transcript-latest:${child.id}`, parent.id, "transcript", checkpoint);
    const node = journal.getNode(runId, state.instance.siteId, state.instance.ordinal);
    if (node?.status === "completed") journal.putNode({ ...node, messageBoundary: count });
  };
  const follow = async (state, instructions) => {
    state.child = await native.send(state.sessionId, instructions);
  };
  const activeState = (child) => [...states.values()].find((state) => state.sessionId === child.id && !state.finished);
  async function setup(childCtx, child, actor, persona, overrides, route) {
    childCtx.on("system-prompt/assemble", async (_assembly, _context, next) => {
      const assembled = await next();
      return { ...assembled, variables: { ...assembled.variables, provider: route.provider, model: route.model } };
    });
    const inheritedTools = new Set(ctx.get("tools").schemas(parent).map((tool) => tool.name));
    const deniedGlobals = ctx.get("tools").schemas().map((tool) => tool.name).filter((name) => !inheritedTools.has(name));
    if (deniedGlobals.length) childCtx.get("tools").restrict({ deny: deniedGlobals });
    const stagedSubmits = /* @__PURE__ */ new Map();
    const pendingTools = /* @__PURE__ */ new Map();
    let nestedSubmit;
    childCtx.get("systemPrompt").section({ name: `workflow:${runId}:persona`, order: 80, text: `You are workflow actor ${persona.name ?? refToString2(actor)}. Keep your conversation across asks. Work only on your current ask. Use submit_result for a typed answer and escalate for a blocking question. All inherited permissions, tool guards and model restrictions apply. Never retry an operation whose external outcome is unknown.
${persona.system ?? ""}` });
    if (overrides.sandboxMode !== void 0) child.session.append("sandbox/mode", { mode: overrides.sandboxMode, source: "delegation" });
    if (overrides.approvalPolicy !== void 0) child.session.append("approval/policy", { policy: overrides.approvalPolicy, source: "delegation" });
    if (overrides.permissionPreset !== void 0) child.session.append("permission/preset", { preset: overrides.permissionPreset });
    childCtx.get("tools").guard((exec) => {
      const state = activeState(child);
      if (!state) return "\u5F53\u524D\u6CA1\u6709\u83B7\u51C6\u6267\u884C\u7684\u5DE5\u4F5C\u6D41 ask";
      if (stagedSubmits.size || nestedSubmit || state.submitted !== void 0 || state.accepted) return "\u5F53\u524D ask \u5DF2\u63D0\u4EA4\u7ED3\u679C\uFF0C\u7B49\u5F85\u5F15\u64CE\u6536\u53E3";
      if (exec.arguments && typeof exec.arguments === "object" && exec.arguments.sandbox_permissions !== void 0) return "\u5DE5\u4F5C\u6D41\u5B50\u4EE3\u7406\u4E0D\u80FD\u6269\u5927\u521B\u5EFA\u65F6\u7684\u6743\u9650\u8303\u56F4";
      if (["workflow", "zcode_workflow", "create_goal", "ralph", "plugin_manager", "subagent", "subagent_fork", "subagent_codex", "spawn_teammate", "team_task_create", "team_task_update", "interrupt_agent"].includes(exec.name)) return "\u5DE5\u4F5C\u6D41\u7684\u6D3E\u53D1\u548C\u4EFB\u52A1\u72B6\u6001\u7531 ZCode \u5F15\u64CE\u7BA1\u7406\uFF1B\u961F\u53CB\u53EF\u901A\u8FC7 send_message \u534F\u4F5C\uFF0C\u4E0D\u80FD\u542F\u52A8\u7B2C\u4E8C\u5957\u7F16\u6392\u6216\u4FEE\u6539\u73AF\u5883";
      return void 0;
    });
    childCtx.get("tools").register({
      name: "submit_result",
      description: "Submit the JSON result for the current typed workflow ask. Invalid values are rejected with schema violations; correct them and submit again.",
      parameters: { type: "object", properties: { value: {} }, required: ["value"], additionalProperties: false },
      output: { schema: {}, render: (_args, value) => textBlock(JSON.stringify(value)) },
      async execute(args, exec) {
        const state = activeState(child);
        if (!state?.message.typed) throw new Error("\u5F53\u524D ask \u65E0\u7ED3\u6784\u5316\u63D0\u4EA4\u8981\u6C42");
        const violations = validate(state.message.schema, args.value);
        if (violations.length) {
          sink.askSubmitAttempted(state.instance, args.value);
          return state.verdict ?? { kind: "reject", violations };
        }
        stagedSubmits.set(exec, { state, value: args.value });
        exec.concludeTurn();
        return { recorded: true };
      }
    });
    childCtx.get("tools").register({
      name: "escalate",
      description: "Ask the workflow owner one blocking question. This ask waits for an answer; other actors keep running.",
      parameters: { type: "object", properties: { question: { type: "string" }, context: { type: "string" } }, required: ["question"], additionalProperties: false },
      output: { schema: { type: "string" }, render: (_args, value) => textBlock(value) },
      async execute(args, exec) {
        const state = activeState(child);
        if (!state) throw new Error("\u5F53\u524D\u6CA1\u6709\u5728\u6267\u884C\u7684 ask");
        return askQuestion({ actor, actorName: persona.name, instance: state.instance, question: args.question, context: args.context }, exec.signal);
      }
    });
    childCtx.on("tools/execute", async (exec, next) => {
      const state = activeState(child);
      if (!state || ["submit_result", "escalate"].includes(exec.name)) return next();
      state.toolCalls++;
      state.worldToolCalls++;
      state.lastTool = { name: exec.name.slice(0, 64) };
      if (READ_TOOLS.has(exec.name)) return next();
      sink.askMutating(state.instance);
      const id = `${runId}:tool:${exec.callId}`;
      const pending = { id, runId, kind: "tool", nodeId: refToString2(state.instance), instance: state.instance, actor, sessionId: child.id, tool: exec.name, arguments: exec.arguments, state: "pending", startedAt: Date.now() };
      journal.putEffect(pending);
      pendingTools.set(exec, pending);
      try {
        return await next();
      } catch (error) {
        pendingTools.delete(exec);
        journal.putEffect({ ...pending, state: "unknown", error: error.message, endedAt: Date.now() });
        throw error;
      }
    });
    childCtx.on("tools/result", (exec, result) => {
      const pending = pendingTools.get(exec);
      if (pending) {
        pendingTools.delete(exec);
        journal.putEffect({ ...pending, state: result.isError || exec.signal.aborted ? "unknown" : "settled", outcome: result, endedAt: Date.now() });
      }
      const staged = stagedSubmits.get(exec);
      if (staged) {
        stagedSubmits.delete(exec);
        if (!result.isError) {
          if (exec.parent === void 0) staged.state.submitted = { value: staged.value };
          else nestedSubmit = { ...staged, parent: exec.parent };
        }
      } else if (nestedSubmit?.parent === exec.token) {
        if (!result.isError) nestedSubmit.state.submitted = { value: nestedSubmit.value };
        nestedSubmit = void 0;
      }
    });
    childCtx.on("agent/request-error", async (payload, next) => {
      const state = activeState(child);
      if (!state) return next();
      const throttled = payload.failure.status === 429 || payload.failure.status === 503;
      if (state.ticket !== void 0) {
        const changes = throttled ? controller.throttled(Date.now(), state.ticket, payload.failure.status === 429 ? "rate_limited" : "provider_overloaded", payload.failure.providerRetryAfterMs) : controller.failedTransient(Date.now());
        state.ticket = void 0;
        for (const change of changes) sink.concurrencyChanged(change);
      }
      sink.askWaiting(state.instance, { cause: "backoff", reason: payload.failure.code, retryAfterMs: payload.failure.providerRetryAfterMs });
      return next();
    });
    childCtx.on("agent/request", async (payload, next) => {
      const state = activeState(child);
      if (!state || state.finished) throw new Error("\u5F53\u524D\u6CA1\u6709\u83B7\u51C6\u6267\u884C\u7684\u5DE5\u4F5C\u6D41 ask");
      if (state) {
        if (state.ticket !== void 0) {
          for (const change of controller.succeeded(Date.now(), state.ticket)) sink.concurrencyChanged(change);
          state.ticket = void 0;
        }
        while (!controller.canAdmit(Date.now())) {
          sink.askWaiting(state.instance, { cause: "slot" });
          await delay(50, void 0, { signal: payload.signal });
        }
        controller.waiters(Date.now(), Math.max(0, [...states.values()].filter((value) => !value.finished && value.ticket === void 0).length - 1));
        state.ticket = controller.admitted(Date.now());
        sink.askExecuting(state.instance);
      }
      const resolved = await next();
      const { reasoningEffort: _inheritedEffort, ...rest } = resolved;
      return { ...rest, provider: route.provider, model: route.model, ...route.reasoningEffort === void 0 ? {} : { reasoningEffort: route.reasoningEffort }, ...route.maxTokens === void 0 ? {} : { maxTokens: route.maxTokens } };
    });
  }
  async function createActorSession(actor, persona, seed) {
    signal.throwIfAborted();
    if (closing) throw new Error("\u5DE5\u4F5C\u6D41\u5DF2\u7ED3\u675F");
    const existing = journal.getActor(runId, actor.siteId, actor.ordinal);
    let route = persona.model === void 0 ? routes.base : routes.bindings[persona.model];
    if (!route) throw new Error(`\u5DE5\u4F5C\u6D41\u6A21\u578B ${persona.model} \u6CA1\u6709\u83B7\u51C6\u7684\u7ED1\u5B9A`);
    if (existing?.resolvedModel) {
      const pin = JSON.parse(existing.resolvedModel);
      const authorized = [routes.base, ...Object.values(routes.bindings)].find((route2) => route2.provider === pin.provider && route2.model === pin.model) ?? resolveRoutes(parent, { provider: pin.provider, model: pin.model }, { modelReferences: [] }).base;
      route = authorized;
    }
    const link = await native.createActor(actor, persona, route, seed, existing);
    actors.set(link.sessionId, { actor, persona, route, tail: Promise.resolve() });
    journal.putActor({ ...existing, runId, ...actor, name: persona.name, persona, sessionId: link.sessionId, resolvedModel: JSON.stringify(route) });
    return { id: link.sessionId };
  }
  function startAsk(session, instance, message) {
    const owner = actors.get(session.id);
    if (!owner) {
      sink.askFailed(instance, new WorkflowError2("DriverError", "actor \u4F1A\u8BDD\u672A\u521B\u5EFA"));
      return;
    }
    const state = { instance, message, sessionId: session.id, accepted: false, finished: false, toolCalls: 0, worldToolCalls: 0, turns: 0, startedAt: Date.now() };
    states.set(refToString2(instance), state);
    owner.tail = addTask(owner.tail.then(async () => {
      if (closing || signal.aborted || state.cancelled) return;
      await native.beginTask(instance, message, session.id);
      const prompt = message.typed ? `${message.instructions}

Return your result through submit_result({value: ...}). Required JSON Schema:
${JSON.stringify(message.schema)}` : message.instructions;
      state.startSeq = (await ctx.get("sessionQuery").readSession(session.id)).events.length;
      await follow(state, prompt);
      for (; ; ) {
        const child = state.child;
        await child.whenIdle();
        state.turns++;
        if (ctx.get("agents").get(child.id) === child) await ctx.get("sessions").flush(child.session);
        const snapshot = await ctx.get("sessionQuery").readSession(child.id);
        state.reason = snapshot.events.findLast((row) => row.type === "turn/end")?.data.reason;
        const final = child.session.deriveMessages().filter((row) => row.role === "assistant").at(-1);
        const finalText = (final?.content ?? []).filter((block) => block.type === "text").map((block) => block.text).join("\n");
        if (state.cancelled || signal.aborted) {
          await setBoundary(state, child);
          break;
        }
        sink.askProgress(instance, { turn: state.turns, toolCalls: state.toolCalls, ...state.lastTool ? { lastTool: state.lastTool } : {} });
        const fresh = snapshot.events.slice(state.statsEventCount ?? state.startSeq ?? 0);
        const tokens = fresh.reduce((total, event) => total + (event.type === "assistant/message" ? event.data.usage?.totalTokens ?? (event.data.usage?.inputTokens ?? 0) + (event.data.usage?.outputTokens ?? 0) : 0), 0);
        sink.askStats(instance, { tokens, toolCalls: state.toolCalls - (state.statsTools ?? 0), worldToolCalls: state.worldToolCalls - (state.statsWorldTools ?? 0), turns: 1 });
        config.observeModel?.(owner.route, { elapsedMs: Date.now() - state.startedAt, tokens, failed: state.reason?.kind !== "completed" });
        state.statsTools = state.toolCalls;
        state.statsWorldTools = state.worldToolCalls;
        state.statsEventCount = snapshot.events.length;
        if (state.reason?.kind !== "completed") {
          sink.askFailed(instance, new WorkflowError2("DriverError", JSON.stringify(state.reason ?? { kind: "missing-turn-end" })));
          break;
        }
        if (state.submitted) {
          sink.askSubmitAttempted(instance, state.submitted.value);
          state.accepted = state.verdict?.kind === "accept";
        }
        if (state.ticket !== void 0) {
          for (const change of controller.succeeded(Date.now(), state.ticket)) sink.concurrencyChanged(change);
          state.ticket = void 0;
        }
        if (state.accepted) {
          await setBoundary(state, child);
          break;
        }
        state.verdict = void 0;
        sink.askTurnEnded(instance, finalText);
        if (!message.typed) {
          await setBoundary(state, child);
          break;
        }
        if (state.verdict?.kind === "nudge") {
          state.submitted = void 0;
          await follow(state, "Submit your answer using submit_result({value: ...}) now.");
          continue;
        }
        break;
      }
      await setBoundary(state, state.child);
    }).catch((error) => {
      sink.askFailed(instance, err(error));
    }).finally(async () => {
      state.finished = true;
      if (state.ticket !== void 0) {
        controller.ended(Date.now());
        state.ticket = void 0;
      }
      await native.settleTask(instance);
    }));
  }
  const driver = {
    journal,
    emit,
    createActorSession,
    startAsk,
    setMaxConcurrency(value) {
      for (const change of controller.setGrowthLimit(Date.now(), value)) sink.concurrencyChanged(change);
    },
    respondToSubmit(instance, verdict) {
      const state = states.get(refToString2(instance));
      if (state) state.verdict = verdict;
    },
    cancelAsk(instance) {
      const state = states.get(refToString2(instance));
      if (state && !state.finished) {
        state.cancelled = true;
        if (state.ticket !== void 0) {
          controller.ended(Date.now());
          state.ticket = void 0;
        }
        ;
        native.interrupt(state.sessionId);
      }
    },
    executeWorldRead: world.execute,
    executeArtifactPublish: world.publish,
    dispose() {
      closing = true;
      cleanup ??= (async () => {
        const stopped = await Promise.allSettled([native.stop()]);
        const settled = await Promise.allSettled([...tasks]);
        try {
          const errors = [...stopped, ...settled].filter((row) => row.status === "rejected").map((row) => row.reason);
          if (errors.length) throw new AggregateError(errors, "\u539F\u751F\u56E2\u961F\u6536\u53E3\u5931\u8D25");
        } finally {
          await native.dispose();
        }
      })();
      cleanup.catch((error) => ctx.logger?.warn(`workflow cleanup: ${error.message}`));
    },
    async quiesce() {
      driver.dispose();
      await cleanup;
    }
  };
  return driver;
}

// workflow/host/manager.js
var terminal = /* @__PURE__ */ new Set(["completed", "errored", "stopped"]);
var fail = (message, code = "WorkflowError") => {
  const error = new Error(message);
  error.code = code;
  throw error;
};
var jsonCopy = (value) => JSON.parse(JSON.stringify(value));
var argsOf = (value) => {
  if (value === void 0) return {};
  if (!value || typeof value !== "object" || Array.isArray(value) || Buffer.byteLength(JSON.stringify(value)) > 256 * 1024) fail("\u5DE5\u4F5C\u6D41 args \u5FC5\u987B\u662F\u6700\u591A 256 KiB \u7684 JSON \u5BF9\u8C61");
  return jsonCopy(value);
};
var concurrencyOf = (value) => {
  const count = value ?? 4;
  if (!Number.isInteger(count) || count < 1 || count > 64) fail("\u5E76\u53D1\u6570\u5FC5\u987B\u662F 1\u201364 \u7684\u6574\u6570");
  return count;
};
var cwdOf = (parent) => parent.ctx.get?.("workingDirectory")?.get(parent.session) ?? parent.session.header.cwd;
var labelOf = (value) => {
  if (value === void 0) return "\u52A8\u6001\u5DE5\u4F5C\u6D41";
  if (typeof value !== "string" || !value.trim() || value.length > 120) fail("\u5DE5\u4F5C\u6D41\u540D\u79F0\u5FC5\u987B\u662F 1\u2013120 \u4E2A\u5B57\u7B26");
  return value.trim();
};
var ROUTING_OBJECTIVES = /* @__PURE__ */ new Set(["none", "latency", "cost", "balanced"]);
var routingOf = (value) => {
  if (value === void 0) return "none";
  if (!ROUTING_OBJECTIVES.has(value)) fail("\u8DEF\u7531\u76EE\u6807\u5FC5\u987B\u662F none\u3001latency\u3001cost \u6216 balanced");
  return value;
};
async function createWorkflowManager(ctx, options = {}) {
  const directory = options.storeDir ?? join3(process.env.DSH_HOME ?? join3(homedir(), ".dsh"), "composer-assist", "workflows");
  const journal = await openJournal(directory);
  const modelStats = createModelStats(directory);
  modelStats.prune();
  const routingInput = (parent, meta) => {
    const candidates = parent.ctx.get("subagentModelSelection")?.current()?.allowedModels ?? [];
    const objective = meta.routing === void 0 ? "none" : meta.routing;
    return { ...meta, objective, stats: { candidates, scoreOf: (route, goal) => modelStats.scoreOf(route, goal) } };
  };
  const compiler = createCompilerScope();
  const { compile, requireCompiled, compileHole } = compiler;
  const scriptDirectory = join3(directory, "sandbox");
  mkdirSync3(scriptDirectory, { recursive: true, mode: 448 });
  const active = /* @__PURE__ */ new Map();
  const starting = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Set();
  let disposed = false;
  const assertParent = (parent) => {
    if (disposed) fail("\u5DE5\u4F5C\u6D41\u7BA1\u7406\u5668\u5DF2\u5173\u95ED");
    if (!parent || typeof parent.id !== "string" || ctx.agents.get(parent.id) !== parent) fail("\u5FC5\u987B\u4F7F\u7528\u5F53\u524D\u7CBE\u786E\u7684\u6D3B\u8DC3\u7236 Agent", "WorkflowOwnerMismatch");
    if (!cwdOf(parent)) fail("\u7236\u4F1A\u8BDD\u7F3A\u5C11\u5DE5\u4F5C\u76EE\u5F55");
    return parent;
  };
  const metadata = (id) => journal.getDocument(`run:${id}`);
  const nativeNode = (id, node) => {
    const link = journal.getDocument(`native-task:${id}:${refToString3(node)}`);
    return link ? { ...node, nativeTask: link } : node;
  };
  const storeMeta = (value) => journal.putDocument(`run:${value.id}`, value.sessionId, "metadata", value);
  const broadcast = (id, sessionId, event) => {
    for (const listener of listeners) {
      try {
        listener({ runId: id, sessionId, event });
      } catch (error) {
        ctx.logger?.warn(`workflow listener: ${error.message}`);
      }
    }
  };
  const checked = (parent, id) => {
    assertParent(parent);
    const meta = metadata(id);
    if (!meta || meta.sessionId !== parent.id || meta.cwd !== cwdOf(parent)) fail("\u5DE5\u4F5C\u6D41\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u7236\u4F1A\u8BDD", "WorkflowOwnerMismatch");
    return meta;
  };
  const touch = (id, extra = {}) => {
    const meta = metadata(id);
    if (meta) storeMeta({ ...meta, ...extra, updatedAt: Date.now() });
  };
  const record = (id, event) => {
    journal.appendEvent(id, event);
    broadcast(id, metadata(id).sessionId, event);
    touch(id);
  };
  const detachCoordinators = ctx.on?.("agent/created", ({ agent }) => {
    if (!agent.id.startsWith("dwf-team-")) return;
    const team = journal.getDocument(`native-team:${agent.id.slice("dwf-team-".length)}`);
    if (team?.teamSessionId === agent.id) ctx.effect(() => agent.ctx.on("agent/pre-step", ({ messages }) => parkWorkflowMessages(agent, messages)));
  });
  const orphan = (id) => {
    const run = journal.getRun(id);
    if (run && !active.has(id) && !terminal.has(run.status)) journal.updateRunStatus(id, "stopped", { stopReason: "interrupted", failure: { code: "Interrupted", message: "\u4E0A\u6B21 Host \u5728\u8BB0\u5F55\u7EC8\u6001\u524D\u4E2D\u65AD\uFF0C\u6062\u590D\u524D\u8BF7\u6838\u5BF9\u672A\u77E5\u7ED3\u679C" } });
  };
  const holds = (id) => journal.listEffects(id).filter((row) => (row.state === "pending" || row.state === "unknown") && !row.resolution).map((row) => ({ ...row, nodeId: row.id, state: active.has(id) && row.state === "pending" ? "pending" : "unknown" }));
  const snapshot = async (parent, id) => {
    const meta = checked(parent, id);
    orphan(id);
    const run = journal.getRun(id);
    const compiled = await compile(run?.scriptText ?? meta.script);
    checked(parent, id);
    const nodePage = run ? journal.pageNodes(id) : { nodes: [], nextCursor: 0, hasMore: false };
    const nodes = nodePage.nodes.map((node) => nativeNode(id, node));
    const events = run ? journal.listEvents(id, { types: "all", reportItems: { limit: 256 }, afterSequence: journal.lastSequence(id) - 1e3, limit: 1e3 }) : [];
    let markdownBytes = 0;
    const artifacts = run ? journal.listNodes(id, { kinds: ["artifact"], withResult: true }).filter((row) => row.status === "completed").map((row) => {
      const artifact = row.result;
      if (artifact.kind === "markdown") {
        if (markdownBytes + (artifact.bytes ?? 0) > 512 * 1024) return { ...artifact, contentOmitted: true };
        const stored = journal.getArtifact(id, artifact.id, artifact.version);
        if (stored) {
          markdownBytes += stored.bytes.length;
          return { ...artifact, content: Buffer.from(stored.bytes).toString("utf8") };
        }
      }
      ;
      return artifact;
    }) : [];
    const reports = run ? journal.listNodes(id, { kinds: ["report"], withResult: true, limit: 256, maxResultBytes: 2 * 1024 * 1024 }).map((row) => ({ instance: { siteId: row.siteId, ordinal: row.ordinal }, item: row.result, ...row.artifactId ? { artifactId: row.artifactId } : {} })) : [];
    const instance = active.get(id);
    const reached = new Map(events.filter((row) => row.event.type === "hole-reached").map((row) => [row.event.instance.siteId, row.event]));
    const open = instance?.control?.openHoles() ?? [];
    const questions = journal.listQuestions(id).map((question) => ({ ...question, live: instance?.questions.has(question.id) ?? false }));
    return jsonCopy({ ...meta, script: run?.scriptText ?? meta.script, status: run?.status ?? "draft", analysis: compiled.analysis, concurrency: run?.caps.maxConcurrency ?? meta.concurrency, siteStates: run ? journal.siteStates(id) : [], nativeTeam: journal.getDocument(`native-team:${id}`), actors: run ? journal.listActors(id, { withPersona: false }).map((actor) => ({ ...actor, nativeMember: journal.getDocument(`native-actor:${id}:${refToString3(actor)}`) })) : [], nodes, nodesPage: { nextCursor: nodePage.nextCursor, hasMore: nodePage.hasMore }, events, eventsPage: { afterSequence: events[0]?.sequence ?? -1, lastSequence: events.at(-1)?.sequence ?? -1, earlierOmitted: (events[0]?.sequence ?? 0) > 0 }, questions, holes: open.map((hole) => ({ ...hole, id: hole.siteId, prompt: reached.get(hole.siteId)?.prompt })), artifacts, reports, reportsPage: { limit: 256, hasMore: run ? journal.countNodes(id, "report") > reports.length : false }, holds: run ? holds(id) : [], result: run?.result, error: run?.failure ?? (meta.nativeTeamError ? { code: "NativeTeamError", message: meta.nativeTeamError } : void 0), stopReason: run?.stopReason, resumedFrom: run?.resumedFrom, supersededBy: run?.supersededBy, spentTokens: run?.spentTokens ?? 0, counts: run ? { nodes: ["ask", "world-read", "world-run"].reduce((sum, kind) => sum + journal.countNodes(id, kind), 0), reports: journal.countNodes(id, "report"), artifacts: journal.countNodes(id, "artifact") } : { nodes: 0, reports: 0, artifacts: 0 } });
  };
  function importedCache(predecessor) {
    const actorRows = journal.listActors(predecessor.runId, { withPersona: true });
    const nodes = journal.listNodes(predecessor.runId, { kinds: ["ask", "world-read", "world-run"], withResult: true });
    const actors = /* @__PURE__ */ new Map();
    const names = /* @__PURE__ */ new Map();
    for (const row of actorRows) if (row.name) names.set(row.name, (names.get(row.name) ?? 0) + 1);
    for (const row of actorRows) {
      if (!row.name || names.get(row.name) !== 1 || !row.persona) continue;
      const asks = nodes.filter((node) => node.kind === "ask" && node.actorSiteId === row.siteId && node.actorOrdinal === row.ordinal).sort((a, b) => a.actorSeq - b.actorSeq);
      const entries = [];
      for (const ask of asks) {
        if (ask.actorSeq !== entries.length || ask.status !== "completed") break;
        if (!Number.isInteger(ask.messageBoundary)) fail("\u524D\u9A71\u7F3A\u5C11\u5B8C\u6574\u8F6C\u5F55\u8FB9\u754C\uFF0C\u4E0D\u80FD\u5B89\u5168\u4FEE\u8BA2\u63A5\u7EED");
        entries.push({ inputHash: ask.inputHash, result: ask.result, stats: ask.stats, messageBoundary: ask.messageBoundary });
      }
      const next = asks[entries.length];
      if (!entries.length && next?.status !== "running") continue;
      let source = row;
      let ancestor = predecessor;
      const seen = /* @__PURE__ */ new Set();
      while (!source.sessionId && ancestor.resumedFrom && !seen.has(ancestor.runId)) {
        seen.add(ancestor.runId);
        ancestor = journal.getRun(ancestor.resumedFrom);
        if (!ancestor) break;
        source = journal.listActors(ancestor.runId, { name: row.name, withPersona: true })[0] ?? source;
      }
      if (!source.sessionId) continue;
      let inFlight;
      if (next?.status === "running" && row.sessionId && source.sessionId === row.sessionId) {
        const checkpoint = journal.getDocument(`transcript-latest:${source.sessionId}`);
        if (!checkpoint || !Number.isInteger(checkpoint.messageCount) || checkpoint.messageCount < (entries.at(-1)?.messageBoundary ?? 0)) fail("\u524D\u9A71\u8FDB\u884C\u4E2D\u7684 ask \u7F3A\u5C11\u5B89\u5168\u8F6C\u5F55\u8FB9\u754C\uFF0C\u62D2\u7EDD\u4E22\u5F03\u90E8\u5206\u5DE5\u4F5C\u91CD\u65B0\u6267\u884C");
        inFlight = { inputHash: next.inputHash, messageBoundary: checkpoint.messageCount };
      }
      if (!entries.length && !inFlight) continue;
      actors.set(row.name, { persona: row.persona, entries, ...inFlight ? { inFlight } : {}, transcriptSourceSessionId: source.sessionId, resolvedModel: source.resolvedModel });
    }
    const world = /* @__PURE__ */ new Map();
    for (const node of nodes) if ((node.kind === "world-read" || node.kind === "world-run") && node.status === "completed") {
      const bucket = world.get(node.inputHash) ?? [];
      bucket.push({ inputHash: node.inputHash, kind: node.kind, result: node.result });
      world.set(node.inputHash, bucket);
    }
    return { actors, world };
  }
  async function execute(parent, meta, resumedFrom) {
    assertParent(parent);
    if (active.has(meta.id) || starting.has(meta.id)) fail("\u8BE5\u5DE5\u4F5C\u6D41\u6B63\u5728\u542F\u52A8\u6216\u8FD0\u884C");
    const gate = { cancelled: false };
    starting.set(meta.id, gate);
    try {
      const compiled = await requireCompiled(journal.getRun(meta.id)?.scriptText ?? meta.script);
      const routes = options.resolveRoutes ? await options.resolveRoutes(parent, meta, compiled.analysis) : resolveRoutes(parent, routingInput(parent, meta), compiled.analysis);
      checked(parent, meta.id);
      if (gate.cancelled) fail("\u5DE5\u4F5C\u6D41\u542F\u52A8\u5DF2\u7ECF\u53D6\u6D88");
      if (!meta.routePin) {
        meta = { ...meta, routePin: jsonCopy(routes) };
        storeMeta(meta);
      }
      const existing = journal.getRun(meta.id);
      const blocked = existing ? holds(meta.id) : [];
      if (blocked.length) fail("\u5B58\u5728\u7ED3\u679C\u672A\u77E5\u7684\u526F\u4F5C\u7528\uFF0C\u8BF7\u5148\u9009\u62E9\u660E\u786E\u91CD\u8BD5\u6216\u63A5\u7EB3\u8282\u70B9\u7ED3\u679C", "WorkflowRecoveryHeld");
      if (existing) {
        for (const node of journal.listNodes(meta.id, { kinds: ["world-run"], withResult: false })) {
          if (node.status !== "running") continue;
          const effect = journal.getEffect(`${meta.id}:world:${refToString3(node)}`);
          if (effect?.state === "settled" && effect.value !== void 0) journal.putNode({ ...node, status: "completed", result: effect.value });
          else if (effect?.state === "settled" && effect.error) journal.putNode({ ...node, status: "failed", error: { code: "WorldCommandFailed", message: effect.error } });
        }
      }
      const source = resumedFrom ?? existing?.resumedFrom;
      const predecessor = source ? journal.getRun(source) : void 0;
      const controller = new AbortController();
      const running2 = { abort: controller, routes, control: void 0, driver: void 0, promise: void 0, questions: /* @__PURE__ */ new Map() };
      active.set(meta.id, running2);
      const ownJournal = Object.create(journal);
      ownJournal.createRun = (row) => journal.createRun({ ...row, cwd: meta.cwd });
      let pendingSettle = null;
      const flushSettle = () => {
        if (pendingSettle) {
          journal.putNode(pendingSettle);
          pendingSettle = null;
        }
      };
      ownJournal.putNode = (record2) => {
        const settled = record2.status === "completed" || record2.status === "failed";
        if (!settled) {
          flushSettle();
          journal.putNode(record2);
          return;
        }
        flushSettle();
        pendingSettle = record2;
      };
      ownJournal.appendEvent = (runId, event) => {
        if (!pendingSettle || event.type !== "node-settled") {
          flushSettle();
          return journal.appendEvent(runId, event);
        }
        const node = pendingSettle;
        pendingSettle = null;
        return journal.transaction(() => {
          journal.putNode(node);
          return journal.appendEvent(runId, event);
        });
      };
      for (const key of ["getNode", "listNodes", "countNodes", "siteStates"]) ownJournal[key] = (...args) => {
        flushSettle();
        return journal[key](...args);
      };
      const usedWorldNodes = /* @__PURE__ */ new Set();
      const recordEffect = (op, args) => {
        const hash = inputHash({ op, args });
        const node = journal.listNodes(meta.id, { kinds: ["world-run"], withResult: false }).find((value2) => value2.status === "running" && value2.inputHash === hash && !usedWorldNodes.has(refToString3(value2)));
        if (!node) fail("\u4E16\u754C\u547D\u4EE4\u7F3A\u5C11\u4E0A\u6E38\u51C6\u5165\u65E5\u5FD7\uFF0C\u62D2\u7EDD\u6267\u884C");
        const id = `${meta.id}:world:${refToString3(node)}`;
        usedWorldNodes.add(refToString3(node));
        const previous = journal.getEffect(id);
        if (previous?.resolution === "accept") return previous;
        if (previous?.state === "settled" && previous.value !== void 0) return { ...previous, resolution: "accept" };
        if (previous?.state === "settled" && previous.error) fail(previous.error, "WorldCommandFailed");
        if (previous && previous.state !== "settled" && previous.resolution !== "retry") fail("\u4E16\u754C\u547D\u4EE4\u7ED3\u679C\u672A\u77E5\uFF0C\u5FC5\u987B\u5148\u4EBA\u5DE5\u786E\u8BA4", "WorkflowRecoveryHeld");
        const value = { id, runId: meta.id, nodeId: refToString3(node), instance: { siteId: node.siteId, ordinal: node.ordinal }, kind: "world-run", op, args, state: "pending", startedAt: Date.now() };
        journal.putEffect(value);
        return value;
      };
      const settleEffect = (id, value, error) => {
        const previous = journal.getEffect(id);
        journal.putEffect({ ...previous, state: error ? "unknown" : "settled", ...value === void 0 ? {} : { value }, ...error ? { error: error.message } : {}, endedAt: Date.now() });
      };
      const askQuestion = (input, signal) => {
        if (typeof input.question !== "string" || !input.question.trim() || input.question.length > 4e3 || input.context !== void 0 && (typeof input.context !== "string" || input.context.length > 4e3)) fail("\u95EE\u9898\u6216\u4E0A\u4E0B\u6587\u65E0\u6548");
        const id = randomUUID2();
        const question = { id, question: input.question, context: input.context, actorId: refToString3(input.actor), instance: input.instance, status: "waiting", askedAt: Date.now() };
        journal.putDocument(`question:${id}`, meta.id, "question", question);
        record(meta.id, { type: "escalation-raised", qid: id, actor: input.actor, actorName: input.actorName, question: input.question, context: input.context, askedAt: question.askedAt });
        return new Promise((resolve, reject) => {
          const cancel = () => {
            running2.questions.delete(id);
            const saved = journal.getDocument(`question:${id}`);
            if (saved?.status === "waiting") journal.putDocument(`question:${id}`, meta.id, "question", { ...saved, status: "cancelled", cancelledAt: Date.now() });
            reject(new Error("\u5DE5\u4F5C\u6D41\u505C\u6B62\uFF0C\u63D0\u95EE\u5DF2\u53D6\u6D88"));
          };
          signal.addEventListener("abort", cancel, { once: true });
          if (signal.aborted) {
            cancel();
            return;
          }
          running2.questions.set(id, { answer: (value) => {
            signal.removeEventListener("abort", cancel);
            running2.questions.delete(id);
            resolve(value);
          } });
        });
      };
      const runOptions = { runId: meta.id, name: meta.name, scriptText: existing?.scriptText ?? meta.script, scriptHash: compiled.hash, lowered: compiled.lowered.code, args: existing?.args ?? meta.args, caps: { maxConcurrency: existing?.caps.maxConcurrency ?? meta.concurrency }, askSpecs: compiled.askSpecs, sitePhases: compiled.sitePhases, validate: validate2, cwd: scriptDirectory, parentSessionId: parent.id, signal: controller.signal, ...source ? { resumedFrom: source } : {}, ...predecessor ? { importedCache: importedCache(predecessor), inheritedTokens: predecessor.spentTokens } : {}, launch: { inputId: meta.id, ...compiled.analysis.phases, subagentModel: `${routes.base.provider}/${routes.base.model}`, modelBindings: Object.fromEntries(Object.entries(routes.bindings).map(([name, route]) => [name, `${route.provider}/${route.model}`])) }, control: { bind: (engine) => {
        running2.control = engine;
      } }, makeDriver: (sink) => {
        const emit = (event) => {
          broadcast(meta.id, parent.id, event);
          touch(meta.id);
        };
        const config = { hostContext: ctx, cwd: meta.cwd, journal: ownJournal, runId: meta.id, sink, signal: controller.signal, emit, routes, askQuestion, recordEffect, settleEffect, concurrency: meta.concurrency, observeModel: (route, sample) => modelStats.observe(route, sample) };
        const driver = options.driverFactory ? options.driverFactory(parent, config) : createDshDriver(parent, config);
        running2.driver = driver;
        return driver;
      } };
      running2.promise = (async () => {
        try {
          return await runWorkflowScript(runOptions);
        } catch (error) {
          if (journal.getRun(meta.id)) journal.updateRunStatus(meta.id, "stopped", { stopReason: "interrupted", failure: { code: "Interrupted", message: error.message } });
          else touch(meta.id, { launchError: error.message });
          throw error;
        } finally {
          try {
            await running2.driver?.quiesce?.();
          } catch (error) {
            touch(meta.id, { nativeTeamError: error.message });
            throw error;
          } finally {
            active.delete(meta.id);
            touch(meta.id);
            broadcast(meta.id, parent.id, { type: "manager-settled" });
          }
        }
      })();
      running2.promise.catch((error) => ctx.logger?.warn(`workflow ${meta.id}: ${error.message}`));
      await Promise.resolve();
      return snapshot(parent, meta.id);
    } finally {
      starting.delete(meta.id);
    }
  }
  const detachParent = ctx.on?.("agent/disposed", ({ agent }) => {
    for (const [id, run] of active) if (metadata(id)?.sessionId === agent.id) run.abort.abort("interrupted");
  });
  const manager = {
    async analyze(script) {
      return (await compile(typeof script === "string" ? script : script.script)).analysis;
    },
    async prepare(parent, input) {
      assertParent(parent);
      const script = input.script;
      const compiled = await requireCompiled(script);
      assertParent(parent);
      const id = randomUUID2();
      const meta = { id, sessionId: parent.id, cwd: cwdOf(parent), name: labelOf(input.name), script, args: argsOf(input.args), concurrency: concurrencyOf(input.concurrency), ...routingOf(input.routing) === "none" ? {} : { routing: routingOf(input.routing) }, ...input.provider === void 0 ? {} : { provider: input.provider, model: input.model }, createdAt: Date.now(), updatedAt: Date.now() };
      if (!options.resolveRoutes) resolveRoutes(parent, routingInput(parent, meta), compiled.analysis);
      storeMeta(meta);
      broadcast(id, parent.id, { type: "draft-prepared", id });
      return snapshot(parent, id);
    },
    async launch(parent, id) {
      const meta = checked(parent, id);
      if (journal.getRun(id)) fail("\u8349\u7A3F\u5DF2\u7ECF\u542F\u52A8\u8FC7\uFF0C\u8BF7\u4F7F\u7528\u6062\u590D");
      return execute(parent, meta);
    },
    async create(parent, input) {
      const draft = await manager.prepare(parent, input);
      return manager.launch(parent, draft.id);
    },
    async list(parent) {
      assertParent(parent);
      const metas = journal.listDocuments(parent.id, "metadata", 100).filter((meta) => meta.cwd === cwdOf(parent));
      return jsonCopy(metas.map((meta) => {
        checked(parent, meta.id);
        orphan(meta.id);
        const run = journal.getRun(meta.id);
        return { id: meta.id, name: meta.name, sessionId: parent.id, status: run?.status ?? "draft", createdAt: meta.createdAt, updatedAt: meta.updatedAt, resumedFrom: run?.resumedFrom, supersededBy: run?.supersededBy, concurrency: run?.caps.maxConcurrency ?? meta.concurrency, error: run?.failure };
      }));
    },
    async get(parent, id) {
      return snapshot(parent, id);
    },
    async reports(parent, { id, after = 0, limit = 256, artifactId }) {
      checked(parent, id);
      if (!Number.isInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 1e3 || artifactId !== void 0 && (typeof artifactId !== "string" || artifactId.length > 64)) fail("\u62A5\u544A\u5206\u9875\u53C2\u6570\u65E0\u6548");
      const page = journal.pageNodes(id, { after, limit, kinds: ["report"], artifactId });
      return { reports: page.nodes.map((row) => ({ instance: { siteId: row.siteId, ordinal: row.ordinal }, item: row.result, ...row.artifactId ? { artifactId: row.artifactId } : {} })), nextCursor: page.nextCursor, hasMore: page.hasMore };
    },
    async nodes(parent, { id, after = 0, limit = 300 }) {
      checked(parent, id);
      if (!Number.isInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 1e3) fail("\u8282\u70B9\u5206\u9875\u53C2\u6570\u65E0\u6548");
      const page = journal.pageNodes(id, { after, limit });
      return { ...page, nodes: page.nodes.map((node) => nativeNode(id, node)) };
    },
    async events(parent, { id, afterSequence = -1, limit = 500 }) {
      checked(parent, id);
      if (!Number.isInteger(afterSequence) || afterSequence < -1 || !Number.isInteger(limit) || limit < 1 || limit > 1e3) fail("\u4E8B\u4EF6\u5206\u9875\u53C2\u6570\u65E0\u6548");
      return journal.listEvents(id, { types: "all", reportItems: { limit: 256 }, afterSequence, limit });
    },
    async stop(parent, id) {
      checked(parent, id);
      const pending = starting.get(id);
      if (pending) pending.cancelled = true;
      const run = active.get(id);
      if (run) {
        run.abort.abort("user");
        await run.promise.catch(() => {
        });
      }
      ;
      return snapshot(parent, id);
    },
    async resume(parent, id) {
      const meta = checked(parent, id);
      orphan(id);
      const row = journal.getRun(id);
      if (!row || row.status !== "stopped" || row.stopReason === "superseded") fail("\u53EA\u6709\u5DF2\u505C\u6B62\u4E14\u672A\u88AB\u66FF\u4EE3\u7684\u5DE5\u4F5C\u6D41\u53EF\u4EE5\u6062\u590D");
      return execute(parent, meta);
    },
    async amend(parent, input) {
      const meta = checked(parent, input.id);
      const row = journal.getRun(input.id);
      if (!row) fail("\u8349\u7A3F\u8BF7\u76F4\u63A5\u91CD\u65B0\u51C6\u5907");
      if (row.stopReason === "superseded") fail("\u524D\u9A71\u5DF2\u7ECF\u88AB\u4FEE\u8BA2\u53D6\u4EE3\uFF0C\u8BF7\u64CD\u4F5C\u5B83\u7684\u540E\u7EE7\u5DE5\u4F5C\u6D41");
      const script = input.script ?? row.scriptText;
      const compiled = await requireCompiled(script);
      assertParent(parent);
      const args = input.args === void 0 ? row.args ?? {} : argsOf(input.args);
      const concurrency = concurrencyOf(input.concurrency ?? row.caps.maxConcurrency);
      const nextMeta = { ...meta, id: randomUUID2(), script, args, concurrency, ...input.name === void 0 ? {} : { name: labelOf(input.name) }, ...input.provider === void 0 ? {} : { provider: input.provider, model: input.model, routePin: void 0 }, createdAt: Date.now(), updatedAt: Date.now() };
      if (!options.resolveRoutes) resolveRoutes(parent, routingInput(parent, nextMeta), compiled.analysis);
      if (holds(input.id).some((hold) => hold.state === "unknown")) fail("\u524D\u9A71\u5B58\u5728\u7ED3\u679C\u672A\u77E5\u7684\u64CD\u4F5C\uFF0C\u5148\u5904\u7406\u540E\u518D\u4FEE\u8BA2", "WorkflowRecoveryHeld");
      if (script === row.scriptText && inputHash(args) === inputHash(row.args ?? {}) && input.provider === void 0) {
        storeMeta({ ...meta, concurrency });
        const live = active.get(input.id);
        if (live?.control) {
          live.control.setMaxConcurrency(concurrency);
          live.driver?.setMaxConcurrency?.(concurrency);
        } else journal.updateRunCaps(input.id, { maxConcurrency: concurrency });
        return snapshot(parent, input.id);
      }
      await manager.stop(parent, input.id);
      if (holds(input.id).length) fail("\u505C\u6B62\u540E\u6709\u7ED3\u679C\u672A\u77E5\u7684\u64CD\u4F5C\uFF0C\u5148\u6838\u5BF9\u540E\u518D\u4FEE\u8BA2", "WorkflowRecoveryHeld");
      const source = journal.getRun(input.id);
      if (source.stopReason === "superseded") fail("\u524D\u9A71\u5DF2\u7ECF\u88AB\u53E6\u4E00\u4FEE\u8BA2\u53D6\u4EE3");
      const canImport = inputHash(args) === inputHash(source.args ?? {});
      if (canImport) importedCache(source);
      storeMeta(nextMeta);
      journal.updateRunStatus(input.id, "stopped", { stopReason: "superseded", supersededBy: nextMeta.id });
      return execute(parent, nextMeta, canImport ? input.id : void 0);
    },
    async answer(parent, { id, questionId, answer }) {
      checked(parent, id);
      if (typeof answer !== "string" || !answer.trim() || answer.length > 16e3) fail("\u56DE\u7B54\u5FC5\u987B\u662F 1\u201316000 \u4E2A\u5B57\u7B26");
      const question = journal.getDocument(`question:${questionId}`);
      const pending = active.get(id)?.questions.get(questionId);
      if (!question || !pending || question.status !== "waiting") fail("\u8BE5\u95EE\u9898\u5DF2\u4E0D\u5728\u7B49\u5F85\u56DE\u7B54");
      journal.putDocument(`question:${questionId}`, id, "question", { ...question, status: "answered", answer, answeredAt: Date.now() });
      record(id, { type: "escalation-resolved", qid: questionId, answer });
      pending.answer(answer);
      return snapshot(parent, id);
    },
    async fillHole(parent, { id, holeId, body }) {
      const meta = checked(parent, id);
      const run = active.get(id);
      if (!run?.control) fail("\u5DE5\u4F5C\u6D41\u5F53\u524D\u672A\u8FD0\u884C\uFF0C\u65E0\u6CD5\u8865\u5168\u7559\u767D");
      const { script, compiled } = await compileHole(journal.getRun(id).scriptText, holeId, body);
      checked(parent, id);
      const nextRoutes = options.resolveRoutes ? await options.resolveRoutes(parent, meta, compiled.analysis) : resolveRoutes(parent, routingInput(parent, meta), compiled.analysis);
      Object.assign(run.routes.bindings, nextRoutes.bindings);
      const result = run.control.fillHole({ siteId: holeId, code: compiled.lowered.holeBodies[holeId], script: { text: script, hash: compiled.hash }, askSpecs: compiled.askSpecs, sitePhases: compiled.sitePhases, ...compiled.analysis.phases, filledBy: parent.id });
      if (!result.ok) fail(`\u7559\u767D\u6CA1\u6709\u53EF\u8865\u5168\u7684\u7B49\u5F85\u5206\u652F\uFF1A${result.reason}`);
      storeMeta({ ...metadata(id), routePin: jsonCopy(run.routes) });
      return snapshot(parent, id);
    },
    async resolveHold(parent, { id, nodeId, resolution, value }) {
      checked(parent, id);
      if (active.has(id)) fail("\u8BF7\u5148\u505C\u6B62\u5DE5\u4F5C\u6D41\u518D\u5904\u7406\u672A\u77E5\u7ED3\u679C");
      const hold = journal.getEffect(nodeId);
      if (!hold || hold.runId !== id || hold.resolution || !["pending", "unknown"].includes(hold.state)) fail("\u672A\u77E5\u7ED3\u679C\u8BB0\u5F55\u4E0D\u5B58\u5728\u6216\u5DF2\u5904\u7406");
      if (!["retry", "accept"].includes(resolution)) fail("resolution \u5FC5\u987B\u662F retry \u6216 accept");
      const node = journal.getNode(id, hold.instance.siteId, hold.instance.ordinal);
      if (!node) fail("\u672A\u77E5\u7ED3\u679C\u6CA1\u6709\u5BF9\u5E94\u8282\u70B9");
      const compiled = resolution === "accept" ? await requireCompiled(journal.getRun(id).scriptText) : void 0;
      checked(parent, id);
      if (active.has(id)) fail("\u5DE5\u4F5C\u6D41\u5DF2\u7ECF\u91CD\u65B0\u5F00\u59CB\u8FD0\u884C");
      journal.transaction(() => {
        if (journal.getEffect(nodeId).resolution) fail("\u672A\u77E5\u7ED3\u679C\u5DF2\u7ECF\u5904\u7406");
        if (resolution === "accept") {
          const spec = compiled.askSpecs.get(node.siteId);
          if (node.kind === "ask") {
            if (spec?.typed) {
              const violations = validate2(spec.schema, value);
              if (violations.length) fail(`\u7ED3\u679C\u4E0D\u7B26\u5408\u8282\u70B9 schema\uFF1A${JSON.stringify(violations)}`);
            } else if (typeof value !== "string") fail("\u65E0\u7C7B\u578B ask \u7684\u63A5\u7EB3\u7ED3\u679C\u5FC5\u987B\u662F\u5B57\u7B26\u4E32");
          } else if (node.kind === "world-run" && (!value || !Number.isInteger(value.exitCode) || typeof value.stdout !== "string" || typeof value.stderr !== "string")) fail("\u4E16\u754C\u547D\u4EE4\u7ED3\u679C\u9700\u8981 exitCode\u3001stdout\u3001stderr");
          journal.putNode({ ...node, status: "completed", result: jsonCopy(value), error: void 0 });
        } else {
          const { result: _result, error: _error, ...pending } = node;
          journal.putNode({ ...pending, status: "running" });
        }
        journal.putEffect({ ...hold, state: "resolved", resolution, ...resolution === "accept" ? { value: jsonCopy(value) } : {}, resolvedAt: Date.now(), resolvedBy: parent.id });
        if (!holds(id).length && journal.getRun(id).status === "errored") journal.updateRunStatus(id, "stopped", { stopReason: "user" });
      });
      record(id, { type: "log", message: `\u7528\u6237\u5DF2${resolution === "retry" ? "\u786E\u8BA4\u91CD\u8BD5" : "\u63A5\u7EB3\u7ED3\u679C"}\uFF1A${nodeId}` });
      return snapshot(parent, id);
    },
    async save(parent, { name, script, scope = "project" }) {
      assertParent(parent);
      const label = labelOf(name);
      await requireCompiled(script);
      assertParent(parent);
      if (!["project", "global"].includes(scope)) fail("scope \u5FC5\u987B\u662F project \u6216 global");
      const owner = scope === "global" ? "*" : cwdOf(parent);
      const id = `saved:${JSON.stringify([owner, label])}`;
      const saved = { name: label, script, scope, cwd: scope === "project" ? owner : void 0, savedAt: Date.now() };
      journal.putDocument(id, owner, "saved", saved);
      return jsonCopy(saved);
    },
    async listSaved(parent) {
      assertParent(parent);
      return [...journal.listDocuments(cwdOf(parent), "saved", 100), ...journal.listDocuments("*", "saved", 100)];
    },
    async runSaved(parent, { name, scope = "project", ...input }) {
      assertParent(parent);
      const owner = scope === "global" ? "*" : cwdOf(parent);
      const saved = journal.getDocument(`saved:${JSON.stringify([owner, labelOf(name)])}`);
      if (!saved) fail("\u4FDD\u5B58\u7684\u5DE5\u4F5C\u6D41\u4E0D\u5B58\u5728");
      return manager.create(parent, { ...input, name: saved.name, script: saved.script });
    },
    async artifact(parent, { id, artifactId, version }) {
      checked(parent, id);
      const artifact = journal.getArtifact(id, artifactId, version);
      if (!artifact) fail("\u4EA7\u7269\u4E0D\u5B58\u5728");
      return artifact;
    },
    async getArtifact(parent, input) {
      return manager.artifact(parent, input);
    },
    subscribe(listener) {
      if (typeof listener !== "function") fail("\u76D1\u542C\u5668\u5FC5\u987B\u662F\u51FD\u6570");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async wait(parent, id) {
      checked(parent, id);
      await active.get(id)?.promise;
      return snapshot(parent, id);
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      detachParent?.();
      detachCoordinators?.();
      for (const run of active.values()) run.abort.abort("interrupted");
      await Promise.allSettled([...active.values()].map((run) => run.promise));
      await compiler.dispose();
      listeners.clear();
      journal.close();
    }
  };
  return manager;
}

// workflow/plugin.js
var inject = ["tools", "agents", "agentTeams", "subagents", "connection", "systemPrompt", "fs", "shell", "jobs", "sandboxPolicy", "sessions", "sessionQuery", "sessionPersistence", "agentPresets"];
var API = "/api/composer-assist/workflow";
var actions = ["help", "analyze", "create", "list", "get", "stop", "resume", "amend", "save", "list_saved", "run_saved", "answer", "resolve_hold", "fill_hole", "nodes", "events", "reports"];
var text2 = (value) => [{ type: "text", text: JSON.stringify(value) }];
var response = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
function compact(run) {
  if (run === null || typeof run !== "object") return run;
  return Object.fromEntries(["id", "name", "sessionId", "status", "createdAt", "updatedAt", "error", "result", "questions", "artifacts", "holds"].filter((key) => run[key] !== void 0).map((key) => [key, run[key]]));
}
async function apply(ctx) {
  const manager = await createWorkflowManager(ctx);
  const streams = /* @__PURE__ */ new Set();
  ctx.effect(() => () => {
    for (const close of streams) close();
  }, "dynamic-workflow: event streams");
  ctx.effect(() => () => manager.dispose(), "dynamic-workflow: owned runs");
  async function perform(parent, input, human = false) {
    if (input === null || typeof input !== "object" || Array.isArray(input)) throw new Error("\u5DE5\u4F5C\u6D41\u8BF7\u6C42\u5FC5\u987B\u662F\u5BF9\u8C61");
    const { action } = input;
    if (action === "help") return { facade: FACADE_DTS, snippetFacade: SNIPPET_FACADE_DTS, instructions: "Write ordinary TypeScript with phase(), agent().ask<T>(), await, Promise.all and loops. create prepares a graph and script for user confirmation in the Workflow panel. It never starts agents. Resume replays completed nodes; amend imports matching predecessor results. Call get for run details. All workspace operations retain the parent permissions." };
    if (action === "analyze") return manager.analyze(input.script);
    if (action === "create") return manager.prepare(parent, input);
    if (action === "launch") {
      if (!human) throw new Error("\u9996\u6B21\u8FD0\u884C\u987B\u7531\u7528\u6237\u5728\u5DE5\u4F5C\u6D41\u9762\u677F\u786E\u8BA4");
      return manager.launch(parent, input.id);
    }
    if (action === "list") return { runs: await manager.list(parent) };
    if (action === "get") return manager.get(parent, input.id);
    if (action === "nodes") return manager.nodes(parent, input);
    if (action === "events") return { events: await manager.events(parent, input) };
    if (action === "reports") return manager.reports(parent, input);
    if (action === "stop") return manager.stop(parent, input.id);
    if (action === "resume") return manager.resume(parent, input.id);
    if (action === "amend") return manager.amend(parent, input);
    if (action === "save") return manager.save(parent, input);
    if (action === "list_saved") return { workflows: await manager.listSaved(parent) };
    if (action === "run_saved") {
      if (human) return manager.runSaved(parent, input);
      const rows = await manager.listSaved(parent);
      const saved = rows.find((row) => row.name === input.name && (input.scope === void 0 || row.scope === input.scope));
      if (saved === void 0) throw new Error("\u5DF2\u4FDD\u5B58\u7684\u5DE5\u4F5C\u6D41\u4E0D\u5B58\u5728");
      return manager.prepare(parent, { ...input, script: saved.script });
    }
    if (action === "answer") return manager.answer(parent, input);
    if (action === "resolve_hold") {
      if (!human) throw new Error("\u672A\u77E5\u526F\u4F5C\u7528\u987B\u7531\u7528\u6237\u5728\u5DE5\u4F5C\u6D41\u9762\u677F\u6838\u5B9E\u540E\u5904\u7406\uFF0C\u6A21\u578B\u4E0D\u80FD\u81EA\u884C\u786E\u8BA4\u91CD\u8BD5\u6216\u7ED3\u679C");
      return manager.resolveHold(parent, input);
    }
    if (action === "fill_hole") return manager.fillHole(parent, input);
    throw new Error(`\u672A\u77E5\u5DE5\u4F5C\u6D41\u64CD\u4F5C\uFF1A${String(action)}`);
  }
  ctx.effect(() => ctx.tools.register({
    name: "zcode_workflow",
    description: "Prepare and manage ZCode TypeScript workflows; call action=help for the script API.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["action"],
      properties: {
        action: { type: "string", enum: actions },
        id: { type: "string", description: "Run id returned by create or list." },
        script: { type: "string", description: "TypeScript function body; phase markers are required by the upstream compiler." },
        name: { type: "string", description: "Workflow name, or saved workflow to run." },
        args: { type: "object", additionalProperties: true, description: "JSON arguments exposed as args in the script." },
        concurrency: { type: "integer", minimum: 1, maximum: 64 },
        provider: { type: "string" },
        model: { type: "string" },
        routing: { type: "string", enum: ["none", "latency", "cost", "balanced"], description: "How to pick among the session-approved subagent models once this machine has observed them: fastest median latency, fewest reported tokens, a blend that also penalises failures, or none to keep the first approved route." },
        scope: { type: "string", enum: ["project", "global"] },
        questionId: { type: "string" },
        answer: { type: "string" },
        holeId: { type: "string" },
        body: { type: "string", description: "TypeScript code body to fill an open workflow hole." },
        nodeId: { type: "string" },
        artifactId: { type: "string" },
        after: { type: "integer", minimum: 0 },
        afterSequence: { type: "integer", minimum: -1 },
        limit: { type: "integer", minimum: 1, maximum: 1e3 },
        resolution: { type: "string", enum: ["retry", "accept"] },
        value: { description: "Verified interrupted-node result. Unknown-effect decisions require human confirmation in the Workflow panel; the model cannot resolve them." }
      }
    },
    output: { schema: { type: "object", additionalProperties: true }, render: (_, value) => text2(value) },
    async execute(input, exec) {
      if (exec.agent === void 0) throw new Error("\u5DE5\u4F5C\u6D41\u9700\u8981\u5F53\u524D\u4F1A\u8BDD");
      const value = await perform(exec.agent, input);
      return ["create", "resume", "amend", "stop", "run_saved"].includes(input.action) ? compact(value) : value;
    }
  }), "dynamic-workflow: model tool");
  if (ctx.get("systemPrompt") !== void 0) ctx.effect(() => ctx.systemPrompt.section({
    name: "composer-assist-dynamic-workflows",
    order: 71,
    text: "Use zcode_workflow only when the user explicitly requests a workflow. Call action=help before authoring. First launch and unknown-effect decisions require human confirmation in the Workflow panel."
  }), "dynamic-workflow: discovery");
  const parentFor = (id) => {
    if (typeof id !== "string" || id === "") throw new Error("\u7F3A\u5C11\u4F1A\u8BDD\u6807\u8BC6");
    const parent = ctx.agents.get(id);
    if (parent === void 0) throw new Error("\u8BF7\u5148\u6253\u5F00\u8BE5\u4F1A\u8BDD\uFF0C\u518D\u7BA1\u7406\u5B83\u7684\u5DE5\u4F5C\u6D41");
    return parent;
  };
  ctx.effect(() => ctx.connection.fetch.register({
    path: `${API}/state`,
    methods: ["GET"],
    requestBody: "buffered",
    async fetch(request) {
      try {
        const url = new URL(request.url);
        const parent = parentFor(url.searchParams.get("sessionId"));
        const id = url.searchParams.get("id");
        return response(200, { ok: true, value: id === null ? {
          runs: await manager.list(parent),
          workflows: await manager.listSaved(parent),
          modelRoutes: parent.ctx.get("subagentModelSelection")?.current()?.allowedModels ?? []
        } : await manager.get(parent, id) });
      } catch (error) {
        return response(400, { ok: false, error: error.message });
      }
    }
  }), "dynamic-workflow: state");
  ctx.effect(() => ctx.connection.fetch.register({
    path: `${API}/action`,
    methods: ["POST"],
    requestBody: "buffered",
    async fetch(request) {
      try {
        const raw = await request.text();
        if (raw.length > 512e3) throw new Error("\u5DE5\u4F5C\u6D41\u8BF7\u6C42\u8FC7\u5927");
        const input = JSON.parse(raw);
        const value = await perform(parentFor(input.sessionId), input, true);
        return response(200, { ok: true, value });
      } catch (error) {
        return response(400, { ok: false, error: error.message });
      }
    }
  }), "dynamic-workflow: actions");
  ctx.effect(() => ctx.connection.fetch.register({
    path: `${API}/artifact`,
    methods: ["GET"],
    requestBody: "buffered",
    async fetch(request) {
      try {
        const url = new URL(request.url);
        const parent = parentFor(url.searchParams.get("sessionId"));
        const version = Number(url.searchParams.get("version"));
        if (!Number.isSafeInteger(version) || version < 1) throw new Error("\u4EA7\u7269\u7248\u672C\u65E0\u6548");
        const artifact = await manager.getArtifact(parent, { id: url.searchParams.get("id"), artifactId: url.searchParams.get("artifactId"), version });
        const filename = encodeURIComponent(artifact.record.sourcePath?.split("/").at(-1) ?? `${artifact.record.id}${artifact.record.kind === "markdown" ? ".md" : ""}`);
        return new Response(artifact.bytes, { headers: {
          "content-type": "application/octet-stream",
          "content-disposition": `attachment; filename*=UTF-8''${filename}`,
          "x-content-type-options": "nosniff",
          "content-security-policy": "default-src 'none'; sandbox",
          "cache-control": "no-store"
        } });
      } catch (error) {
        return response(400, { ok: false, error: error.message });
      }
    }
  }), "dynamic-workflow: artifact downloads");
  ctx.effect(() => ctx.connection.fetch.register({
    path: `${API}/events`,
    methods: ["GET"],
    requestBody: "buffered",
    async fetch(request) {
      try {
        const parent = parentFor(new URL(request.url).searchParams.get("sessionId"));
        const encoder = new TextEncoder();
        let release = () => {
        };
        const stream = new ReadableStream({
          start(controller) {
            let closed = false;
            const send = (value) => {
              if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}

`));
            };
            const unsubscribe = manager.subscribe((event) => {
              if (event.sessionId === parent.id) send(event);
            });
            release = () => {
              if (closed) return;
              closed = true;
              unsubscribe();
              streams.delete(release);
              request.signal.removeEventListener("abort", release);
              try {
                controller.close();
              } catch {
              }
            };
            streams.add(release);
            request.signal.addEventListener("abort", release, { once: true });
            if (request.signal.aborted) release();
            send({ connected: true });
            if (request.signal.aborted) release();
          },
          cancel() {
            release();
          }
        });
        return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache", "x-accel-buffering": "no" } });
      } catch (error) {
        return response(400, { ok: false, error: error.message });
      }
    }
  }), "dynamic-workflow: event stream");
}
export {
  apply,
  inject
};
