import { setTimeout as delay } from 'node:timers/promises'
import { randomUUID } from 'node:crypto'
import { ConcurrencyController, WorkflowError, validate, refToString } from '@zcode/dynamic-workflow'
import { createWorld } from './world.js'
import { createNativeTeam } from './native-team.js'
import { pickRoute } from './model-stats.js'

const textBlock = text => [{ type: 'text', text }]
const READ_TOOLS = new Set(['skill', 'read', 'read_image', 'glob', 'grep', 'web_search', 'web_fetch', 'list_agents', 'team_task_list', 'team_task_get', 'job_output', 'job_list', 'tool_help', 'cordis_inspect_list', 'cordis_inspect_query', 'session_search', 'session_event_search', 'session_event_read', 'get_goal'])
const err = error => error instanceof WorkflowError ? error : new WorkflowError('DriverError', error instanceof Error ? error.message : String(error))

export function parentRoute(parent) {
  const header = parent.session.requestHeader()?.config
  const options = header?.provider && header?.model ? header : parent.options
  if (options?.provider && options?.model) return { provider: options.provider, model: options.model, ...(options.reasoningEffort === undefined ? {} : { reasoningEffort: options.reasoningEffort }), ...(options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens }) }
  const fallback = parent.ctx.get('agentDefaultModel')?.currentSelection()
  if (!fallback?.provider || !fallback.model) throw new Error('父会话没有可用的模型路由')
  return fallback
}

export function resolveRoutes(parent, input, analysis) {
  const inherited = parentRoute(parent)
  const selection = parent.ctx.get('subagentModelSelection')?.current()
  const savedPolicy = selection
  const allowed = savedPolicy?.enabled ? savedPolicy.allowedModels : []
  if (savedPolicy?.enabled && allowed.length === 0) throw new Error('当前会话没有允许的子代理模型')
  const defaultRoute = savedPolicy?.enabled && !allowed.some(route => route.provider === inherited.provider && route.model === inherited.model) ? allowed[0] : inherited
  // When the session authorises several models and the caller states an
  // objective, pick by what this machine actually observed. input.stats is the
  // recorder from manager.js; without it, or without any observation, the first
  // authorised route wins — never a guess.
  const selected = savedPolicy?.enabled && input.objective && input.objective !== 'none' && Array.isArray(input.stats?.candidates)
    ? pickRoute(input.stats.candidates, { objective: input.objective, stats: input.stats })
    : undefined
  const choose = (provider, model, explicit) => {
    if (explicit && !allowed.some(route => route.provider === provider && route.model === model)) throw new Error(`子代理模型 ${provider}/${model} 不在当前会话允许列表中`)
    return provider === inherited.provider && model === inherited.model ? { ...inherited } : { provider, model }
  }
  if ((input.provider === undefined) !== (input.model === undefined)) throw new Error('provider 和 model 必须同时指定')
  const chosen = selected ?? defaultRoute
  const recheckPin = route => { choose(route.provider, route.model, savedPolicy?.enabled === true || route.provider !== inherited.provider || route.model !== inherited.model); return route }
  const base = input.routePin?.base ? recheckPin(input.routePin.base) : choose(input.provider ?? chosen.provider, input.model ?? chosen.model, input.provider !== undefined || savedPolicy?.enabled === true)
  const bindings = Object.fromEntries(Object.entries(input.routePin?.bindings ?? {}).map(([name, route]) => [name, recheckPin(route)]))
  for (const reference of analysis.modelReferences ?? []) {
    const name = reference.name ?? reference.model
    if (bindings[name] !== undefined) continue
    if (typeof name !== 'string') throw new Error('工作流模型引用形状无效')
    let matches = allowed.filter(route => `${route.provider}/${route.model}` === name || route.model === name)
    if (!savedPolicy?.enabled && (name === inherited.model || name === `${inherited.provider}/${inherited.model}`)) matches = [inherited]
    if (matches.length !== 1) throw new Error(`模型名 ${name} 未获授权或不唯一，请使用明确的 provider/model`)
    bindings[name] = choose(matches[0].provider, matches[0].model, savedPolicy?.enabled === true)
  }
  return { base, bindings }
}

