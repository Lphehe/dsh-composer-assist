// The router must rank models on what this machine actually observed, and must
// not invent a preference when it has no data. These assertions run the real
// recorder and picker; no model is called.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createModelStats, pickRoute, median, score } from './model-stats.js'

const fast = { provider: 'p', model: 'fast' }
const slow = { provider: 'p', model: 'slow' }
const cheap = { provider: 'p', model: 'cheap' }
const pricey = { provider: 'p', model: 'pricey' }

const directory = mkdtempSync(join(tmpdir(), 'model-stats-'))
try {
  const stats = createModelStats(directory)

  // No data: the first authorised route wins, nothing is guessed.
  assert.deepEqual(pickRoute([slow, fast], { objective: 'latency', stats }), slow, 'unknown models must not be reordered')
  assert.equal(stats.scoreOf(fast, 'latency'), undefined, 'an unobserved model has no score')

  // Latency objective follows the median, not a single lucky sample.
  for (const elapsedMs of [900, 1000, 1100]) stats.observe(slow, { elapsedMs, tokens: 100, failed: false })
  for (const elapsedMs of [100, 120, 140]) stats.observe(fast, { elapsedMs, tokens: 400, failed: false })
  assert.equal(median([900, 1000, 1100]), 1000)
  assert.deepEqual(pickRoute([slow, fast], { objective: 'latency', stats }), fast, 'the faster median wins')
  assert.deepEqual(pickRoute([slow, fast], { objective: 'cost', stats }), slow, 'cost here means reported tokens, so 100 beats 400')

  // A model that keeps failing must lose even if it is quick when it works.
  for (let i = 0; i < 5; i++) stats.observe(cheap, { elapsedMs: 10, tokens: 10, failed: true })
  stats.observe(pricey, { elapsedMs: 500, tokens: 200, failed: false })
  assert.equal(score(stats.snapshot()['p/cheap'], 'balanced') > score(stats.snapshot()['p/pricey'], 'balanced'), true, 'failures must outweigh speed')

  // objective 'none' and single-candidate lists never reorder.
  assert.deepEqual(pickRoute([slow, fast], { objective: 'none', stats }), slow)
  assert.deepEqual(pickRoute([fast], { objective: 'latency', stats }), fast)

  // Observations survive a restart, so learning is not per-process only.
  // Flush first: writes are debounced, and a restart before the flush is a real
  // (bounded) loss of at most the last second of samples.
  stats.flush()
  const restored = createModelStats(directory)
  assert.deepEqual(pickRoute([slow, fast], { objective: 'latency', stats: restored }), fast, 'a restarted process keeps the observations')
  assert.equal(existsSync(join(directory, 'model-stats.json')), true)

  // The rolling window keeps the newest samples only.
  for (let i = 0; i < 60; i++) stats.observe(slow, { elapsedMs: 5, tokens: 1, failed: false })
  const bounded = stats.snapshot()['p/slow'].latencyMs
  assert.ok(bounded.length <= 40, 'latency history must stay bounded, got ' + bounded.length)

  // Stale records are pruned; fresh ones are kept.
  stats.flush()
  const raw = JSON.parse(readFileSync(join(directory, 'model-stats.json'), 'utf8'))
  assert.ok(Object.keys(raw).length > 0)
  restored.prune(Date.now() + 40 * 24 * 60 * 60 * 1000)
  assert.deepEqual(restored.snapshot(), {}, 'records older than a month are dropped')

  console.log('model routing selfcheck passed: median latency, token cost, failure penalty, persistence and bounds')
} finally {
  rmSync(directory, { recursive: true, force: true })
}
