import { mkdirSync, chmodSync } from 'node:fs'
import { join } from 'node:path'

const json = value => JSON.stringify(value)
const parse = row => row === undefined ? undefined : JSON.parse(row.data)
const marks = values => values.map(() => '?').join(',')

/** Synchronous FULL/WAL commits keep the upstream write-before-dispatch contract. */
export async function openJournal(directory) {
  let DatabaseSync
  try { ({ DatabaseSync } = await import('node:sqlite')) }
  catch (cause) { throw new Error('动态工作流需要支持 node:sqlite 的 Host Node 运行时', { cause }) }
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const path = join(directory, 'workflow.sqlite')
  const db = new DatabaseSync(path)
  chmodSync(path, 0o600)
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
    CREATE INDEX IF NOT EXISTS effects_run_state ON effects(run,state);`)
  const statement = sql => db.prepare(sql)
  // Running rows are resume checkpoints; cancellation is a display-only projection of the latest lifecycle event.
  const displayStatus = `CASE WHEN json_extract(n.data,'$.status')='running' AND n.kind='ask' AND
    (SELECT json_extract(e.data,'$.outcome') FROM events e WHERE e.run=n.run
      AND e.type IN ('node-queued','node-dispatched','node-settled')
      AND json_extract(e.data,'$.instance.siteId')=n.site AND json_extract(e.data,'$.instance.ordinal')=n.ordinal
      ORDER BY e.sequence DESC LIMIT 1)='cancelled'
    THEN 'cancelled' WHEN json_extract(n.data,'$.status')='running' AND n.kind='ask'
      AND (SELECT json_extract(r.data,'$.status') FROM runs r WHERE r.id=n.run)='stopped'
    THEN 'stopped' ELSE json_extract(n.data,'$.status') END`
  const requireRun = id => { const row = journal.getRun(id); if (!row) throw new Error(`journal: unknown run ${id}`); return row }
  const updateRun = (id, change) => {
    const row = requireRun(id)
    change(row)
    statement('UPDATE runs SET data=? WHERE id=?').run(json(row), id)
  }
  const journal = {
    createRun(record) { statement('INSERT INTO runs VALUES (?,?,?)').run(record.runId, record.parentSessionId ?? '', json(record)) },
    getRun(id) { return parse(statement('SELECT data FROM runs WHERE id=?').get(id)) },
    listRuns(owner, limit = 100) { return statement('SELECT data FROM runs WHERE owner=? ORDER BY rowid DESC LIMIT ?').all(owner, limit).map(parse) },
    updateRunStatus(id, status, settlement) { updateRun(id, record => {
      record.status = status
      for (const key of ['failure', 'stopReason', 'supersededBy']) delete record[key]
      if (status === 'pending' || status === 'running') delete record.result
      else {
        for (const key of ['failure', 'stopReason', 'supersededBy']) if (settlement?.[key] !== undefined) record[key] = settlement[key]
        if (settlement?.result !== undefined) record.result = settlement.result
      }
    }) },
    updateRunUsage(id, spentTokens) { updateRun(id, record => { record.spentTokens = spentTokens }) },
    updateRunCaps(id, caps) { updateRun(id, record => { record.caps = caps }) },
    updateRunScript(id, scriptText, scriptHash) { updateRun(id, record => { Object.assign(record, { scriptText, scriptHash }) }) },
    putActor(record) { statement('INSERT INTO actors(run,site,ordinal,data) VALUES(?,?,?,?) ON CONFLICT(run,site,ordinal) DO UPDATE SET data=excluded.data').run(record.runId, record.siteId, record.ordinal, json(record)) },
    getActor(run, site, ordinal) { return parse(statement('SELECT data FROM actors WHERE run=? AND site=? AND ordinal=?').get(run, site, ordinal)) },
    listActors(run, opts) {
      const rows = statement(`SELECT data FROM actors WHERE run=?${opts.name === undefined ? '' : " AND json_extract(data,'$.name')=?"} ORDER BY id`).all(...(opts.name === undefined ? [run] : [run, opts.name])).map(parse)
      if (!opts.withPersona) for (const row of rows) delete row.persona
      return rows
    },
    putNode(record) {
      const { result, ...rest } = record
      statement('INSERT INTO nodes(run,site,ordinal,kind,data,result) VALUES(?,?,?,?,?,?) ON CONFLICT(run,site,ordinal) DO UPDATE SET kind=excluded.kind,data=excluded.data,result=excluded.result').run(record.runId, record.siteId, record.ordinal, record.kind, json(rest), result === undefined ? null : json(result))
    },
    getNode(run, site, ordinal, opts) {
      const row = statement(`SELECT data${opts?.withResult === false ? '' : ',result'} FROM nodes WHERE run=? AND site=? AND ordinal=?`).get(run, site, ordinal)
      if (!row) return undefined
      const value = parse(row)
      if (row.result !== undefined && row.result !== null) value.result = JSON.parse(row.result)
      return value
    },
    listNodes(run, opts) {
      if (opts.kinds !== 'all' && opts.kinds.length === 0) return []
      const bindings = [run, ...(opts.kinds === 'all' ? [] : opts.kinds)]
      const filter = opts.kinds === 'all' ? '' : ` AND kind IN (${marks(opts.kinds)})`
      const rows = statement(`SELECT data${opts.withResult ? ',result' : ''} FROM nodes WHERE run=?${filter} ORDER BY id LIMIT ?`).iterate(...bindings, opts.limit ?? -1)
      const results = []
      let bytes = 0
      for (const row of rows) {
        const length = row.result === null || row.result === undefined ? 0 : Buffer.byteLength(row.result)
        if (opts.withResult && opts.maxResultBytes !== undefined && results.length > 0 && bytes + length > opts.maxResultBytes) break
        const value = parse(row)
        if (row.result !== undefined && row.result !== null) value.result = JSON.parse(row.result)
        results.push(value)
        bytes += length
      }
      return results
    },
    pageNodes(run, { after = 0, limit = 300, maxResultBytes = 2 * 1024 * 1024, kinds = ['ask', 'world-read', 'world-run'], artifactId } = {}) {
      if (!kinds.length) return { nodes: [], nextCursor: after, hasMore: false }
      const rows = statement(`SELECT id,json_set(n.data,'$.status',${displayStatus}) AS data,result FROM nodes n WHERE run=? AND id>? AND kind IN (${marks(kinds)})${artifactId === undefined ? '' : " AND json_extract(n.data,'$.artifactId')=?"} ORDER BY id LIMIT ?`).iterate(run, after, ...kinds, ...(artifactId === undefined ? [] : [artifactId]), limit + 1)
      const nodes = []
      let bytes = 0
      let nextCursor = after
      let hasMore = false
      for (const row of rows) {
        const length = row.result === null ? 0 : Buffer.byteLength(row.result)
        if (nodes.length >= limit || (nodes.length > 0 && bytes + length > maxResultBytes)) { hasMore = true; break }
        const value = parse(row)
        if (row.result !== null) value.result = JSON.parse(row.result)
        nodes.push(value)
        nextCursor = row.id
        bytes += length
      }
      return { nodes, nextCursor, hasMore }
    },
    siteStates(run) { return statement(`SELECT site AS siteId,${displayStatus} AS status,count(*) AS count FROM nodes n WHERE run=? AND kind IN ('ask','world-read','world-run') GROUP BY site,status`).all(run) },
    countNodes(run, kind) { return statement('SELECT count(*) AS count FROM nodes WHERE run=? AND kind=?').get(run, kind).count },
    sumResultBytes(run, kind) { return statement('SELECT coalesce(sum(length(CAST(result AS BLOB))),0) AS bytes FROM nodes WHERE run=? AND kind=?').get(run, kind).bytes },
    appendEvent(run, event) {
      const { item, ...rest } = event
      const timeCreated = Date.now()
      const sequence = statement('SELECT coalesce(max(sequence)+1,0) AS seq FROM events WHERE run=?').get(run).seq
      statement('INSERT INTO events VALUES(?,?,?,?,?,?)').run(run, sequence, event.type, json(rest), item === undefined ? null : json(item), timeCreated)
      return { sequence, event: structuredClone(event), timeCreated }
    },
    listEvents(run, opts) {
      if (opts.types !== 'all' && opts.types.length === 0) return []
      const bindings = [run, ...(opts.types === 'all' ? [] : opts.types), opts.afterSequence ?? -1, opts.limit ?? -1]
      const filter = opts.types === 'all' ? '' : ` AND type IN (${marks(opts.types)})`
      return statement(`SELECT sequence,data,time${opts.reportItems === 'all' ? ',item' : `,CASE WHEN (SELECT count(*) FROM events p WHERE p.run=e.run AND p.type='report' AND p.sequence<=e.sequence)<=${Math.max(0, Math.floor(opts.reportItems.limit))} THEN item ELSE NULL END AS item`} FROM events e WHERE run=?${filter} AND sequence>? ORDER BY sequence LIMIT ?`).all(...bindings).map(row => {
        const event = parse(row)
        if (row.item !== null) event.item = JSON.parse(row.item)
        return { sequence: row.sequence, event, timeCreated: row.time }
      })
    },
    lastSequence(run) { return statement('SELECT coalesce(max(sequence),-1) AS seq FROM events WHERE run=?').get(run).seq },
    putDocument(id, owner, kind, value) { statement('INSERT INTO documents VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,kind=excluded.kind,data=excluded.data').run(id, owner, kind, json(value)) },
    getDocument(id) { return parse(statement('SELECT data FROM documents WHERE id=?').get(id)) },
    listDocuments(owner, kind, limit = 100) { return statement('SELECT data FROM documents WHERE owner=? AND kind=? ORDER BY rowid DESC LIMIT ?').all(owner, kind, limit).map(parse) },
    listQuestions(run) { return statement("SELECT data FROM documents WHERE owner=? AND kind='question' ORDER BY CASE WHEN json_extract(data,'$.status')='waiting' THEN 0 ELSE 1 END,rowid DESC LIMIT 100").all(run).map(parse) },
    putEffect(record) { statement('INSERT INTO effects VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,data=excluded.data').run(record.id, record.runId, record.state, json(record)) },
    getEffect(id) { return parse(statement('SELECT data FROM effects WHERE id=?').get(id)) },
    listEffects(run, state) { return statement(`SELECT data FROM effects WHERE run=?${state === undefined ? '' : ' AND state=?'} ORDER BY rowid`).all(...(state === undefined ? [run] : [run, state])).map(parse) },
    putArtifact(run, id, version, bytes, record) { statement('INSERT INTO artifacts VALUES(?,?,?,?,?)').run(run, id, version, bytes, json(record)) },
    getArtifact(run, id, version) { const row = statement('SELECT bytes,data FROM artifacts WHERE run=? AND id=? AND version=?').get(run, id, version); return row && { bytes: row.bytes, record: parse(row) } },
    transaction(work) { db.exec('BEGIN IMMEDIATE'); try { const value = work(); db.exec('COMMIT'); return value } catch (error) { db.exec('ROLLBACK'); throw error } },
    close() { db.close() },
  }
  return journal
}