/** A real DSH actor handle is retained across every ask, and only owned handles are disposed. */
export function createDshDriver(parent, config) {
  const { journal, runId, sink, signal, emit, routes, askQuestion, recordEffect, settleEffect, concurrency } = config
  const ctx = parent.ctx
  const cwd = config.cwd ?? ctx.get("workingDirectory")?.get(parent.session) ?? parent.session.header.cwd
  const states = new Map()
  const tasks = new Set()
  const actors = new Map()
  const controller = new ConcurrencyController(`${routes.base.provider}/${routes.base.model}`, concurrency, concurrency)
  let closing = false
  let cleanup
  const addTask = task => { tasks.add(task); task.finally(() => tasks.delete(task)).catch(() => {}); return task }
  const world = createWorld(parent, { cwd, journal, runId, signal, effect: recordEffect, completeEffect: settleEffect })
  const native = createNativeTeam(parent, { ...config, cwd }, {
    isActive: id => [...states.values()].some(state => state.sessionId === id && !state.finished),
    async setup(child, spec) {
      const preset = ctx.get('permissionPresets')?.current(parent.session)
      await setup(child.ctx, child, spec.actor, spec.persona, { sandboxMode: ctx.get('sandboxPolicy')?.overrideOf(parent.session), approvalPolicy: ctx.get('approval') ? 'never' : undefined, permissionPreset: ['auto', 'danger-full-access'].includes(preset) ? preset : undefined }, spec.route)
    },
    attached(child) { for (const state of states.values()) if (state.sessionId === child.id && !state.finished) state.child = child },
  })
  const setBoundary = async (state, child) => {
    if (ctx.get('agents').get(child.id) === child) await ctx.get('sessions').flush(child.session)
    const count = child.session.deriveMessages().length
    const snapshot = await ctx.get('sessionQuery').readSession(child.id)
    const checkpoint = { sessionId: child.id, messageCount: count, eventCount: snapshot.events.length }
    journal.putDocument(`transcript:${child.id}:${count}`, parent.id, 'transcript', checkpoint)
    journal.putDocument(`transcript-latest:${child.id}`, parent.id, 'transcript', checkpoint)
    const node = journal.getNode(runId, state.instance.siteId, state.instance.ordinal)
    if (node?.status === 'completed') journal.putNode({ ...node, messageBoundary: count })
  }
  const follow = async (state, instructions) => { state.child = await native.send(state.sessionId, instructions) }
  const activeState = child => [...states.values()].find(state => state.sessionId === child.id && !state.finished)
  async function setup(childCtx, child, actor, persona, overrides, route) {
    childCtx.on('system-prompt/assemble', async (_assembly, _context, next) => {
      const assembled = await next()
      return { ...assembled, variables: { ...assembled.variables, provider: route.provider, model: route.model } }
    })
    const inheritedTools = new Set(ctx.get('tools').schemas(parent).map(tool => tool.name))
    const deniedGlobals = ctx.get('tools').schemas().map(tool => tool.name).filter(name => !inheritedTools.has(name))
    if (deniedGlobals.length) childCtx.get('tools').restrict({ deny: deniedGlobals })
    const readOnlyFusionActor = typeof persona.system === 'string' && ['[fusion-review-only:v1]', '[fusion-lead-only:v1]'].some(prefix => persona.system.startsWith(prefix))
    if (readOnlyFusionActor) childCtx.effect(() => childCtx.get('tools').presentAs('native'))
    const stagedSubmits = new Map()
    const pendingTools = new Map()
    let nestedSubmit
    childCtx.get('systemPrompt').section({ name: `workflow:${runId}:persona`, order: 80, text: `You are workflow actor ${persona.name ?? refToString(actor)}. Keep your conversation across asks. Work only on your current ask. Use submit_result for a typed answer and escalate for a blocking question. All inherited permissions, tool guards and model restrictions apply. Omit sandbox_permissions when optional; if the tool schema requires it, use only the current sandbox mode and a non-empty justification. Correct argument-validation refusals, which have not executed the operation. Never retry a real sandbox denial or an operation whose external outcome is unknown.\n${persona.system ?? ''}` })
    if (overrides.sandboxMode !== undefined) child.session.append('sandbox/mode', { mode: overrides.sandboxMode, source: 'delegation' })
    if (overrides.approvalPolicy !== undefined) child.session.append('approval/policy', { policy: overrides.approvalPolicy, source: 'delegation' })
    if (overrides.permissionPreset !== undefined) child.session.append('permission/preset', { preset: overrides.permissionPreset })
    childCtx.get('tools').guard(exec => {
      const state = activeState(child)
      if (!state) return '当前没有获准执行的工作流 ask'
      if (stagedSubmits.size || nestedSubmit || state.submitted !== undefined || state.accepted) return '当前 ask 已提交结果，等待引擎收口'
      if (exec.arguments && typeof exec.arguments === 'object' && exec.arguments.sandbox_permissions !== undefined && exec.arguments.sandbox_permissions !== childCtx.get('sandboxPolicy').resolve({ session: child.session }).mode) return '工作流子代理不能扩大创建时的权限范围；请省略 sandbox_permissions，使用继承的工作区权限。此请求尚未执行。'
      if (readOnlyFusionActor && !READ_TOOLS.has(exec.name) && !['submit_result', 'escalate'].includes(exec.name)) return `${persona.name} 是只读角色，不能执行修改类工具`
      if (['workflow', 'zcode_workflow', 'create_goal', 'ralph', 'plugin_manager', 'subagent', 'subagent_fork', 'subagent_codex', 'spawn_teammate', 'team_task_create', 'team_task_update', 'interrupt_agent'].includes(exec.name)) return '工作流的派发和任务状态由 ZCode 引擎管理；队友可通过 send_message 协作，不能启动第二套编排或修改环境'
      return undefined
    })
    childCtx.get('tools').register({
      name: 'submit_result', description: 'Submit the JSON result for the current typed workflow ask. Invalid values are rejected with schema violations; correct them and submit again.',
      parameters: { type: 'object', properties: { value: {} }, required: ['value'], additionalProperties: false },
      output: { schema: {}, render: (_args, value) => textBlock(JSON.stringify(value)) },
      async execute(args, exec) {
        const state = activeState(child)
        if (!state?.message.typed) throw new Error('当前 ask 无结构化提交要求')
        const violations = validate(state.message.schema, args.value)
        if (violations.length) {
          sink.askSubmitAttempted(state.instance, args.value)
          return state.verdict ?? { kind: 'reject', violations }
        }
        stagedSubmits.set(exec, { state, value: args.value })
        exec.concludeTurn()
        return { recorded: true }
      },
    })
    childCtx.get('tools').register({
      name: 'escalate', description: 'Ask the workflow owner one blocking question. This ask waits for an answer; other actors keep running.',
      parameters: { type: 'object', properties: { question: { type: 'string' }, context: { type: 'string' } }, required: ['question'], additionalProperties: false },
      output: { schema: { type: 'string' }, render: (_args, value) => textBlock(value) },
      async execute(args, exec) {
        const state = activeState(child)
        if (!state) throw new Error('当前没有在执行的 ask')
        return askQuestion({ actor, actorName: persona.name, instance: state.instance, question: args.question, context: args.context }, exec.signal)
      },
    })
    childCtx.on('tools/execute', async (exec, next) => {
      const state = activeState(child)
      if (!state || ['submit_result', 'escalate'].includes(exec.name)) return next()
      state.toolCalls++
      state.worldToolCalls++
      state.lastTool = { name: exec.name.slice(0, 64) }
      if (READ_TOOLS.has(exec.name)) return next()
      sink.askMutating(state.instance)
      const id = `${runId}:tool:${exec.callId}`
      const pending = { id, runId, kind: 'tool', nodeId: refToString(state.instance), instance: state.instance, actor, sessionId: child.id, tool: exec.name, arguments: exec.arguments, state: 'pending', startedAt: Date.now() }
      journal.putEffect(pending)
      pendingTools.set(exec, pending)
      try { return await next() }
      catch (error) { pendingTools.delete(exec); journal.putEffect({ ...pending, state: 'unknown', error: error.message, endedAt: Date.now() }); throw error }
    })
    childCtx.on('tools/result', (exec, result) => {
      const pending = pendingTools.get(exec)
      if (pending) {
        pendingTools.delete(exec)
        journal.putEffect({ ...pending, state: result.isError || exec.signal.aborted ? 'unknown' : 'settled', outcome: result, endedAt: Date.now() })
      }
      const staged = stagedSubmits.get(exec)
      if (staged) {
        stagedSubmits.delete(exec)
        if (!result.isError) {
          if (exec.parent === undefined) staged.state.submitted = { value: staged.value }
          else nestedSubmit = { ...staged, parent: exec.parent }
        }
      } else if (nestedSubmit?.parent === exec.token) {
        if (!result.isError) nestedSubmit.state.submitted = { value: nestedSubmit.value }
        nestedSubmit = undefined
      }
    })
    childCtx.on('agent/request-error', async (payload, next) => {
      const state = activeState(child)
      if (!state) return next()
      const throttled = payload.failure.status === 429 || payload.failure.status === 503
      if (state.ticket !== undefined) {
        const changes = throttled ? controller.throttled(Date.now(), state.ticket, payload.failure.status === 429 ? 'rate_limited' : 'provider_overloaded', payload.failure.providerRetryAfterMs) : controller.failedTransient(Date.now())
        state.ticket = undefined
        for (const change of changes) sink.concurrencyChanged(change)
      }
      sink.askWaiting(state.instance, { cause: 'backoff', reason: payload.failure.code, retryAfterMs: payload.failure.providerRetryAfterMs })
      return next()
    })
    childCtx.on('agent/request', async (payload, next) => {
      const state = activeState(child)
      if (!state || state.finished) throw new Error('当前没有获准执行的工作流 ask')
      if (state) {
        if (state.ticket !== undefined) { for (const change of controller.succeeded(Date.now(), state.ticket)) sink.concurrencyChanged(change); state.ticket = undefined }
        while (!controller.canAdmit(Date.now())) {
          sink.askWaiting(state.instance, { cause: 'slot' })
          await delay(50, undefined, { signal: payload.signal })
        }
        controller.waiters(Date.now(), Math.max(0, [...states.values()].filter(value => !value.finished && value.ticket === undefined).length - 1))
        state.ticket = controller.admitted(Date.now())
        sink.askExecuting(state.instance)
      }
      const resolved = await next()
      const { reasoningEffort: _inheritedEffort, ...rest } = resolved
      return { ...rest, provider: route.provider, model: route.model, ...(route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort }), ...(route.maxTokens === undefined ? {} : { maxTokens: route.maxTokens }) }
    })
  }
  async function createActorSession(actor, persona, seed) {
    signal.throwIfAborted()
    if (closing) throw new Error('工作流已结束')
    const existing = journal.getActor(runId, actor.siteId, actor.ordinal)
    let route = persona.model === undefined ? routes.base : routes.bindings[persona.model]
    if (!route) throw new Error(`工作流模型 ${persona.model} 没有获准的绑定`)
    if (existing?.resolvedModel) {
      const pin = JSON.parse(existing.resolvedModel)
      const authorized = [routes.base, ...Object.values(routes.bindings)].find(route => route.provider === pin.provider && route.model === pin.model)
        ?? resolveRoutes(parent, { provider: pin.provider, model: pin.model }, { modelReferences: [] }).base
      route = authorized
    }
    const link = await native.createActor(actor, persona, route, seed, existing)
    actors.set(link.sessionId, { actor, persona, route, tail: Promise.resolve() })
    journal.putActor({ ...existing, runId, ...actor, name: persona.name, persona, sessionId: link.sessionId, resolvedModel: JSON.stringify(route) })
    return { id: link.sessionId }
  }
  function startAsk(session, instance, message) {
    const owner = actors.get(session.id)
    if (!owner) { sink.askFailed(instance, new WorkflowError('DriverError', 'actor 会话未创建')); return }
    const state = { instance, message, sessionId: session.id, accepted: false, finished: false, toolCalls: 0, worldToolCalls: 0, turns: 0, startedAt: Date.now() }
    states.set(refToString(instance), state)
    owner.tail = addTask(owner.tail.then(async () => {
      if (closing || signal.aborted || state.cancelled) return
      await native.beginTask(instance, message, session.id)
      const prompt = message.typed ? `${message.instructions}\n\nReturn your result through submit_result({value: ...}). Required JSON Schema:\n${JSON.stringify(message.schema)}` : message.instructions
      state.startSeq = (await ctx.get('sessionQuery').readSession(session.id)).events.length
      await follow(state, prompt)
      for (;;) {
        const child = state.child
        await child.whenIdle()
        state.turns++
        if (ctx.get('agents').get(child.id) === child) await ctx.get('sessions').flush(child.session)
        const snapshot = await ctx.get('sessionQuery').readSession(child.id)
        state.reason = snapshot.events.findLast(row => row.type === 'turn/end')?.data.reason
        const final = child.session.deriveMessages().filter(row => row.role === 'assistant').at(-1)
        const finalText = (final?.content ?? []).filter(block => block.type === 'text').map(block => block.text).join('\n')
        if (state.cancelled || signal.aborted) { await setBoundary(state, child); break }
        sink.askProgress(instance, { turn: state.turns, toolCalls: state.toolCalls, ...(state.lastTool ? { lastTool: state.lastTool } : {}) })
        const fresh = snapshot.events.slice(state.statsEventCount ?? state.startSeq ?? 0)
        const tokens = fresh.reduce((total, event) => total + (event.type === 'assistant/message' ? event.data.usage?.totalTokens ?? ((event.data.usage?.inputTokens ?? 0) + (event.data.usage?.outputTokens ?? 0)) : 0), 0)
        sink.askStats(instance, { tokens, toolCalls: state.toolCalls - (state.statsTools ?? 0), worldToolCalls: state.worldToolCalls - (state.statsWorldTools ?? 0), turns: 1 })
        // Feed the observed cost of this ask back so a later run with a routing
        // objective can rank models on what actually happened here.
        config.observeModel?.(owner.route, { elapsedMs: Date.now() - state.startedAt, tokens, failed: state.reason?.kind !== 'completed' })
        state.statsTools = state.toolCalls; state.statsWorldTools = state.worldToolCalls; state.statsEventCount = snapshot.events.length
        if (state.reason?.kind !== 'completed') { sink.askFailed(instance, new WorkflowError('DriverError', JSON.stringify(state.reason ?? { kind: 'missing-turn-end' }))); break }
        if (state.submitted) {
          sink.askSubmitAttempted(instance, state.submitted.value)
          state.accepted = state.verdict?.kind === 'accept'
        }
        if (state.ticket !== undefined) { for (const change of controller.succeeded(Date.now(), state.ticket)) sink.concurrencyChanged(change); state.ticket = undefined }
        if (state.accepted) { await setBoundary(state, child); break }
        state.verdict = undefined
        sink.askTurnEnded(instance, finalText)
        if (!message.typed) { await setBoundary(state, child); break }
        if (state.verdict?.kind === 'nudge') { state.submitted = undefined; await follow(state, 'Submit your answer using submit_result({value: ...}) now.'); continue }
        break
      }
      await setBoundary(state, state.child)
    }).catch(error => { sink.askFailed(instance, err(error)) }).finally(async () => {
      state.finished = true
      if (state.ticket !== undefined) { controller.ended(Date.now()); state.ticket = undefined }
      await native.settleTask(instance)
    }))
  }
  const driver = {
    journal, emit,
    createActorSession, startAsk,
    setMaxConcurrency(value) { for (const change of controller.setGrowthLimit(Date.now(), value)) sink.concurrencyChanged(change) },
    respondToSubmit(instance, verdict) { const state = states.get(refToString(instance)); if (state) state.verdict = verdict },
    cancelAsk(instance) { const state = states.get(refToString(instance)); if (state && !state.finished) { state.cancelled = true; if (state.ticket !== undefined) { controller.ended(Date.now()); state.ticket = undefined }; native.interrupt(state.sessionId) } },
    executeWorldRead: world.execute,
    executeArtifactPublish: world.publish,
    dispose() {
      closing = true
      cleanup ??= (async () => {
        const stopped = await Promise.allSettled([native.stop()])
        const settled = await Promise.allSettled([...tasks])
        try {
          const errors = [...stopped, ...settled].filter(row => row.status === 'rejected').map(row => row.reason)
          if (errors.length) throw new AggregateError(errors, '原生团队收口失败')
        } finally { await native.dispose() }
      })()
      cleanup.catch(error => ctx.logger?.warn(`workflow cleanup: ${error.message}`))
    },
    async quiesce() { driver.dispose(); await cleanup },
  }
  return driver
}
