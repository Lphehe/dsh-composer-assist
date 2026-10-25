import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../plugin.js'
import { createCompilerScope } from './compile.js'
import { checkExecutionCapabilities } from './manager.js'
assert.throws(() => checkExecutionCapabilities({ ctx: { get: () => undefined } }), /缺少工作流执行能力/)
assert.throws(() => checkExecutionCapabilities({ ctx: { get: () => ({ schemas: () => [{ name: 'run_code' }] }) } }, 'fusion.v1'), /原生工具模式/)
assert.doesNotThrow(() => checkExecutionCapabilities({ ctx: { get: () => ({ schemas: () => [{ name: 'run_code' }] }) } }))
assert.doesNotThrow(() => checkExecutionCapabilities({ ctx: { get: () => ({ schemas: () => [{ name: 'bash' }] }) } }))
import { graphModel, graphEdgePoints, nodeState, phaseModel } from '../client/graph.js'

const separate = (a, b) => a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y
function checkRoutes(model, kind) {
  const onBoundary = (point, node) => (point[0] === node.x || point[0] === node.x + node.width) && point[1] >= node.y && point[1] <= node.y + node.height || (point[1] === node.y || point[1] === node.y + node.height) && point[0] >= node.x && point[0] <= node.x + node.width
  for (const edge of model.edges) {
    const points = graphEdgePoints(model, edge)
    const from = model.nodes.find(node => node.id === edge.from), to = model.nodes.find(node => node.id === edge.to)
    assert.ok(points.length >= 2 && points.every(point => point.every(Number.isFinite)), `${kind}: every real edge has a finite path`)
    assert.ok(onBoundary(points[0], from) && onBoundary(points.at(-1), to), `${kind}: ordered endpoint ports stay on their own cards`)
    for (let i = 1; i < points.length; i++) {
      const a = points[i-1], b = points[i]
      assert.ok(a[0] === b[0] || a[1] === b[1], `${kind}: route segments are axis-aligned`)
      for (const node of model.nodes.filter(node => node !== from && node !== to)) {
        const crosses = a[0] === b[0] ? a[0] > node.x && a[0] < node.x + node.width && Math.max(a[1], b[1]) > node.y && Math.min(a[1], b[1]) < node.y + node.height : a[1] > node.y && a[1] < node.y + node.height && Math.max(a[0], b[0]) > node.x && Math.min(a[0], b[0]) < node.x + node.width
        assert.equal(crosses, false, `${kind}: ${edge.from}→${edge.to} does not pass through ${node.id}`)
      }
    }
  }
  for (const node of model.nodes) {
    const outgoing = model.edges.filter(edge => edge.from === node.id).map(edge => graphEdgePoints(model, edge)[0].join(','))
    const incoming = model.edges.filter(edge => edge.to === node.id).map(edge => graphEdgePoints(model, edge).at(-1).join(','))
    assert.equal(new Set(outgoing).size, outgoing.length, `${kind}: distinct outgoing ports`)
    assert.equal(new Set(incoming).size, incoming.length, `${kind}: distinct incoming ports`)
  }
}

