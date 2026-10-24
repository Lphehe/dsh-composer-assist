import assert from 'node:assert/strict'
import { InMemoryJournalStore } from '@zcode/dynamic-workflow'
import { createDshDriver, resolveRoutes } from './dsh-driver.js'

async function check(mode) {
  const registry = new Map()
  const persisted = new Map()
  const headers = new Map()
  const handles = new Map()
  const releases = new Map()
  const listeners = new Set()
  const providers = new Map()
  const members = new Map()
  const board = new Map()
  const trace = []
  const docs = new Map()
  const effects = new Map()
  const journal = Object.assign(new InMemoryJournalStore(), { putDocument: (id, _owner, _kind, value) => docs.set(id, value), getDocument: id => docs.get(id), listDocuments: (_owner, kind) => kind === 'native-task' ? [...docs.values()].filter(value => value.taskId && value.instance) : [], putEffect: value => effects.set(value.id, value) })
  journal.createRun({ runId: mode, status: 'running', parentSessionId: 'parent', spentTokens: 0, caps: { maxConcurrency: 2 } })
  const parent = { id: 'parent', options: { provider: 'parent-provider', model: 'parent-model' }, session: { header: { id: 'parent', cwd: '/tmp' }, requestHeader: () => undefined } }
  registry.set(parent.id, parent)
  registry.set('unrelated', { id: 'unrelated' })
  const presets = new WeakSet()
  const services = { sandboxPolicy: { overrideOf: () => 'read-only' }, approval: {}, permissionPresets: { current: () => 'auto' }, agentPresets: { composeFrom(scope) { if (presets.has(scope)) throw new Error('Child already joined a preset'); presets.add(scope) }, composedPreset: () => undefined }, subagentModelSelection: { current: () => ({ enabled: true, allowedModels: [{ provider: 'child-provider', model: 'child-model' }] }) } }
  let finished
  let nativeRelease = false
  let requests = 0
  let serial = 0
  const ctx = {
    get: name => services[name] ?? ctx[name],
    on(name, callback) { assert.equal(name, 'agent/created'); listeners.add(callback); return () => listeners.delete(callback) },
    tools: { schemas: scope => scope ? [{ name: 'read' }, { name: 'write' }, { name: 'parent_scoped' }] : [{ name: 'read' }, { name: 'write' }, { name: 'not_visible' }] },
    fs: { resolve: async () => ({ targetKey: '/tmp' }) },
    logger: { warn: message => trace.push(`warning:${message}`) },
    sessionPersistence: { stat: async id => headers.get(id) },
    sessionQuery: { readSession: async id => { assert.ok(persisted.has(id)); return { events: persisted.get(id) } } },
    sessions: { async flush() { trace.push('flush') } },
    agents: {
      get: id => registry.get(id),
      async create(options) { return makeAgent(options, false) },
      async resume(options) { return makeAgent({ ...options, sessionId: options.resumeSessionId }, true) },
    },
  }
  async function makeAgent(options, resume) {
    const coordinator = options.sessionId.startsWith('dwf-team-')
    assert.equal(options.parentAgent.id, coordinator ? 'parent' : `dwf-team-${mode}`)
    assert.deepEqual(options.agentOptions, { provider: 'child-provider', model: 'child-model' })
    if (!coordinator) assert.equal(options.managed, true, 'actors must be created/resumed by standard subagents, not by the driver')
    const events = resume ? persisted.get(options.sessionId) : [...(options.seed ?? [])]
    assert.ok(events)
    persisted.set(options.sessionId, events)
    const handlers = new Map()
    const definitions = new Map()
    const guards = []
    let denied
    let idle = Promise.resolve()
    let turn
    const pending = []
    const header = resume ? headers.get(options.sessionId) : { id: options.sessionId, ...options.meta }
    headers.set(options.sessionId, header)
    const session = { header, get seq() { return events.length }, append(type, data) { events.push({ seq: events.length, type, data }) }, deriveMessages() { return events.filter(event => ['user/message', 'assistant/message'].includes(event.type)).map(event => event.data) } }
    const dispatch = async (name, payload, next) => {
      const stack = handlers.get(name) ?? []
      const run = index => index === stack.length ? next() : stack[index](payload, () => run(index + 1))
      return run(0)
    }
    const childCtx = {
      get: name => services[name] ?? childCtx[name] ?? ctx[name],
      systemPrompt: { section() {} },
      on(name, handler) { const rows = handlers.get(name) ?? []; rows.push(handler); handlers.set(name, rows); return () => {} },
      tools: { restrict(filter) { assert.deepEqual(filter, { deny: ['not_visible'] }); denied = filter.deny }, guard(guard) { guards.push(guard) }, register(definition) { definitions.set(definition.name, definition) } },
    }
    const agent = {
      id: options.sessionId, ctx: childCtx, session, options: options.agentOptions,
      inbox: { get hasPending() { return pending.length > 0 } },
      inject(message) { pending.push(message) },
      followup(message) {
        assert.equal(message.role, 'user')
        assert.ok(['user', 'agent-message'].includes(message.source.kind))
        turn = new AbortController()
        const claimed = [...pending.splice(0), { ...message, id: `input-${++serial}` }]
        idle = Promise.resolve().then(async () => {
          try {
            const decision = await dispatch('agent/pre-step', { agent, signal: turn.signal, messages: claimed, step: 1 }, async () => ({ kind: 'enter', messages: claimed }))
            if (decision.kind === 'reject') {
              assert.ok(claimed.every(input => pending.includes(input)), 'rejected idle input must retain the same message objects/IDs for native acceptance')
              session.append('turn/end', { reason: { kind: 'blocked' } }); return
            }
            for (const input of decision.messages) session.append('user/message', input)
            requests++
            const route = await dispatch('agent/request', { signal: turn.signal }, async () => ({ provider: 'wrong', model: 'wrong', reasoningEffort: 'wrong' }))
            assert.equal(route.provider, 'child-provider'); assert.equal(route.model, 'child-model'); assert.equal(route.reasoningEffort, undefined)
            const execute = async (name, value, postError = false) => {
              assert.ok(!denied?.includes(name), `${name} must remain visible`)
              const exec = { name, arguments: value, callId: `${name}-${events.length}`, token: Symbol(name), signal: turn.signal, concludeTurn() { trace.push('conclude') } }
              for (const guard of guards) assert.equal(guard(exec), undefined)
              const next = async () => { await definitions.get(name)?.execute(value, exec); return { content: [{ type: 'text', text: 'recorded' }], ...(postError ? { isError: true } : {}) } }
              const result = await dispatch('tools/execute', exec, next)
              for (const handler of handlers.get('tools/result') ?? []) handler(exec, result)
              trace.push(`result:${name}:${!!result.isError}`)
            }
            assert.ok(definitions.has('submit_result'), 'typed tools must exist before the first native request')
            for (const name of ['spawn_teammate', 'team_task_update', 'zcode_workflow']) assert.ok(guards.some(guard => guard({ name })), 'actors cannot bypass engine-owned admission')
            if (mode === 'unknown-mutation') await execute('write', { path: 'x' }, true)
            await execute('submit_result', { value: { ok: true } }, mode === 'post-error')
            session.append('assistant/message', { role: 'assistant', content: [{ type: 'text', text: 'done' }], usage: { totalTokens: 17 } })
            session.append('turn/end', { reason: { kind: 'completed' } })
            trace.push('turn/end')
          } catch (error) { session.append('turn/end', { reason: { kind: 'error', error: { message: error.message } } }) }
        })
      },
      whenIdle: () => idle,
      cancel() { pending.length = 0; turn?.abort() },
    }
    if (options.managed) services.agentPresets.composeFrom(childCtx, options.parentAgent.ctx)
    await options.setup?.(childCtx, agent)
    registry.set(agent.id, agent)
    for (const listener of listeners) await listener({ agent })
    const handle = { agent, async dispose() {
      if (!coordinator) assert.equal(nativeRelease, true, 'only standard subagents may release actor handles')
      registry.delete(agent.id); handles.delete(agent.id)
    } }
    handles.set(agent.id, handle)
    return handle
  }
  async function release(id) {
    const handle = handles.get(id)
    if (handle) { handle.agent.cancel(); await handle.agent.whenIdle(); nativeRelease = true; try { await handle.dispose() } finally { nativeRelease = false } }
  }
  ctx.subagents = {
    registerProvider(provider) { assert.ok(!providers.has(provider.name)); providers.set(provider.name, provider); return () => providers.delete(provider.name) },
    async startActivation(spec) {
      if (mode === 'capacity') throw new Error('ACTIVATION_LIMIT_REACHED')
      const provider = providers.get(spec.provider)
      assert.ok(provider, 'native Teams must use the registered workflow provider')
      const prepared = await provider.prepareContinuable({ sessionId: spec.childId, parent: spec.request.parent })
      const handle = await ctx.agents.create({ managed: true, sessionId: spec.childId, parentAgent: spec.request.parent, agentOptions: spec.request.parent.options, seed: prepared.seed, meta: { parentSession: spec.request.parent.id, cwd: '/tmp', origin: 'subagent' }, setup(_childCtx, child) { child.session.append('subagent/descriptor', { version: 3, mode: 'continuable', provider: spec.provider }) } })
      trace.push(`catalog:${spec.childId}`)
      handle.agent.followup({ role: 'user', source: { kind: 'user' }, content: spec.request.prompt })
      await handle.agent.whenIdle()
      assert.equal(persisted.get(spec.childId).at(-1).data.reason.kind, 'blocked')
      assert.ok(handle.agent.inbox.hasPending, 'bootstrap must remain durably accepted without a model request')
      if (!handle.agent.inbox.hasPending) await release(spec.childId)
      return { childId: spec.childId, messageId: 'bootstrap' }
    },
    interrupt(id, authority) { assert.equal(authority.agent.id, `dwf-team-${mode}`); registry.get(id)?.cancel() },
    async drainChildren(lead, ids) { assert.equal(lead.id, `dwf-team-${mode}`); for (const id of ids) await release(id) },
  }
  const viewMembers = lead => [{ id: lead.id, name: 'lead', role: 'lead', status: 'inactive' }, ...(members.get(lead.id) ?? []).map(row => ({ ...row, status: row.phase === 'failed' ? 'failed' : registry.has(row.id) ? 'running' : 'inactive' }))]
  ctx.agentTeams = {
    listMembers: viewMembers,
    async spawnTeammate(lead, request) {
      const rows = members.get(lead.id) ?? []
      assert.ok(!rows.some(row => row.name === request.name), 'resume must not create a duplicate teammate')
      const member = { id: `member-${++serial}`, name: request.name, role: 'teammate', phase: 'provisioning' }
      rows.push(member); members.set(lead.id, rows)
      try { await ctx.subagents.startActivation({ childId: member.id, provider: request.provider, request: { parent: lead, prompt: request.prompt } }); member.phase = 'active' }
      catch (error) { member.phase = 'failed'; throw error }
      return { member: viewMembers(lead).find(row => row.id === member.id) }
    },
    async sendMessage(lead, request) {
      const member = viewMembers(lead).find(row => row.name === request.target)
      assert.ok(member)
      await releases.get(member.id)
      let child = registry.get(member.id)
      if (!child) child = (await ctx.agents.resume({ managed: true, resumeSessionId: member.id, parentAgent: lead, agentOptions: lead.options })).agent
      child.followup({ role: 'user', source: { kind: 'agent-message', senderSessionId: lead.id }, content: request.content })
      releases.set(member.id, child.whenIdle().then(() => { if (!child.inbox.hasPending) return release(member.id) }))
      return { messageId: `message-${++serial}` }
    },
    listTasks: () => [...board.values()].map(row => structuredClone(row)),
    getTask: (_lead, id) => structuredClone(board.get(id)),
    async createTask(_lead, request) { const row = { id: `task-${board.size + 1}`, revision: 1, status: 'pending', ...request }; board.set(row.id, row); return structuredClone(row) },
    async updateTask(_lead, request) {
      const row = board.get(request.taskId)
      assert.equal(row.revision, request.expectedRevision, 'native task writes require a fresh CAS revision')
      if (request.action === 'claim') { assert.equal(row.status, 'pending'); row.status = 'in_progress'; row.ownerName = 'lead' }
      else if (request.action === 'reassign') row.ownerName = request.owner
      else if (request.action === 'complete') { assert.equal(row.status, 'in_progress'); row.status = 'completed' }
      else if (['release', 'reopen'].includes(request.action)) { row.status = 'pending'; delete row.ownerName }
      else assert.fail(`unexpected task action ${request.action}`)
      row.revision++
      return structuredClone(row)
    },
  }
  parent.ctx = ctx
  const routes = resolveRoutes(parent, {}, { modelReferences: [] })
  assert.equal(routes.base.model, 'child-model')
  assert.throws(() => resolveRoutes(parent, { provider: 'other', model: 'other' }, { modelReferences: [] }), /允许列表/)
  let accepted = 0
  let ended = 0
  let stats = 0
  let failed
  let driver
  let sessionId
  const actor = { siteId: 'actor#1', ordinal: 1 }
  const sink = {
    askSubmitAttempted(ref, value) { assert.ok(trace.includes('turn/end')); assert.ok(trace.includes('flush')); accepted++; const row = journal.getNode(mode, ref.siteId, ref.ordinal); journal.putNode({ ...row, status: 'completed', result: value }); driver.respondToSubmit(ref, { kind: 'accept' }); finished() },
    askTurnEnded() { ended++; finished() },
    askFailed(_ref, error) { failed = error.message; finished?.() },
    askStats(_ref, value) { stats += value.tokens }, askProgress() {}, askWaiting() {}, askExecuting() {}, askMutating() {}, concurrencyChanged() {},
  }
  journal.putActor({ runId: mode, ...actor, name: 'worker', persona: { name: 'worker' } })
  for (let round = 0; round < 2; round++) {
    driver = createDshDriver(parent, { hostContext: ctx, journal, runId: mode, sink, signal: new AbortController().signal, emit() {}, routes, askQuestion() {}, recordEffect() {}, settleEffect() {}, concurrency: 2 })
    if (mode === 'capacity') {
      await assert.rejects(driver.createActorSession(actor, { name: 'worker' }), /ACTIVATION_LIMIT_REACHED/)
      await driver.quiesce()
      assert.equal(requests, 0, 'capacity failure must not fall back to an unmanaged actor')
      return
    }
    const before = requests
    const session = await driver.createActorSession(actor, { name: 'worker' })
    assert.equal(requests, before, 'coordinator and actor initialization must make zero model requests')
    if (sessionId) assert.equal(session.id, sessionId, 'resume must retain the exact original native member')
    sessionId = session.id
    assert.ok(trace.includes(`catalog:${session.id}`))
    for (const [type, field, value] of [['approval/policy', 'policy', 'never'], ['sandbox/mode', 'mode', 'read-only']]) assert.ok(persisted.get(session.id).some(event => event.type === type && event.data[field] === value))
    for (let ask = 0; ask < 2; ask++) {
      const instance = { siteId: `ask#${round * 2 + ask + 1}`, ordinal: 1 }
      journal.putNode({ runId: mode, ...instance, actorSiteId: actor.siteId, actorOrdinal: actor.ordinal, actorSeq: round * 2 + ask, kind: 'ask', inputHash: 'x', status: 'running' })
      const completion = new Promise(resolve => { finished = resolve })
      driver.startAsk(session, instance, { typed: true, instructions: 'Submit ok:true', schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false } })
      await completion
      assert.equal(failed, undefined, failed)
    }
    await driver.quiesce()
    assert.equal(listeners.size, 0, 'plugin-owned initialization listeners must be released')
    assert.equal(providers.size, 0, 'plugin-owned providers must be released')
    assert.equal(members.get(`dwf-team-${mode}`).length, 1)
    assert.ok(registry.has('unrelated'), 'cleanup must not touch unrelated Agents')
    assert.equal(registry.size, 2, 'coordinator and owned native activations must be released')
  }
  if (mode === 'success') {
    const stale = [...board.values()][0]
    stale.status = 'pending'; stale.revision++
    const before = requests
    const replay = createDshDriver(parent, { hostContext: ctx, journal, runId: mode, sink, signal: new AbortController().signal, emit() {}, routes, askQuestion() {}, recordEffect() {}, settleEffect() {}, concurrency: 2 })
    await replay.quiesce()
    assert.equal(stale.status, 'completed', 'cached replay must reconcile a native task left behind after engine commit')
    assert.equal(requests, before, 'native task reconciliation must not rerun a completed ask')
    assert.equal(registry.size, 2)
  }
  assert.equal(accepted, mode === 'post-error' ? 0 : 4)
  assert.equal(ended, mode === 'post-error' ? 4 : 0)
  assert.equal(stats, 68)
  assert.ok(docs.has(`transcript-latest:${sessionId}`))
  assert.equal(docs.get(`native-team:${mode}`).teamSessionId, `dwf-team-${mode}`)
  assert.ok([...board.values()].every(row => row.status === (mode === 'post-error' ? 'pending' : 'completed')))
  if (mode === 'unknown-mutation') assert.ok([...effects.values()].every(row => row.state === 'unknown'))
}
for (const mode of ['success', 'post-error', 'unknown-mutation', 'capacity']) await check(mode)
console.log('driver selfcheck passed: native Teams/provider/catalog, cold typed asks, run resume/member identity, authoritative task completion, capacity refusal, policy/model inheritance and owned cleanup')
