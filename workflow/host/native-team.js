import { createHash } from 'node:crypto'
import { refToString } from '@zcode/dynamic-workflow'

export function parkWorkflowMessages(agent, messages) {
  // Rejection consumes claimed input; retain the original IDs for native delivery receipts.
  // shortcut: concurrent arrivals may precede parked input; use ordered admission if strict FIFO is required.
  for (const message of messages) agent.inject(message)
  return Promise.resolve({ kind: 'reject' })
}

/** Teams owns members; the standard subagent manager owns their Agent handles. */
export function createNativeTeam(parent, config, callbacks) {
  const { journal, runId, signal, routes, cwd } = config
  const ctx = config.hostContext ?? parent.ctx
  const agents = ctx.get('agents')
  const teams = ctx.get('agentTeams')
  const subagents = ctx.get('subagents')
  if (!teams || !subagents) throw new Error('动态工作流需要启用 DSH 原生 Teams 和标准子代理管理')
  const leadId = `dwf-team-${runId}`
  const provider = `composer-workflow-${runId}`
  const seen = new Map()
  let leadHandle
  let opening
  let closed = false
  const memberKey = name => `native-member:${leadId}:${name}`
  const taskKey = instance => `native-task:${runId}:${refToString(instance)}`
  const nameOf = actor => `actor-${createHash('sha256').update(refToString(actor)).digest('hex').slice(0, 24)}`
  const doc = (key, kind, value) => journal.putDocument(key, runId, kind, value)
  const actorSpec = (lead, childId) => {
    const member = teams.listMembers(lead).find(row => row.id === childId)
    return member && journal.getDocument(memberKey(member.name))
  }
  const seedEvents = async seed => {
    if (!seed) return undefined
    const boundary = journal.getDocument(`transcript:${seed.sourceSessionId}:${seed.messageCount}`)
    if (!boundary) throw new Error('缺少完整转录边界，拒绝接续原生成员')
    const source = await ctx.get('sessionQuery').readSession(seed.sourceSessionId)
    const events = source.events.slice(0, boundary.eventCount)
    if (events.at(-1)?.type !== 'turn/end') throw new Error('原生成员种子必须结束于已闭合 turn')
    return events
  }
  const unregister = subagents.registerProvider({
    name: provider,
    capabilities: { agentOptions: true, agentPreset: true, outputSchema: false, depthLimit: true },
    inheritsParentContext: false,
    async prepareContinuable({ sessionId, parent: lead }) {
      if (lead.id !== leadId || agents.get(lead.id) !== lead) throw new Error('工作流 provider 的父会话不匹配')
      const spec = actorSpec(lead, sessionId)
      if (!spec) throw new Error('原生成员没有对应的 ZCode actor')
      const seed = await seedEvents(spec.seed)
      return seed === undefined ? {} : { seed }
    },
  })
  const stopCreated = ctx.on('agent/created', async ({ agent }) => {
    if (agent.session.header.parentSession !== leadId) return
    const lead = agents.get(leadId)
    if (!lead || closed) throw new Error('工作流团队已关闭')
    const spec = actorSpec(lead, agent.id)
    if (!spec) throw new Error('拒绝未登记的工作流团队成员')
    // Idle messages remain context; only a ZCode-admitted ask may execute tools/model work.
    agent.ctx.on('agent/pre-step', ({ messages }, next) => callbacks.isActive(agent.id) ? next() : parkWorkflowMessages(agent, messages))
    await callbacks.setup(agent, spec)
    seen.set(agent.id, agent)
    callbacks.attached(agent)
  })
  async function ensureLead() {
    if (closed) throw new Error('工作流团队已关闭')
    if (leadHandle) return leadHandle.agent
    opening ??= (async () => {
      if (agents.get(leadId)) throw new Error('工作流团队已被另一执行器占用')
      const options = {
        parentAgent: parent, agentOptions: routes.base, signal,
        setup(leadCtx, lead) {
          leadCtx.get('agentPresets')?.composeFrom(leadCtx, parent.ctx)
          const sandboxMode = ctx.get('sandboxPolicy')?.overrideOf(parent.session)
          const preset = ctx.get('permissionPresets')?.current(parent.session)
          if (sandboxMode !== undefined) lead.session.append('sandbox/mode', { mode: sandboxMode, source: 'delegation' })
          if (ctx.get('approval')) lead.session.append('approval/policy', { policy: 'never', source: 'delegation' })
          if (['auto', 'danger-full-access'].includes(preset)) lead.session.append('permission/preset', { preset, source: 'delegation' })
          leadCtx.on('agent/pre-step', ({ messages }) => parkWorkflowMessages(lead, messages))
        },
      }
      const stored = await ctx.get('sessionPersistence').stat(leadId)
      leadHandle = stored
        ? await agents.resume({ ...options, resumeSessionId: leadId })
        : await agents.create({ ...options, sessionId: leadId, meta: { cwd, parentSession: parent.id, ...(ctx.get('agentPresets')?.composedPreset(parent.ctx) ? { agentPreset: ctx.get('agentPresets').composedPreset(parent.ctx) } : {}) } })
      doc(`native-team:${runId}`, 'native-team', { teamSessionId: leadId, parentSessionId: parent.id, provider })
      for (const saved of journal.listDocuments(runId, 'native-task', 1000)) if (saved.instance) await settleTask(saved.instance)
      return leadHandle.agent
    })()
    return opening
  }
  async function createActor(actor, persona, route, seed, previous) {
    signal.throwIfAborted()
    const lead = await ensureLead()
    const name = nameOf(actor)
    let spec = journal.getDocument(memberKey(name))
    if (!spec) {
      if (!seed && previous?.sessionId) {
        const boundary = journal.getDocument(`transcript-latest:${previous.sessionId}`)
        if (!boundary) throw new Error('旧 actor 缺少安全转录边界，请修订为新运行后继续')
        seed = { sourceSessionId: previous.sessionId, messageCount: boundary.messageCount }
      }
      spec = { actor, persona, route, ...(seed ? { seed } : {}) }
      doc(memberKey(name), 'native-member', spec)
    }
    let member = teams.listMembers(lead).find(row => row.name === name)
    if (!member) {
      const created = await teams.spawnTeammate(lead, { name, description: String(persona.name ?? refToString(actor)).slice(0, 200), context: 'fresh', provider, signal, prompt: [{ type: 'text', text: 'Workflow actor initialized. Wait for the ZCode engine to admit your next ask; this initialization performs no model work.' }] })
      member = created.member
    }
    if (member.status === 'failed' || member.status === 'provisioning') throw new Error(`原生成员 ${name} 尚不可运行：${member.status}`)
    await (agents.get(member.id) ?? seen.get(member.id))?.whenIdle()
    const link = { teamSessionId: leadId, memberName: name, sessionId: member.id }
    doc(`native-actor:${runId}:${refToString(actor)}`, 'native-actor', link)
    return link
  }
  async function send(sessionId, instructions) {
    signal.throwIfAborted()
    const lead = await ensureLead()
    const member = teams.listMembers(lead).find(row => row.id === sessionId && row.role === 'teammate')
    if (!member) throw new Error('目标不是该工作流的原生成员')
    await teams.sendMessage(lead, { target: member.name, content: [{ type: 'text', text: instructions }], signal })
    const child = agents.get(sessionId) ?? seen.get(sessionId)
    if (!child) throw new Error('原生成员消息已接受，但没有可观察的执行会话')
    return child
  }
  const update = (lead, task, action, extra = {}) => teams.updateTask(lead, { taskId: task.id, expectedRevision: task.revision, action, ...extra })
  async function beginTask(instance, message, sessionId) {
    const lead = await ensureLead()
    const key = taskKey(instance)
    const marker = `[ZCode ${runId}/${refToString(instance)}]`
    const saved = journal.getDocument(key)
    let task = saved ? teams.getTask(lead, saved.taskId) : teams.listTasks(lead).find(row => row.description.startsWith(`${marker}\n`))
    if (!task) task = await teams.createTask(lead, { subject: `ZCode ${refToString(instance)}`.slice(0, 200), description: `${marker}\n${message.instructions.slice(0, 6000)}`, blockedBy: [], writeScopes: [] })
    doc(key, 'native-task', { taskId: task.id, teamSessionId: leadId, sessionId, instance })
    const member = teams.listMembers(lead).find(row => row.id === sessionId)
    if (!member) throw new Error('节点任务缺少原生成员')
    if (task.status === 'completed') task = await update(lead, task, 'reopen')
    if (task.status === 'pending') {
      if (task.ownerName && task.ownerName !== 'lead') task = await update(lead, task, 'reassign', { owner: 'lead' })
      task = await update(lead, task, 'claim')
    }
    if (task.ownerName !== member.name) await update(lead, task, 'reassign', { owner: member.name })
  }
  async function settleTask(instance) {
    const saved = journal.getDocument(taskKey(instance))
    if (!saved || !leadHandle) return
    const lead = leadHandle.agent
    let task = teams.getTask(lead, saved.taskId)
    const node = journal.getNode(runId, instance.siteId, instance.ordinal)
    if (node?.status === 'completed') {
      if (task.status === 'pending') {
        const member = teams.listMembers(lead).find(row => row.id === saved.sessionId)
        if (task.ownerName && task.ownerName !== 'lead') task = await update(lead, task, 'reassign', { owner: 'lead' })
        task = await update(lead, task, 'claim')
        if (member) task = await update(lead, task, 'reassign', { owner: member.name })
      }
      if (task.status !== 'completed') await update(lead, task, 'complete')
    } else {
      if (task.status === 'completed') task = await update(lead, task, 'reopen')
      if (task.status === 'in_progress') await update(lead, task, 'release')
    }
  }
  async function stop() {
    if (!opening && !signal.aborted && journal.getDocument(`native-team:${runId}`)) await ensureLead()
    closed = true
    await opening?.catch(() => {})
    if (leadHandle) {
      const ids = teams.listMembers(leadHandle.agent).filter(row => row.role === 'teammate').map(row => row.id)
      await subagents.drainChildren(leadHandle.agent, ids)
    }
  }
  async function dispose() {
    try { await stop() }
    finally {
      stopCreated()
      unregister()
      await leadHandle?.dispose()
    }
  }
  function interrupt(sessionId) {
    if (leadHandle) subagents.interrupt(sessionId, { kind: 'ancestor', agent: leadHandle.agent })
  }
  return { createActor, send, beginTask, settleTask, interrupt, stop, dispose, leadId }
}