const directory = await mkdtemp(join(tmpdir(), 'workflow-plugin-check-'))
process.env.DSH_HOME = directory
const disposers = []
let tool
let discovery
const routes = new Map()
let selection = { enabled: false, allowedModels: [{ provider: 'old', model: 'retained' }] }
const parent = { id: 'plugin-check', session: { header: { cwd: directory } }, ctx: { get: name => name === 'subagentModelSelection' ? { current: () => selection } : undefined } }
const ctx = {
  agents: { get: id => id === parent.id ? parent : undefined },
  tools: { register: definition => { tool = definition; return () => {} } },
  connection: { fetch: { register: route => { routes.set(route.path, route); return () => {} } } },
  systemPrompt: { section: definition => { discovery = definition; return () => {} } },
  get: name => name === 'systemPrompt' ? ctx.systemPrompt : undefined,
  effect(factory) { const dispose = factory(); disposers.push(dispose); return dispose },
}
await apply(ctx)
try {
  const state = () => routes.get('/api/composer-assist/workflow/state').fetch(new Request('http://localhost/api/composer-assist/workflow/state?sessionId=plugin-check')).then(response => response.json())
  assert.deepEqual((await state()).value.modelRoutes, [])
  selection = { ...selection, enabled: true }
  assert.deepEqual((await state()).value.modelRoutes, selection.allowedModels)
  assert.equal(tool.deferLoading, undefined, 'do not send an unsupported provider-specific defer flag')
  assert.match(tool.description, /action=help/)
  assert.match(discovery.text, /only when the user explicitly requests a workflow/)
  assert.match(discovery.text, /action=help before authoring/)
  assert.match(discovery.text, /First launch and unknown-effect decisions require human confirmation in the Workflow panel/)
  assert.equal(tool.parameters.properties.action.enum.includes('launch'), false, 'first launch is not a model action')
  await assert.rejects(tool.execute({ action: 'launch', id: 'unknown' }, { agent: parent }), /须由用户/)
  await assert.rejects(tool.execute({ action: 'resolve_hold', id: 'unknown', nodeId: 'unknown', resolution: 'retry' }, { agent: parent }), /须由用户/)
  const help = await tool.execute({ action: 'help', name: '__integration_probe__' }, { agent: parent })
  assert.equal(typeof help.facade, 'string', 'old probe name must only return ordinary help')
  assert.equal(help.directory, undefined, 'no hidden diagnostic execution')
} finally {
  for (const dispose of disposers.reverse()) await dispose?.()
}

