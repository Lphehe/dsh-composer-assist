import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { mkdirSync } from 'node:fs'
import { runWorkflowScript } from '@zcode/dynamic-workflow-runtime'
import { validate, inputHash, refToString } from '@zcode/dynamic-workflow'
import { openJournal } from './journal.js'
import { createCompilerScope } from './compile.js'
import { createDshDriver, resolveRoutes } from './dsh-driver.js'
import { parkWorkflowMessages } from './native-team.js'

const terminal = new Set(['completed', 'errored', 'stopped'])
const fail = (message, code = 'WorkflowError') => { const error = new Error(message); error.code = code; throw error }
const jsonCopy = value => JSON.parse(JSON.stringify(value))
const argsOf = value => { if (value === undefined) return {}; if (!value || typeof value !== 'object' || Array.isArray(value) || Buffer.byteLength(JSON.stringify(value)) > 256 * 1024) fail('工作流 args 必须是最多 256 KiB 的 JSON 对象'); return jsonCopy(value) }
const concurrencyOf = value => { const count = value ?? 4; if (!Number.isInteger(count) || count < 1 || count > 64) fail('并发数必须是 1–64 的整数'); return count }
const cwdOf = parent => parent.ctx.get?.('workingDirectory')?.get(parent.session) ?? parent.session.header.cwd
const labelOf = value => { if (value === undefined) return '动态工作流'; if (typeof value !== 'string' || !value.trim() || value.length > 120) fail('工作流名称必须是 1–120 个字符'); return value.trim() }

