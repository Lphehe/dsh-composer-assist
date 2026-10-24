import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { WORLD_READ_CAPS } from '@zcode/dynamic-workflow'
import { createWorld } from './world.js'

async function scenario(mode, invoke) {
  const abort = new AbortController()
  const hooks = new Map()
  const effects = new Map()
  const calls = []
  let killed = 0
  let waited = 0
  const parent = { id: 'owner', session: { header: { cwd: tmpdir() } } }
  const journal = { getEffect: id => effects.get(id), putEffect: value => effects.set(value.id, value) }
  const ctx = {
    get(name) { return ctx[name] },
    on(name, handler, options) { assert.equal(name, 'tools/post-execute'); assert.equal(options.prepend, true); hooks.set(name, handler); return () => hooks.delete(name) },
    fs: {
      async resolve(path) { return { targetKey: path } },
      async readBytes(target, _signal, maxBytes) { assert.equal(target.targetKey, '/trusted/native-spill'); assert.equal(maxBytes, WORLD_READ_CAPS.runStdoutMaxBytes); if (mode === 'oversize') throw Object.assign(new Error('too large'), { code: 'FS_TOO_LARGE' }); return Buffer.from('x'.repeat(100000)) },
    },
    shell: { resolve() { throw new Error('world.run bypassed the real tool pipeline') } },
    jobs: {
      get(id, owner) { assert.equal(id, 'owned-job'); assert.equal(owner, parent.id); return { id, status: 'running' } },
      kill(id, owner) { assert.equal(id, 'owned-job'); assert.equal(owner, parent.id); killed++; return 'requested' },
      async wait(...args) { assert.deepEqual(args, ['owned-job', 5000, parent.id], 'cleanup wait must not inherit the aborted caller signal'); waited++; return { status: mode === 'unsettled' ? 'stopping' : 'killed' } },
    },
    tools: { async execute(exec) {
      calls.push(exec)
      assert.equal(exec.name, 'bash')
      assert.equal(exec.agent, parent)
      assert.equal(exec.arguments.run_in_background, false)
      assert.equal(typeof exec.callId, 'string')
      let result
      if (mode === 'denied') result = { isError: true, error: { message: 'guard denied' }, content: [] }
      else if (['promoted', 'late-abort', 'unsettled'].includes(mode)) result = { isError: false, value: { kind: 'promoted', jobId: 'owned-job', cwd: tmpdir(), timeoutMs: 10, output: 'tail' }, content: [] }
      else {
        const actual = mode === 'quote' ? execFileSync('bash', ['-c', exec.arguments.command], { encoding: 'utf8', timeout: 1000 }) : 'ok'
        result = { isError: false, value: { kind: 'foreground', cwd: tmpdir(), exitCode: 7, signal: null, timedOut: false, aborted: false, timeoutMs: 10, stdout: { text: actual, truncated: ['spill', 'oversize', 'missing-spill'].includes(mode), ...(['spill', 'oversize'].includes(mode) ? { spillPath: '/trusted/native-spill' } : {}) }, stderr: { text: '', truncated: false } }, content: [] }
      }
      await hooks.get('tools/post-execute')(exec, result, async () => ({ kind: 'accept' }))
      if (mode === 'late-abort') { abort.abort(); return { isError: true, error: { message: 'aborted after promotion' }, content: [] } }
      return result
    } },
  }
  parent.ctx = ctx
  const world = createWorld(parent, { journal, runId: 'test', signal: abort.signal, effect: () => { const row = { id: 'effect', runId: 'test', state: 'pending' }; effects.set(row.id, row); return row }, completeEffect: (id, value, error) => effects.set(id, { ...effects.get(id), state: error ? 'unknown' : 'settled', value }) })
  await invoke(world, effects)
  assert.equal(hooks.size, 0, 'temporary native-result observer must be removed')
  if (['promoted', 'late-abort', 'unsettled'].includes(mode)) { assert.equal(killed, 1); assert.equal(waited, 1) }
  else { assert.equal(killed, 0); assert.equal(waited, 0) }
  assert.equal(calls.length, 1, 'failed or uncertain effects must never be retried')
}
await scenario('foreground', async (world, effects) => { const result = await world.execute('run', ['printf', ['ok']]); assert.deepEqual(result, { exitCode: 7, stdout: 'ok', stderr: '' }); assert.equal(effects.get('effect').state, 'settled') })
await scenario('quote', async world => { const literal = "quote' backtick`echo injected` dollar$(printf injected)"; assert.equal((await world.execute('run', ['printf', ['%s', literal]])).stdout, literal) })
await scenario('denied', async (world, effects) => { await assert.rejects(world.execute('run', ['printf', ['ok']]), /guard denied/); assert.equal(effects.get('effect').state, 'unknown') })
for (const mode of ['promoted', 'late-abort', 'unsettled']) await scenario(mode, async (world, effects) => { await assert.rejects(world.execute('run', ['printf', ['ok']]), /未知|核对/); assert.equal(effects.get('effect').state, 'unknown'); assert.equal(effects.get('effect').native.jobId, 'owned-job') })
await scenario('spill', async (world, effects) => { assert.equal((await world.execute('run', ['printf', ['ok']])).stdout.length, 100000); assert.equal(effects.get('effect').native.stdout.truncated, true) })
for (const mode of ['oversize', 'missing-spill']) await scenario(mode, async world => { await assert.rejects(world.execute('run', ['printf', ['ok']]), error => error.code === 'WorldReadCapExceeded') })
console.log('world selfcheck passed: native guards, quoting, late-abort job cleanup, bounded complete spill recovery, no retries')
