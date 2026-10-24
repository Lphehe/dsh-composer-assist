import { join } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'

/**
 * Observed model performance, used to pick a route when several are authorised.
 *
 * Only facts this process actually saw are recorded: elapsed milliseconds, the
 * token count the provider reported, and whether the request failed. There is no
 * price table, so "cost" here is tokens spent, never invented currency.
 *
 * Records are kept per provider/model in one small JSON file so a choice made in
 * one run informs the next. Persistence is best-effort: an unreadable or
 * unwritable store degrades to in-memory learning instead of failing a run.
 */

const SAMPLE_LIMIT = 40
const STALE_MS = 30 * 24 * 60 * 60 * 1000

const empty = () => ({ latencyMs: [], tokens: 0, samples: 0, failures: 0, updatedAt: 0 })

/** Trim to a rolling window so an old slow patch cannot pin a model forever. */
function trim(samples) {
  return samples.slice(-SAMPLE_LIMIT)
}

export function median(values) {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/**
 * Score a route for the given objective. Lower is better; undefined means
 * "never observed", which callers treat as unknown rather than best or worst.
 */
export function score(entry, objective) {
  // A model seen only through failures has samples === 0 but is emphatically not
  // "unknown": it must score worse than a healthy one, never fall through to the
  // first-candidate default.
  if (!entry || (entry.samples === 0 && entry.failures === 0)) return undefined
  const latency = median(entry.latencyMs)
  // samples can be 0 (every attempt failed); dividing by it would poison every
  // comparison with NaN.
  const perCall = entry.samples === 0 ? Number.POSITIVE_INFINITY : entry.tokens / entry.samples
  const failureRate = entry.failures / Math.max(1, entry.samples + entry.failures)
  if (objective === 'cost') return perCall
  // A model with no successful sample has no latency; treat it as the worst
  // possible latency rather than NaN, which would make every comparison false.
  if (objective === 'latency') return latency ?? Number.POSITIVE_INFINITY
  // balanced: normalise nothing, but a failing model must lose to a healthy one.
  return (latency ?? Number.POSITIVE_INFINITY) + perCall / 100 + failureRate * 10_000
}

export function createModelStats(directory) {
  const path = join(directory, 'model-stats.json')
  let entries = {}
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) entries = parsed
  } catch { /* first run, or unreadable: start empty */ }

  const keyOf = route => `${route.provider}/${route.model}`

  let flushTimer
  function flush() {
    flushTimer = undefined
    try {
      mkdirSync(directory, { recursive: true, mode: 0o700 })
      const temp = `${path}.${process.pid}.tmp`
      writeFileSync(temp, JSON.stringify(entries), { mode: 0o600 })
      renameSync(temp, path)
    } catch { /* keep the in-memory numbers; a run must not die over stats */ }
  }
  function schedule() {
    if (flushTimer !== undefined) return
    flushTimer = setTimeout(flush, 1000)
    flushTimer.unref?.()
  }

  return {
    /** Record one finished request. Errors count as failures with no latency. */
    observe(route, { elapsedMs, tokens, failed }) {
      if (!route?.provider || !route?.model) return
      const key = keyOf(route)
      const entry = entries[key] ?? empty()
      if (failed) entry.failures += 1
      else {
        if (Number.isFinite(elapsedMs) && elapsedMs >= 0) entry.latencyMs = trim([...entry.latencyMs, Math.round(elapsedMs)])
        if (Number.isFinite(tokens) && tokens > 0) entry.tokens += Math.round(tokens)
        entry.samples += 1
      }
      entry.updatedAt = Date.now()
      entries[key] = entry
      schedule()
    },
    scoreOf(route, objective) { return score(entries[keyOf(route)], objective) },
    snapshot() { return JSON.parse(JSON.stringify(entries)) },
    /** Drop records nobody has touched for a month. */
    prune(now = Date.now()) {
      for (const [key, entry] of Object.entries(entries)) if (now - (entry.updatedAt ?? 0) > STALE_MS) delete entries[key]
    },
    flush,
  }
}

/**
 * Choose one of several authorised routes.
 *
 * Returns the first route when the objective is 'none', when fewer than two
 * candidates exist, or when no candidate has ever been observed: guessing from
 * no data is exactly what this must not do.
 */
export function pickRoute(routes, { objective, stats }) {
  if (!Array.isArray(routes) || routes.length === 0) return undefined
  if (objective === undefined || objective === 'none' || routes.length === 1) return routes[0]
  const scored = routes.map((route, index) => ({ route, index, value: stats.scoreOf(route, objective) }))
  const known = scored.filter(item => item.value !== undefined)
  if (known.length === 0) return routes[0]
  known.sort((a, b) => (a.value - b.value) || (a.index - b.index))
  return known[0].route
}
