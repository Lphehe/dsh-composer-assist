import assert from 'node:assert/strict'
import ts from 'typescript'
import { createFusionDraft } from './fusion-template.js'

const test = createFusionDraft({ task: '修复订单处理中的空指针', testScript: 'selfcheck' })
assert.equal(test.name, 'Fusion · 协作修复')
assert.deepEqual(test.args, {
  preset: 'fusion.v1',
  task: '修复订单处理中的空指针',
  maxRounds: 2,
  testScript: 'selfcheck',
  timeoutMs: 180000,
  models: { lead: null, sidekick: null, reviewer: null },
})
assert.equal(test.concurrency, 3)
for (const role of ['Fusion Lead', 'Fusion Sidekick', 'Fusion Reviewer']) {
  assert(test.script.includes('agent("' + role + '"'), role + ' should be an independent session')
}
assert(test.script.includes('lastTest.exitCode === 0'), 'a review vote must not override failing tests')
assert(test.script.includes('lastReview.blockingIssues.length === 0'), 'blocking review findings cannot be ignored')
assert(test.script.includes('await git.diff()'), 'reviewer must receive real diff evidence')
assert(test.script.includes('attempt <= cfg.maxRounds'), 'loop must be bounded')
assert(test.script.includes('await world.run("pnpm"'), 'tests must be run by the native DSH world tool')
assert(!test.script.includes('修复订单处理中的空指针'), 'task content must not be injected into source')

// Quoted or code-shaped input cannot escape JSON arguments into the script.
const injection = '"; await world.run("bash", ["-c", "touch /tmp/bad"]); //'
const distinct = createFusionDraft({
  task: injection, maxRounds: 3, testScript: 'test:unit',
  leadModel: 'provider/strong', sidekickModel: 'provider/fast', reviewModel: 'provider/audit',
})
assert.equal(distinct.args.task, injection)
assert(!distinct.script.includes(injection))
for (const name of ['provider/strong', 'provider/fast', 'provider/audit']) {
  assert(distinct.script.includes('"model": ' + JSON.stringify(name)) === false, 'models are persona options, not injected JSON data')
  assert(distinct.script.includes('model: "' + name + '"'))
}
assert.equal(distinct.args.maxRounds, 3)
assert.equal(distinct.args.testScript, 'test:unit')
assert.deepEqual(distinct.args.models, { lead: 'provider/strong', sidekick: 'provider/fast', reviewer: 'provider/audit' })

// Syntax-only TS check, without a model call or a DSH host.
const result = ts.transpileModule(distinct.script, {
  fileName: 'fusion-recipe.ts',
  reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
})
assert.equal((result.diagnostics ?? []).filter(row => row.category === ts.DiagnosticCategory.Error).length, 0)

const invalid = [
  {}, { task: '' }, { task: 'x'.repeat(12001) }, { task: 'x', maxRounds: 0 },
  { task: 'x', maxRounds: 4 }, { task: 'x', maxRounds: 1.5 },
  { task: 'x', testScript: 'foo; echo unsafe' },
  { task: 'x', testScript: '--eval' },
  { task: 'x', timeoutMs: 0 },
  { task: 'x', leadModel: 'line\nbreak' },
]
for (const input of invalid) assert.throws(() => createFusionDraft(input), undefined, JSON.stringify(input).slice(0, 100))
assert.throws(() => createFusionDraft(null))
console.log('Fusion template selfcheck passed')
