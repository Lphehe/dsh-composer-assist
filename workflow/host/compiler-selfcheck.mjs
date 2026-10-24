import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { createCompilerScope, __test } from './compile.js'

const compiler = createCompilerScope()
const script = 'phase("Test"); const actor=agent("worker"); return await actor.ask<{ok:boolean}>("reply");'
const timer = delay(0, 'responsive')
const first = compiler.compile(script)
assert.equal(compiler.compile(script), first, 'same-script requests share the bounded compile')
assert.equal(await Promise.race([timer, first.then(() => 'compiled')]), 'responsive', 'analysis must not block the Host event loop')
const compiled = await first
assert.equal(compiled.analysis.ok, true)
assert.ok(compiled.askSpecs instanceof Map)
assert.ok(compiled.sitePhases instanceof Map)
assert.equal(compiled.table, undefined, 'compiler AST never crosses the worker boundary')
assert.deepEqual(compiled.analysis.schemas['ask#1'].required, ['ok'])
assert.equal((await compiler.compile('const = ???')).analysis.ok, false)
await assert.rejects(__test.runWorker({ kind: 'compile', script }, new AbortController().signal, 1), error => error.code === 'WorkflowAnalysisLimit')
await compiler.dispose()
const cancelled = createCompilerScope()
const pending = cancelled.compile('return 2;')
pending.catch(() => {})
await delay(10)
await cancelled.dispose()
await assert.rejects(pending, /关闭/)
console.log('compiler selfcheck passed: responsive Host, cloned Maps, bounded timeout, dispose cancellation')
