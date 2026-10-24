import assert from 'node:assert/strict'
import { WORKFLOW_VIEW_ID, workflowSelection, workflowEditorState } from './navigation.js'
import { installWorkflowUI } from './ui.js'
import { actorBadge } from './graph.js'

const actorOne = actorBadge({ siteId: 'actor#1', name: '原生验收甲' })
const actorTwo = actorBadge({ siteId: 'actor#2', name: '原生验收乙' })
assert.equal(actorOne.initial, 'A1')
assert.equal(actorTwo.initial, 'A2')
assert.notEqual(actorOne.color, actorTwo.color)
assert.ok([0, 1, 2].includes(actorOne.color))
assert.deepEqual(actorBadge({ siteId: 'actor#1', name: '另一个显示名称', ordinal: 9 }), actorOne, 'badge identity is independent of list position, display name and instance ordinal')

assert.deepEqual(workflowSelection(null, [{ id: 'latest' }]), { runId: 'latest', view: 'overview' })
assert.deepEqual(workflowSelection(null, []), { runId: null, view: 'overview' })
const explicitNew = { runId: null, view: 'timeline' }
assert.equal(workflowSelection(explicitNew, [{ id: 'latest' }]), explicitNew)
const older = { runId: 'outside-latest-100', view: 'details' }
assert.equal(workflowSelection(older, [{ id: 'latest' }]), older)

const draft = { script: 'unsaved edit', argsText: '{"keep":true}', tab: 'results' }
const { key } = workflowEditorState(undefined, 'run:a')
const cached = { key, draft }
assert.equal(workflowEditorState(cached, 'run:a').draft, draft)
assert.equal(workflowEditorState(cached, 'run:b').draft, null)
assert.equal(workflowEditorState(cached, null).draft, null)
const saved = { scope: 'project', name: 'saved:a' }
const savedCache = { key: workflowEditorState(null, null, saved).key, draft }
assert.equal(workflowEditorState(savedCache, null, saved).draft, draft)
assert.equal(workflowEditorState(savedCache, null, { ...saved, scope: 'global' }).draft, null)
const sessions = new Map([['parent:a', cached]])
assert.equal(workflowEditorState(sessions.get('parent:b'), 'run:a').draft, null)

const registrations = [], disposers = []
const ctx = {
  locale: { register: () => () => {}, bind: () => key => key },
  effect: effect => { const dispose = effect(); if (typeof dispose === 'function') disposers.push(dispose); return dispose },
  slots: {
    inject: (_name, effect) => effect(),
    register: (options, component) => { registrations.push({ options, component }); return () => {} },
  },
}
const React = { createElement: (type, props, ...children) => ({ type, props, children }) }
installWorkflowUI(ctx, React)
assert.deepEqual(registrations.map(row => row.options.name), ['conversation.view', 'tool.call.toolview'])
const main = registrations[0]
assert.equal(main.options.id, WORKFLOW_VIEW_ID)
assert.equal(main.options.order, 25)
assert.equal(main.options.label(), 'mainTitle')
assert.notEqual(main.component({ sessionId: 'parent:a' }).props.key, main.component({ sessionId: 'parent:b' }).props.key)
for (const dispose of disposers.reverse()) dispose()
console.log('Workflow main view, session isolation and draft selfcheck passed')