const compiler = createCompilerScope()
try {
  const { analysis } = await compiler.requireCompiled('phase("Review"); const a=agent("A"); const b=agent("B"); const result=await Promise.all([a.ask("one"), b.ask("two")]); const checked=await Promise.all([a.ask("three " + JSON.stringify(result)), b.ask("four " + JSON.stringify(result))]); phase("Deliver"); return await b.ask("review " + JSON.stringify(checked));')
  for (const kind of ['graph', 'causality', 'flow', 'handoff']) {
    const model = graphModel(analysis, kind)
    assert.ok(model.nodes.length > 0, kind)
    if (kind === 'graph' || kind === 'causality') assert.deepEqual(model.nodes.filter(node => node.kind === 'ask').map(node => node.label), ['A', 'B', 'A', 'B', 'B'], `${kind}: show actor names, not compiler variable aliases`)
    if (kind === 'graph' || kind === 'causality') {
      assert.deepEqual((model.groups ?? []).map(group => group.label), ['Review', 'Deliver'], `${kind}: real phase regions must be visible`)
      assert.deepEqual(model.groups.map(group => group.taskCount), [4, 1], `${kind}: count tasks, not structural vertices`)
      const wide = graphModel(analysis, kind, 1600)
      assert.equal(wide.groups[0].y, wide.groups[1].y, `${kind}: intrinsic phase bands fit side by side at 1600px`)
      assert.ok(wide.groups[0].x + wide.groups[0].width < wide.groups[1].x, `${kind}: distinct bands retain a gutter`)
      for (const group of model.groups) {
        for (const node of model.nodes.filter(node => node.layoutPhase === group.id)) {
          assert.ok(group.sites.some(site => node.sites.includes(site)))
          assert.ok(node.x >= group.x && node.y >= group.y, `${kind}: node begins inside its phase`)
          assert.ok(node.x + node.width <= group.x + group.width && node.y + node.height <= group.y + group.height, `${kind}: node fits inside its phase`)
        }
      }
      for (let i = 0; i < model.groups.length; i++) for (const other of model.groups.slice(i + 1)) assert.ok(separate(model.groups[i], other), `${kind}: phase regions do not overlap`)
      checkRoutes(wide, `${kind}/1600`)
    }
    for (const node of model.nodes) {
      const structural = ['source','sink','join','fan-out','mark','entry','abort','test'].includes(node.kind ?? node.id)
      assert.equal(node.structural, structural, `${kind}: structural vertices are not execution tasks`)
      assert.equal(node.width, structural ? 88 : 248)
      assert.equal(node.height, structural ? 32 : 112)
      assert.ok(Array.isArray(node.actorIds))
    }
    const narrow = graphModel(analysis, kind, 640)
    assert.ok(narrow.width <= 640, `${kind}: layout fits the available width without tiny text`)
    checkRoutes(narrow, `${kind}/640`)
    checkRoutes(model, `${kind}/natural`)
    for (const node of narrow.nodes) assert.equal(node.phase, model.nodes.find(original => original.id === node.id).phase, `${kind}: layout does not change execution phase`)
    for (let i = 0; i < narrow.nodes.length; i++) for (const other of narrow.nodes.slice(i + 1)) {
      const node = narrow.nodes[i]
      assert.ok(node.x + node.width <= other.x || other.x + other.width <= node.x || node.y + node.height <= other.y || other.y + other.height <= node.y, `${kind}: narrow node boxes do not overlap`)
    }
    if (kind === 'graph') {
      const join = model.nodes.find(node => node.kind === 'join')
      assert.ok(join, 'real Promise.all creates an upstream join')
      assert.equal(join.phase, undefined, 'layout inference must not invent a semantic phase')
      assert.equal(join.layoutPhase, analysis.causality.phases[0].id)
    }
    const ids = new Set(model.nodes.map(node => node.id))
    for (const edge of model.edges) assert.ok(ids.has(edge.from) && ids.has(edge.to), kind)
    for (const node of model.nodes) assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y), kind)
    const edges = analysis[kind].edges ?? analysis[kind].handoffs
    assert.equal(model.edges.length, edges.length, `${kind}: do not silently drop upstream edges`)
  }
  const { analysis: cyclic } = await compiler.requireCompiled('const a=agent("Loop A"); const b=agent("Loop B"); phase("Repeat"); let value="start"; for(let round=0;round<2;round++){ value=await a.ask(value); value=await b.ask(value); } return value;')
  let selfEdges = 0
  for (const kind of ['graph', 'causality', 'flow', 'handoff']) {
    const model = graphModel(cyclic, kind, 640)
    checkRoutes(model, `${kind}/cycle`)
    selfEdges += model.edges.filter(edge => edge.from === edge.to).length
    assert.equal(model.edges.length, (cyclic[kind].edges ?? cyclic[kind].handoffs).length, `${kind}: keep cyclic edges`)
  }
  assert.ok(selfEdges > 0, 'the real loop exercises self-edge routing')
  const phases = phaseModel({ analysis, events: [{ event: { type: 'node-queued', instance: { siteId: 'ask#1', ordinal: 1 }, instructionsHead: 'one' } }] })
  assert.deepEqual(phases.flatMap(phase => phase.tasks.map(task => task.label)), ['A', 'B', 'A', 'B', 'B'], 'timeline uses the same actor identities as the graph')
  assert.equal(phases[0].tasks[0].instruction, 'one', 'show the recorded task instruction')
  assert.equal(phases.flatMap(phase => phase.tasks)[1].instruction, '', 'do not invent an instruction when no event is retained')
  assert.equal(nodeState([{ siteId: 'ask#1', status: 'completed' }, { siteId: 'ask#1', status: 'running' }], 'ask#1'), 'running')
  assert.equal(nodeState([{ siteId: 'ask#1', status: 'completed' }], 'ask#1'), 'completed')
  assert.equal(nodeState([{ siteId: 'ask#1', status: 'cancelled' }], 'ask#1'), 'cancelled')
  assert.equal(nodeState([{ siteId: 'ask#1', status: 'stopped' }], 'ask#1'), 'stopped')
  assert.equal(phaseModel({ analysis, siteStates: [{ siteId: 'ask#1', status: 'stopped' }] })[0].status, 'stopped')
  assert.equal(nodeState([{ siteId: 'ask#1', status: 'cancelled' }, { siteId: 'ask#1', status: 'running' }], 'ask#1'), 'running')
  assert.equal(nodeState([{ siteId: 'ask#1', status: 'completed' }, { siteId: 'ask#1', status: 'cancelled' }], 'ask#1'), 'cancelled')
} finally { await compiler.dispose() }
console.log('Plugin selfcheck passed: human-only unknown resolution, no hidden probe, four genuine graphs and instance status')
