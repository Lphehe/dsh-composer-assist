import { FACADE_DTS, SNIPPET_FACADE_DTS } from '@zcode/dynamic-workflow'
import { createWorkflowManager } from './host/manager.js'
import { createFusionDraft } from './host/fusion-template.js'

export const inject = ['tools', 'agents', 'connection', 'systemPrompt']
const API = '/api/composer-assist/workflow'
const actions = ['help', 'analyze', 'create', 'fusion_create', 'list', 'get', 'stop', 'resume', 'amend', 'save', 'list_saved', 'run_saved', 'answer', 'resolve_hold', 'fill_hole', 'nodes', 'events', 'reports']
const text = value => [{ type: 'text', text: JSON.stringify(value) }]
const response = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
})

function compact(run) {
  if (run === null || typeof run !== 'object') return run
  return Object.fromEntries(['id', 'name', 'sessionId', 'status', 'createdAt', 'updatedAt', 'error', 'result', 'questions', 'artifacts', 'holds'].filter(key => run[key] !== undefined).map(key => [key, run[key]]))
}

export async function apply(ctx) {
  const manager = await createWorkflowManager(ctx)
  const streams = new Set()
  ctx.effect(() => () => { for (const close of streams) close() }, 'dynamic-workflow: event streams')
  ctx.effect(() => () => manager.dispose(), 'dynamic-workflow: owned runs')

  async function perform(parent, input, human = false) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new Error('工作流请求必须是对象')
    const { action } = input
    if (action === 'help') return { facade: FACADE_DTS, snippetFacade: SNIPPET_FACADE_DTS, instructions: 'Write ordinary TypeScript with phase(), agent().ask<T>(), await, Promise.all and loops. create prepares a graph and script for user confirmation in the Workflow panel. It never starts agents. Resume replays completed nodes; amend imports matching predecessor results. Call get for run details. All workspace operations retain the parent permissions.' }
    if (action === 'analyze') return manager.analyze(input.script)
    if (action === 'create') return manager.prepare(parent, input)
    if (action === 'fusion_create') return manager.prepare(parent, createFusionDraft(input))
    if (action === 'launch') {
      if (!human) throw new Error('首次运行须由用户在工作流面板确认')
      return manager.launch(parent, input.id)
    }
    if (action === 'list') return { runs: await manager.list(parent) }
    if (action === 'get') return manager.get(parent, input.id)
    if (action === 'nodes') return manager.nodes(parent, input)
    if (action === 'events') return { events: await manager.events(parent, input) }
    if (action === 'reports') return manager.reports(parent, input)
    if (action === 'stop') return manager.stop(parent, input.id)
    if (action === 'resume') return manager.resume(parent, input.id)
    if (action === 'amend') return manager.amend(parent, input)
    if (action === 'save') return manager.save(parent, input)
    if (action === 'list_saved') return { workflows: await manager.listSaved(parent) }
    if (action === 'run_saved') {
      if (human) return manager.runSaved(parent, input)
      const rows = await manager.listSaved(parent)
      const saved = rows.find(row => row.name === input.name && (input.scope === undefined || row.scope === input.scope))
      if (saved === undefined) throw new Error('已保存的工作流不存在')
      return manager.prepare(parent, { ...input, script: saved.script })
    }
    if (action === 'answer') return manager.answer(parent, input)
    if (action === 'resolve_hold') {
      if (!human) throw new Error('未知副作用须由用户在工作流面板核实后处理，模型不能自行确认重试或结果')
      return manager.resolveHold(parent, input)
    }
    if (action === 'fill_hole') return manager.fillHole(parent, input)
    throw new Error(`未知工作流操作：${String(action)}`)
  }

  ctx.effect(() => ctx.tools.register({
    name: 'zcode_workflow',
    description: 'Prepare and manage ZCode TypeScript workflows. fusion_create prepares a bounded Lead/Sidekick/Reviewer repair loop; first launch still needs confirmation. Call action=help for the script API.',
    parameters: {
      type: 'object', additionalProperties: false, required: ['action'],
      properties: {
        action: { type: 'string', enum: actions },
        id: { type: 'string', description: 'Run id returned by create or list.' },
        script: { type: 'string', description: 'TypeScript function body; phase markers are required by the upstream compiler.' },
        task: { type: 'string', description: 'Fusion task, only used by fusion_create (up to 12,000 chars).' },
        leadModel: { type: 'string', description: 'Optional Fusion Lead model; must be session-approved.' },
        sidekickModel: { type: 'string', description: 'Optional Fusion Sidekick model; must be session-approved.' },
        reviewModel: { type: 'string', description: 'Optional Fusion Reviewer model; must be session-approved.' },
        maxRounds: { type: 'integer', minimum: 1, maximum: 3, description: 'Bounded Fusion review/fix rounds (default 2).' },
        testScript: { type: 'string', description: 'pnpm script name executed as pnpm run <name> (default selfcheck).' },
        timeoutMs: { type: 'integer', minimum: 1000, maximum: 300000, description: 'Time limit per test run.' },
        name: { type: 'string', description: 'Workflow name, or saved workflow to run.' },
        args: { type: 'object', additionalProperties: true, description: 'JSON arguments exposed as args in the script.' },
        concurrency: { type: 'integer', minimum: 1, maximum: 64 },
        provider: { type: 'string' }, model: { type: 'string' },
        routing: { type: 'string', enum: ['none', 'latency', 'cost', 'balanced'], description: 'How to pick among the session-approved subagent models once this machine has observed them: fastest median latency, fewest reported tokens, a blend that also penalises failures, or none to keep the first approved route.' },
        scope: { type: 'string', enum: ['project', 'global'] },
        questionId: { type: 'string' }, answer: { type: 'string' },
        holeId: { type: 'string' }, body: { type: 'string', description: 'TypeScript code body to fill an open workflow hole.' },
        nodeId: { type: 'string' },
        artifactId: { type: 'string' }, after: { type: 'integer', minimum: 0 }, afterSequence: { type: 'integer', minimum: -1 }, limit: { type: 'integer', minimum: 1, maximum: 1000 }, resolution: { type: 'string', enum: ['retry', 'accept'] },
        value: { description: 'Verified interrupted-node result. Unknown-effect decisions require human confirmation in the Workflow panel; the model cannot resolve them.' },
      },
    },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_, value) => text(value) },
    async execute(input, exec) {
      if (exec.agent === undefined) throw new Error('工作流需要当前会话')
      const value = await perform(exec.agent, input)
      return ['create', 'fusion_create', 'resume', 'amend', 'stop', 'run_saved'].includes(input.action) ? compact(value) : value
    },
  }), 'dynamic-workflow: model tool')

  if (ctx.get('systemPrompt') !== undefined) ctx.effect(() => ctx.systemPrompt.section({
    name: 'composer-assist-dynamic-workflows', order: 71,
    text: 'Use zcode_workflow only when the user explicitly requests a workflow. Call action=help before authoring. First launch and unknown-effect decisions require human confirmation in the Workflow panel.',
  }), 'dynamic-workflow: discovery')

  const parentFor = id => {
    if (typeof id !== 'string' || id === '') throw new Error('缺少会话标识')
    const parent = ctx.agents.get(id)
    if (parent === undefined) throw new Error('请先打开该会话，再管理它的工作流')
    return parent
  }
  ctx.effect(() => ctx.connection.fetch.register({
    path: `${API}/state`, methods: ['GET'], requestBody: 'buffered',
    async fetch(request) {
      try {
        const url = new URL(request.url)
        const parent = parentFor(url.searchParams.get('sessionId'))
        const id = url.searchParams.get('id')
        return response(200, { ok: true, value: id === null ? {
          runs: await manager.list(parent), workflows: await manager.listSaved(parent),
          modelRoutes: parent.ctx.get('subagentModelSelection')?.current()?.enabled === true ? parent.ctx.get('subagentModelSelection').current().allowedModels : [],
        } : await manager.get(parent, id) })
      } catch (error) { return response(400, { ok: false, error: error.message }) }
    },
  }), 'dynamic-workflow: state')
  ctx.effect(() => ctx.connection.fetch.register({
    path: `${API}/action`, methods: ['POST'], requestBody: 'buffered',
    async fetch(request) {
      try {
        const raw = await request.text()
        if (raw.length > 512_000) throw new Error('工作流请求过大')
        const input = JSON.parse(raw)
        const value = await perform(parentFor(input.sessionId), input, true)
        return response(200, { ok: true, value })
      } catch (error) { return response(400, { ok: false, error: error.message }) }
    },
  }), 'dynamic-workflow: actions')
  ctx.effect(() => ctx.connection.fetch.register({
    path: `${API}/artifact`, methods: ['GET'], requestBody: 'buffered',
    async fetch(request) {
      try {
        const url = new URL(request.url)
        const parent = parentFor(url.searchParams.get('sessionId'))
        const version = Number(url.searchParams.get('version'))
        if (!Number.isSafeInteger(version) || version < 1) throw new Error('产物版本无效')
        const artifact = await manager.getArtifact(parent, { id: url.searchParams.get('id'), artifactId: url.searchParams.get('artifactId'), version })
        const filename = encodeURIComponent(artifact.record.sourcePath?.split('/').at(-1) ?? `${artifact.record.id}${artifact.record.kind === 'markdown' ? '.md' : ''}`)
        return new Response(artifact.bytes, { headers: {
          'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename*=UTF-8''${filename}`,
          'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox", 'cache-control': 'no-store',
        } })
      } catch (error) { return response(400, { ok: false, error: error.message }) }
    },
  }), 'dynamic-workflow: artifact downloads')
  ctx.effect(() => ctx.connection.fetch.register({
    path: `${API}/events`, methods: ['GET'], requestBody: 'buffered',
    async fetch(request) {
      try {
        const parent = parentFor(new URL(request.url).searchParams.get('sessionId'))
        const encoder = new TextEncoder()
        let release = () => {}
        const stream = new ReadableStream({
          start(controller) {
            let closed = false
            const send = value => {
              if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`))
            }
            const unsubscribe = manager.subscribe(event => {
              if (event.sessionId === parent.id) send(event)
            })
            release = () => {
              if (closed) return
              closed = true
              unsubscribe()
              streams.delete(release)
              request.signal.removeEventListener('abort', release)
              try { controller.close() } catch {}
            }
            streams.add(release)
            request.signal.addEventListener('abort', release, { once: true })
            if (request.signal.aborted) release()
            send({ connected: true })
            if (request.signal.aborted) release()
          },
          cancel() { release() },
        })
        return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'x-accel-buffering': 'no' } })
      } catch (error) { return response(400, { ok: false, error: error.message }) }
    },
  }), 'dynamic-workflow: event stream')
}