/** Host state is private; project files and commands use only the parent's scoped providers. */
export async function createWorkflowManager(ctx, options = {}) {
  const directory = options.storeDir ?? join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'composer-assist', 'workflows')
  const journal = await openJournal(directory)
  const compiler = createCompilerScope()
  const { compile, requireCompiled, compileHole } = compiler
  const scriptDirectory = join(directory, 'sandbox')
  mkdirSync(scriptDirectory, { recursive: true, mode: 0o700 })
  const active = new Map()
  const starting = new Map()
  const listeners = new Set()
  let disposed = false
  const assertParent = parent => {
    if (disposed) fail('工作流管理器已关闭')
    if (!parent || typeof parent.id !== 'string' || ctx.agents.get(parent.id) !== parent) fail('必须使用当前精确的活跃父 Agent', 'WorkflowOwnerMismatch')
    if (!cwdOf(parent)) fail('父会话缺少工作目录')
    return parent
  }
  const metadata = id => journal.getDocument(`run:${id}`)
  const nativeNode = (id, node) => {
    const link = journal.getDocument(`native-task:${id}:${refToString(node)}`)
    return link ? { ...node, nativeTask: link } : node
  }
  const storeMeta = value => journal.putDocument(`run:${value.id}`, value.sessionId, 'metadata', value)
  const broadcast = (id, sessionId, event) => { for (const listener of listeners) { try { listener({ runId: id, sessionId, event }) } catch (error) { ctx.logger?.warn(`workflow listener: ${error.message}`) } } }
  const checked = (parent, id) => {
    assertParent(parent)
    const meta = metadata(id)
    if (!meta || meta.sessionId !== parent.id || meta.cwd !== cwdOf(parent)) fail('工作流不存在或不属于当前父会话', 'WorkflowOwnerMismatch')
    return meta
  }
  const touch = (id, extra = {}) => { const meta = metadata(id); if (meta) storeMeta({ ...meta, ...extra, updatedAt: Date.now() }) }
  const record = (id, event) => { journal.appendEvent(id, event); broadcast(id, metadata(id).sessionId, event); touch(id) }
  const detachCoordinators = ctx.on?.('agent/created', ({ agent }) => {
    if (!agent.id.startsWith('dwf-team-')) return
    const team = journal.getDocument(`native-team:${agent.id.slice('dwf-team-'.length)}`)
    if (team?.teamSessionId === agent.id) ctx.effect(() => agent.ctx.on('agent/pre-step', ({ messages }) => parkWorkflowMessages(agent, messages)))
  })
  const orphan = id => {
    const run = journal.getRun(id)
    if (run && !active.has(id) && !terminal.has(run.status)) journal.updateRunStatus(id, 'stopped', { stopReason: 'interrupted', failure: { code: 'Interrupted', message: '上次 Host 在记录终态前中断，恢复前请核对未知结果' } })
  }
  const holds = id => journal.listEffects(id).filter(row => (row.state === 'pending' || row.state === 'unknown') && !row.resolution).map(row => ({ ...row, nodeId: row.id, state: active.has(id) && row.state === 'pending' ? 'pending' : 'unknown' }))
  const snapshot = async (parent, id) => {
    const meta = checked(parent, id)
    orphan(id)
    const run = journal.getRun(id)
    const compiled = await compile(run?.scriptText ?? meta.script)
    checked(parent, id)
    const nodePage = run ? journal.pageNodes(id) : { nodes: [], nextCursor: 0, hasMore: false }
    const nodes = nodePage.nodes.map(node => nativeNode(id, node))
    const events = run ? journal.listEvents(id, { types: 'all', reportItems: { limit: 256 }, afterSequence: journal.lastSequence(id) - 1000, limit: 1000 }) : []
    let markdownBytes = 0
    const artifacts = run ? journal.listNodes(id, { kinds: ['artifact'], withResult: true }).filter(row => row.status === 'completed').map(row => { const artifact = row.result; if (artifact.kind === 'markdown') { if (markdownBytes + (artifact.bytes ?? 0) > 512 * 1024) return { ...artifact, contentOmitted: true }; const stored = journal.getArtifact(id, artifact.id, artifact.version); if (stored) { markdownBytes += stored.bytes.length; return { ...artifact, content: Buffer.from(stored.bytes).toString('utf8') } } }; return artifact }) : []
    const reports = run ? journal.listNodes(id, { kinds: ['report'], withResult: true, limit: 256, maxResultBytes: 2 * 1024 * 1024 }).map(row => ({ instance: { siteId: row.siteId, ordinal: row.ordinal }, item: row.result, ...(row.artifactId ? { artifactId: row.artifactId } : {}) })) : []
    const instance = active.get(id)
    const reached = new Map(events.filter(row => row.event.type === 'hole-reached').map(row => [row.event.instance.siteId, row.event]))
    const open = instance?.control?.openHoles() ?? []
    const questions = journal.listQuestions(id).map(question => ({ ...question, live: instance?.questions.has(question.id) ?? false }))
    return jsonCopy({ ...meta, script: run?.scriptText ?? meta.script, status: run?.status ?? 'draft', analysis: compiled.analysis, concurrency: run?.caps.maxConcurrency ?? meta.concurrency, siteStates: run ? journal.siteStates(id) : [], nativeTeam: journal.getDocument(`native-team:${id}`), actors: run ? journal.listActors(id, { withPersona: false }).map(actor => ({ ...actor, nativeMember: journal.getDocument(`native-actor:${id}:${refToString(actor)}`) })) : [], nodes, nodesPage: { nextCursor: nodePage.nextCursor, hasMore: nodePage.hasMore }, events, eventsPage: { afterSequence: events[0]?.sequence ?? -1, lastSequence: events.at(-1)?.sequence ?? -1, earlierOmitted: (events[0]?.sequence ?? 0) > 0 }, questions, holes: open.map(hole => ({ ...hole, id: hole.siteId, prompt: reached.get(hole.siteId)?.prompt })), artifacts, reports, reportsPage: { limit: 256, hasMore: run ? journal.countNodes(id, 'report') > reports.length : false }, holds: run ? holds(id) : [], result: run?.result, error: run?.failure ?? (meta.nativeTeamError ? { code: 'NativeTeamError', message: meta.nativeTeamError } : undefined), stopReason: run?.stopReason, resumedFrom: run?.resumedFrom, supersededBy: run?.supersededBy, spentTokens: run?.spentTokens ?? 0, counts: run ? { nodes: ['ask', 'world-read', 'world-run'].reduce((sum, kind) => sum + journal.countNodes(id, kind), 0), reports: journal.countNodes(id, 'report'), artifacts: journal.countNodes(id, 'artifact') } : { nodes: 0, reports: 0, artifacts: 0 } })
  }
  function importedCache(predecessor) {
    const actorRows = journal.listActors(predecessor.runId, { withPersona: true })
    const nodes = journal.listNodes(predecessor.runId, { kinds: ['ask', 'world-read', 'world-run'], withResult: true })
    const actors = new Map()
    const names = new Map()
    for (const row of actorRows) if (row.name) names.set(row.name, (names.get(row.name) ?? 0) + 1)
    for (const row of actorRows) {
      if (!row.name || names.get(row.name) !== 1 || !row.persona) continue
      const asks = nodes.filter(node => node.kind === 'ask' && node.actorSiteId === row.siteId && node.actorOrdinal === row.ordinal).sort((a, b) => a.actorSeq - b.actorSeq)
      const entries = []
      for (const ask of asks) {
        if (ask.actorSeq !== entries.length || ask.status !== 'completed') break
        if (!Number.isInteger(ask.messageBoundary)) fail('前驱缺少完整转录边界，不能安全修订接续')
        entries.push({ inputHash: ask.inputHash, result: ask.result, stats: ask.stats, messageBoundary: ask.messageBoundary })
      }
      const next = asks[entries.length]
      if (!entries.length && next?.status !== 'running') continue
      let source = row
      let ancestor = predecessor
      const seen = new Set()
      while (!source.sessionId && ancestor.resumedFrom && !seen.has(ancestor.runId)) {
        seen.add(ancestor.runId)
        ancestor = journal.getRun(ancestor.resumedFrom)
        if (!ancestor) break
        source = journal.listActors(ancestor.runId, { name: row.name, withPersona: true })[0] ?? source
      }
      if (!source.sessionId) continue
      let inFlight
      if (next?.status === 'running' && row.sessionId && source.sessionId === row.sessionId) {
        const checkpoint = journal.getDocument(`transcript-latest:${source.sessionId}`)
        if (!checkpoint || !Number.isInteger(checkpoint.messageCount) || checkpoint.messageCount < (entries.at(-1)?.messageBoundary ?? 0)) fail('前驱进行中的 ask 缺少安全转录边界，拒绝丢弃部分工作重新执行')
        inFlight = { inputHash: next.inputHash, messageBoundary: checkpoint.messageCount }
      }
      if (!entries.length && !inFlight) continue
      actors.set(row.name, { persona: row.persona, entries, ...(inFlight ? { inFlight } : {}), transcriptSourceSessionId: source.sessionId, resolvedModel: source.resolvedModel })
    }
    const world = new Map()
    for (const node of nodes) if ((node.kind === 'world-read' || node.kind === 'world-run') && node.status === 'completed') {
      const bucket = world.get(node.inputHash) ?? []
      bucket.push({ inputHash: node.inputHash, kind: node.kind, result: node.result })
      world.set(node.inputHash, bucket)
    }
    return { actors, world }
  }
  async function execute(parent, meta, resumedFrom) {
    assertParent(parent)
    if (active.has(meta.id) || starting.has(meta.id)) fail('该工作流正在启动或运行')
    const gate = { cancelled: false }
    starting.set(meta.id, gate)
    try {
    const compiled = await requireCompiled(journal.getRun(meta.id)?.scriptText ?? meta.script)
    const routes = options.resolveRoutes ? await options.resolveRoutes(parent, meta, compiled.analysis) : resolveRoutes(parent, meta, compiled.analysis)
    checked(parent, meta.id)
    if (gate.cancelled) fail('工作流启动已经取消')
    if (!meta.routePin) { meta = { ...meta, routePin: jsonCopy(routes) }; storeMeta(meta) }
    const existing = journal.getRun(meta.id)
    const blocked = existing ? holds(meta.id) : []
    if (blocked.length) fail('存在结果未知的副作用，请先选择明确重试或接纳节点结果', 'WorkflowRecoveryHeld')
    const source = resumedFrom ?? existing?.resumedFrom
    const predecessor = source ? journal.getRun(source) : undefined
    const controller = new AbortController()
    const running = { abort: controller, routes, control: undefined, driver: undefined, promise: undefined, questions: new Map() }
    active.set(meta.id, running)
    const ownJournal = Object.create(journal)
    ownJournal.createRun = row => journal.createRun({ ...row, cwd: meta.cwd })
    const usedWorldNodes = new Set()
    const recordEffect = (op, args) => {
      const hash = inputHash({ op, args })
      const node = journal.listNodes(meta.id, { kinds: ['world-run'], withResult: false }).find(value => value.status === 'running' && value.inputHash === hash && !usedWorldNodes.has(refToString(value)))
      if (!node) fail('世界命令缺少上游准入日志，拒绝执行')
      const id = `${meta.id}:world:${refToString(node)}`
      usedWorldNodes.add(refToString(node))
      const previous = journal.getEffect(id)
      if (previous?.resolution === 'accept') return previous
      if (previous && previous.state !== 'settled' && previous.resolution !== 'retry') fail('世界命令结果未知，必须先人工确认', 'WorkflowRecoveryHeld')
      const value = { id, runId: meta.id, nodeId: refToString(node), instance: { siteId: node.siteId, ordinal: node.ordinal }, kind: 'world-run', op, args, state: 'pending', startedAt: Date.now() }
      journal.putEffect(value)
      return value
    }
    const settleEffect = (id, value, error) => {
      const previous = journal.getEffect(id)
      journal.putEffect({ ...previous, state: error ? 'unknown' : 'settled', ...(value === undefined ? {} : { value }), ...(error ? { error: error.message } : {}), endedAt: Date.now() })
    }
    const askQuestion = (input, signal) => {
      if (typeof input.question !== 'string' || !input.question.trim() || input.question.length > 4000 || (input.context !== undefined && (typeof input.context !== 'string' || input.context.length > 4000))) fail('问题或上下文无效')
      const id = randomUUID()
      const question = { id, question: input.question, context: input.context, actorId: refToString(input.actor), instance: input.instance, status: 'waiting', askedAt: Date.now() }
      journal.putDocument(`question:${id}`, meta.id, 'question', question)
      record(meta.id, { type: 'escalation-raised', qid: id, actor: input.actor, actorName: input.actorName, question: input.question, context: input.context, askedAt: question.askedAt })
      return new Promise((resolve, reject) => {
        const cancel = () => { running.questions.delete(id); const saved = journal.getDocument(`question:${id}`); if (saved?.status === 'waiting') journal.putDocument(`question:${id}`, meta.id, 'question', { ...saved, status: 'cancelled', cancelledAt: Date.now() }); reject(new Error('工作流停止，提问已取消')) }
        signal.addEventListener('abort', cancel, { once: true })
        if (signal.aborted) { cancel(); return }
        running.questions.set(id, { answer: value => { signal.removeEventListener('abort', cancel); running.questions.delete(id); resolve(value) } })
      })
    }
    const runOptions = { runId: meta.id, name: meta.name, scriptText: existing?.scriptText ?? meta.script, scriptHash: compiled.hash, lowered: compiled.lowered.code, args: existing?.args ?? meta.args, caps: { maxConcurrency: existing?.caps.maxConcurrency ?? meta.concurrency }, askSpecs: compiled.askSpecs, sitePhases: compiled.sitePhases, validate, cwd: scriptDirectory, parentSessionId: parent.id, signal: controller.signal, ...(source ? { resumedFrom: source } : {}), ...(predecessor ? { importedCache: importedCache(predecessor), inheritedTokens: predecessor.spentTokens } : {}), launch: { inputId: meta.id, ...compiled.analysis.phases, subagentModel: `${routes.base.provider}/${routes.base.model}`, modelBindings: Object.fromEntries(Object.entries(routes.bindings).map(([name, route]) => [name, `${route.provider}/${route.model}`])) }, control: { bind: engine => { running.control = engine } }, makeDriver: sink => {
      const emit = event => { broadcast(meta.id, parent.id, event); touch(meta.id) }
      const config = { hostContext: ctx, cwd: meta.cwd, journal: ownJournal, runId: meta.id, sink, signal: controller.signal, emit, routes, askQuestion, recordEffect, settleEffect, concurrency: meta.concurrency }
      const driver = options.driverFactory ? options.driverFactory(parent, config) : createDshDriver(parent, config)
      running.driver = driver
      return driver
    } }
    running.promise = (async () => {
      try { return await runWorkflowScript(runOptions) }
      catch (error) {
        if (journal.getRun(meta.id)) journal.updateRunStatus(meta.id, 'stopped', { stopReason: 'interrupted', failure: { code: 'Interrupted', message: error.message } })
        else touch(meta.id, { launchError: error.message })
        throw error
      } finally {
        try { await running.driver?.quiesce?.() }
        catch (error) { touch(meta.id, { nativeTeamError: error.message }); throw error }
        finally { active.delete(meta.id); touch(meta.id); broadcast(meta.id, parent.id, { type: 'manager-settled' }) }
      }
    })()
    running.promise.catch(error => ctx.logger?.warn(`workflow ${meta.id}: ${error.message}`))
    await Promise.resolve()
    return snapshot(parent, meta.id)
    } finally { starting.delete(meta.id) }
  }
  const detachParent = ctx.on?.('agent/disposed', ({ agent }) => { for (const [id, run] of active) if (metadata(id)?.sessionId === agent.id) run.abort.abort('interrupted') })
  const manager = {
    async analyze(script) { return (await compile(typeof script === 'string' ? script : script.script)).analysis },
    async prepare(parent, input) {
      assertParent(parent)
      const script = input.script
      const compiled = await requireCompiled(script)
      assertParent(parent)
      const id = randomUUID()
      const meta = { id, sessionId: parent.id, cwd: cwdOf(parent), name: labelOf(input.name), script, args: argsOf(input.args), concurrency: concurrencyOf(input.concurrency), ...(input.provider === undefined ? {} : { provider: input.provider, model: input.model }), createdAt: Date.now(), updatedAt: Date.now() }
      if (!options.resolveRoutes) resolveRoutes(parent, meta, compiled.analysis)
      storeMeta(meta)
      broadcast(id, parent.id, { type: 'draft-prepared', id })
      return snapshot(parent, id)
    },
    async launch(parent, id) { const meta = checked(parent, id); if (journal.getRun(id)) fail('草稿已经启动过，请使用恢复'); return execute(parent, meta) },
    async create(parent, input) { const draft = await manager.prepare(parent, input); return manager.launch(parent, draft.id) },
    async list(parent) { assertParent(parent); const metas = journal.listDocuments(parent.id, 'metadata', 100).filter(meta => meta.cwd === cwdOf(parent)); return jsonCopy(metas.map(meta => { checked(parent, meta.id); orphan(meta.id); const run = journal.getRun(meta.id); return { id: meta.id, name: meta.name, sessionId: parent.id, status: run?.status ?? 'draft', createdAt: meta.createdAt, updatedAt: meta.updatedAt, resumedFrom: run?.resumedFrom, supersededBy: run?.supersededBy, concurrency: run?.caps.maxConcurrency ?? meta.concurrency, error: run?.failure } })) },
    async get(parent, id) { return snapshot(parent, id) },
    async reports(parent, { id, after = 0, limit = 256, artifactId }) { checked(parent, id); if (!Number.isInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 1000 || (artifactId !== undefined && (typeof artifactId !== 'string' || artifactId.length > 64))) fail('报告分页参数无效'); const page = journal.pageNodes(id, { after, limit, kinds: ['report'], artifactId }); return { reports: page.nodes.map(row => ({ instance: { siteId: row.siteId, ordinal: row.ordinal }, item: row.result, ...(row.artifactId ? { artifactId: row.artifactId } : {}) })), nextCursor: page.nextCursor, hasMore: page.hasMore } },
    async nodes(parent, { id, after = 0, limit = 300 }) { checked(parent, id); if (!Number.isInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 1000) fail('节点分页参数无效'); const page = journal.pageNodes(id, { after, limit }); return { ...page, nodes: page.nodes.map(node => nativeNode(id, node)) } },
    async events(parent, { id, afterSequence = -1, limit = 500 }) { checked(parent, id); if (!Number.isInteger(afterSequence) || afterSequence < -1 || !Number.isInteger(limit) || limit < 1 || limit > 1000) fail('事件分页参数无效'); return journal.listEvents(id, { types: 'all', reportItems: { limit: 256 }, afterSequence, limit }) },
    async stop(parent, id) { checked(parent, id); const pending = starting.get(id); if (pending) pending.cancelled = true; const run = active.get(id); if (run) { run.abort.abort('user'); await run.promise.catch(() => {}) }; return snapshot(parent, id) },
    async resume(parent, id) { const meta = checked(parent, id); orphan(id); const row = journal.getRun(id); if (!row || row.status !== 'stopped' || row.stopReason === 'superseded') fail('只有已停止且未被替代的工作流可以恢复'); return execute(parent, meta) },
    async amend(parent, input) {
      const meta = checked(parent, input.id)
      const row = journal.getRun(input.id)
      if (!row) fail('草稿请直接重新准备')
      if (row.stopReason === 'superseded') fail('前驱已经被修订取代，请操作它的后继工作流')
      const script = input.script ?? row.scriptText
      const compiled = await requireCompiled(script)
      assertParent(parent)
      const args = input.args === undefined ? row.args ?? {} : argsOf(input.args)
      const concurrency = concurrencyOf(input.concurrency ?? row.caps.maxConcurrency)
      const nextMeta = { ...meta, id: randomUUID(), script, args, concurrency, ...(input.name === undefined ? {} : { name: labelOf(input.name) }), ...(input.provider === undefined ? {} : { provider: input.provider, model: input.model, routePin: undefined }), createdAt: Date.now(), updatedAt: Date.now() }
      if (!options.resolveRoutes) resolveRoutes(parent, nextMeta, compiled.analysis)
      if (holds(input.id).some(hold => hold.state === 'unknown')) fail('前驱存在结果未知的操作，先处理后再修订', 'WorkflowRecoveryHeld')
      if (script === row.scriptText && inputHash(args) === inputHash(row.args ?? {}) && input.provider === undefined) {
        storeMeta({ ...meta, concurrency })
        const live = active.get(input.id)
        if (live?.control) { live.control.setMaxConcurrency(concurrency); live.driver?.setMaxConcurrency?.(concurrency) }
        else journal.updateRunCaps(input.id, { maxConcurrency: concurrency })
        return snapshot(parent, input.id)
      }
      await manager.stop(parent, input.id)
      if (holds(input.id).length) fail('停止后有结果未知的操作，先核对后再修订', 'WorkflowRecoveryHeld')
      const source = journal.getRun(input.id)
      if (source.stopReason === 'superseded') fail('前驱已经被另一修订取代')
      const canImport = inputHash(args) === inputHash(source.args ?? {})
      if (canImport) importedCache(source)
      storeMeta(nextMeta)
      journal.updateRunStatus(input.id, 'stopped', { stopReason: 'superseded', supersededBy: nextMeta.id })
      return execute(parent, nextMeta, canImport ? input.id : undefined)
    },
    async answer(parent, { id, questionId, answer }) {
      checked(parent, id)
      if (typeof answer !== 'string' || !answer.trim() || answer.length > 16000) fail('回答必须是 1–16000 个字符')
      const question = journal.getDocument(`question:${questionId}`)
      const pending = active.get(id)?.questions.get(questionId)
      if (!question || !pending || question.status !== 'waiting') fail('该问题已不在等待回答')
      journal.putDocument(`question:${questionId}`, id, 'question', { ...question, status: 'answered', answer, answeredAt: Date.now() })
      record(id, { type: 'escalation-resolved', qid: questionId, answer })
      pending.answer(answer)
      return snapshot(parent, id)
    },
    async fillHole(parent, { id, holeId, body }) {
      const meta = checked(parent, id)
      const run = active.get(id)
      if (!run?.control) fail('工作流当前未运行，无法补全留白')
      const { script, compiled } = await compileHole(journal.getRun(id).scriptText, holeId, body)
      checked(parent, id)
      const nextRoutes = options.resolveRoutes ? await options.resolveRoutes(parent, meta, compiled.analysis) : resolveRoutes(parent, meta, compiled.analysis)
      Object.assign(run.routes.bindings, nextRoutes.bindings)
      const result = run.control.fillHole({ siteId: holeId, code: compiled.lowered.holeBodies[holeId], script: { text: script, hash: compiled.hash }, askSpecs: compiled.askSpecs, sitePhases: compiled.sitePhases, ...compiled.analysis.phases, filledBy: parent.id })
      if (!result.ok) fail(`留白没有可补全的等待分支：${result.reason}`)
      storeMeta({ ...metadata(id), routePin: jsonCopy(run.routes) })
      return snapshot(parent, id)
    },
    async resolveHold(parent, { id, nodeId, resolution, value }) {
      checked(parent, id)
      if (active.has(id)) fail('请先停止工作流再处理未知结果')
      const hold = journal.getEffect(nodeId)
      if (!hold || hold.runId !== id || hold.resolution || !['pending', 'unknown'].includes(hold.state)) fail('未知结果记录不存在或已处理')
      if (!['retry', 'accept'].includes(resolution)) fail('resolution 必须是 retry 或 accept')
      const node = journal.getNode(id, hold.instance.siteId, hold.instance.ordinal)
      if (!node) fail('未知结果没有对应节点')
      const compiled = resolution === 'accept' ? await requireCompiled(journal.getRun(id).scriptText) : undefined
      checked(parent, id)
      if (active.has(id)) fail('工作流已经重新开始运行')
      journal.transaction(() => {
      if (journal.getEffect(nodeId).resolution) fail('未知结果已经处理')
      if (resolution === 'accept') {
        const spec = compiled.askSpecs.get(node.siteId)
        if (node.kind === 'ask') {
          if (spec?.typed) { const violations = validate(spec.schema, value); if (violations.length) fail(`结果不符合节点 schema：${JSON.stringify(violations)}`) }
          else if (typeof value !== 'string') fail('无类型 ask 的接纳结果必须是字符串')
        } else if (node.kind === 'world-run' && (!value || !Number.isInteger(value.exitCode) || typeof value.stdout !== 'string' || typeof value.stderr !== 'string')) fail('世界命令结果需要 exitCode、stdout、stderr')
        journal.putNode({ ...node, status: 'completed', result: jsonCopy(value), error: undefined })
      } else {
        const { result: _result, error: _error, ...pending } = node
        journal.putNode({ ...pending, status: 'running' })
      }
      journal.putEffect({ ...hold, state: 'resolved', resolution, ...(resolution === 'accept' ? { value: jsonCopy(value) } : {}), resolvedAt: Date.now(), resolvedBy: parent.id })
      if (!holds(id).length && journal.getRun(id).status === 'errored') journal.updateRunStatus(id, 'stopped', { stopReason: 'user' })
      })
      record(id, { type: 'log', message: `用户已${resolution === 'retry' ? '确认重试' : '接纳结果'}：${nodeId}` })
      return snapshot(parent, id)
    },
    async save(parent, { name, script, scope = 'project' }) {
      assertParent(parent)
      const label = labelOf(name)
      await requireCompiled(script)
      assertParent(parent)
      if (!['project', 'global'].includes(scope)) fail('scope 必须是 project 或 global')
      const owner = scope === 'global' ? '*' : cwdOf(parent)
      const id = `saved:${JSON.stringify([owner, label])}`
      const saved = { name: label, script, scope, cwd: scope === 'project' ? owner : undefined, savedAt: Date.now() }
      journal.putDocument(id, owner, 'saved', saved)
      return jsonCopy(saved)
    },
    async listSaved(parent) { assertParent(parent); return [...journal.listDocuments(cwdOf(parent), 'saved', 100), ...journal.listDocuments('*', 'saved', 100)] },
    async runSaved(parent, { name, scope = 'project', ...input }) {
      assertParent(parent)
      const owner = scope === 'global' ? '*' : cwdOf(parent)
      const saved = journal.getDocument(`saved:${JSON.stringify([owner, labelOf(name)])}`)
      if (!saved) fail('保存的工作流不存在')
      return manager.create(parent, { ...input, name: saved.name, script: saved.script })
    },
    async artifact(parent, { id, artifactId, version }) { checked(parent, id); const artifact = journal.getArtifact(id, artifactId, version); if (!artifact) fail('产物不存在'); return artifact },
    async getArtifact(parent, input) { return manager.artifact(parent, input) },
    subscribe(listener) { if (typeof listener !== 'function') fail('监听器必须是函数'); listeners.add(listener); return () => listeners.delete(listener) },
    async wait(parent, id) { checked(parent, id); await active.get(id)?.promise; return snapshot(parent, id) },
    async dispose() { if (disposed) return; disposed = true; detachParent?.(); detachCoordinators?.(); for (const run of active.values()) run.abort.abort('interrupted'); await Promise.allSettled([...active.values()].map(run => run.promise)); await compiler.dispose(); listeners.clear(); journal.close() },
  }
  return manager
}
