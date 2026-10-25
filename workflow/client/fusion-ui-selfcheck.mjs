import assert from 'node:assert/strict'
import { createFusionView } from './fusion.js'

let hooks = [], cursor = 0
const React = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  useState(initial) {
    const index = cursor++
    if (!(index in hooks)) hooks[index] = initial
    return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value }]
  },
}
const h = React.createElement
const button = (label, onClick, disabled, primary) => h('button', { onClick, disabled, primary }, label)
const view = createFusionView(React, { t: key => key, button })
const flatten = node => {
  if (Array.isArray(node)) return node.flatMap(flatten)
  if (!node || typeof node !== 'object') return []
  return [node, ...(node.children ?? []).flatMap(flatten)]
}
const render = props => { cursor = 0; return view.FusionComposer(props) }
const controls = tree => flatten(tree).filter(row => ['input', 'select', 'textarea', 'button'].includes(row.type))
const control = (tree, id) => {
  const found = controls(tree).find(row => row.props.id === id)
  assert(found, 'missing visible field ' + id)
  return found
}
const actionButton = tree => controls(tree).find(row => row.type === 'button' && (row.children.includes('fusionCreateDraft') || row.children.includes('loading')))

let captured
const props = {
  modelRoutes: [{ provider: 'a', model: 'lead' }, { provider: 'b', model: 'builder' }, { provider: 'c', model: 'reviewer' }],
  onCreate: async payload => { captured = payload; return { id: 'draft:1' } },
}
let tree = render(props)
assert(flatten(tree).some(row => row.props['data-fusion-composer'] === ''))
assert.equal(actionButton(tree).props.disabled, true, 'empty task must not create a draft')
control(tree, 'fusion-task').props.onChange({ target: { value: '修复订单 Bug' } })
tree = render(props)
assert.equal(actionButton(tree).props.disabled, false)
control(tree, 'fusion-model-lead').props.onChange({ target: { value: 'a/lead' } })
control(tree, 'fusion-model-sidekick').props.onChange({ target: { value: 'b/builder' } })
control(tree, 'fusion-model-reviewer').props.onChange({ target: { value: 'c/reviewer' } })
control(tree, 'fusion-rounds').props.onChange({ target: { value: '3' } })
tree = render(props)
await actionButton(tree).props.onClick()
assert.deepEqual(captured, {
  action: 'fusion_create', task: '修复订单 Bug', maxRounds: 3, testScript: 'selfcheck',
  leadModel: 'a/lead', sidekickModel: 'b/builder', reviewModel: 'c/reviewer',
})
control(tree, 'fusion-test').props.onChange({ target: { value: 'test;unsafe' } })
tree = render(props)
assert.equal(actionButton(tree).props.disabled, true, 'invalid script must not be submitted')
tree = render({ ...props, busy: true })
assert.equal(actionButton(tree).props.disabled, true, 'pending request must disable launch')

const run = {
  status: 'completed',
  args: { preset: 'fusion.v1', task: 'Fix calculation', maxRounds: 2 },
  result: { rounds: 2, success: false, test: { exitCode: 1 }, review: { approved: false, blockingIssues: ['Test failed'] } },
}
const summary = view.FusionSummary({ run, onDetails: () => {} })
const nodes = flatten(summary)
assert(nodes.some(row => row.props['data-fusion-summary'] === ''))
assert(nodes.some(row => row.type === 'li' && row.children.includes('Test failed')))
// Even if a model votes approved, unresolved issues must block the UI approval.
const contradictory = view.FusionSummary({ run: { ...run, result: { ...run.result, review: { approved: true, blockingIssues: ['Still failing'] } } }, onDetails: () => {} })
assert(flatten(contradictory).some(row => row.type === 'span' && row.children.includes('fusionReviewFail')), 'blocking issues must override an LLM approval vote')
assert(nodes.some(row => row.type === 'button' && row.children.includes('fusionInspect')))
assert.equal(view.FusionSummary({ run: { args: {} } }), null)
const live = view.FusionSummary({ run: { ...run, status: 'stopped', result: undefined, reports: [{ item: { preset: 'fusion.v1', rounds: 1, test: { exitCode: 1 }, review: { approved: false, blockingIssues: ['Real test failure'] } } }] }, onDetails: () => {} })
assert(flatten(live).some(row => row.type === 'li' && row.children.includes('Real test failure')))
assert(flatten(live).some(row => row.type === 'span' && row.children.includes('fusionTestFail (1)')))
let draft
hooks = []; cursor = 0
tree = render({ ...props, draft, onDraftChange: update => { draft = update(draft) } })
control(tree, 'fusion-task').props.onChange({ target: { value: 'Keep this task' } })
hooks = []
tree = render({ ...props, draft })
assert.equal(control(tree, 'fusion-task').props.value, 'Keep this task')
console.log('Fusion workflow UI interaction selfcheck passed')
