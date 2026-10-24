import assert from 'node:assert/strict'
import { __test as check } from './index.js'

let clock = 0
const timing = check.createTiming(() => clock)
clock = 5; timing.enter('queue')
clock = 25; timing.enter('prepare')
clock = 35; timing.enter('model')
clock = 85; timing.enter('validate')
clock = 90
assert.deepEqual(timing.finish(), { phase: 'validate', queue: 20, prepare: 15, model: 50, validate: 5 })
clock = 999; timing.enter('model')
assert.deepEqual(timing.finish(), { phase: 'validate', queue: 20, prepare: 15, model: 50, validate: 5 }, 'late work cannot change completed timing')

assert.deepEqual(check.parseCandidates('1. first\n2. second\nCONFIDENCE: 0.6'), {
  candidates: ['first', 'second'], confidence: 0.6,
})
assert.deepEqual(check.parseCandidates('plain\nCONFIDENCE: 0.5'), {
  candidates: ['plain'], confidence: 0.5,
})
assert.deepEqual(check.parseCandidates('CONFIDENCE: 0.9').candidates, [])
for (const value of ['-1', '1.9', '85', 'NaN']) {
  assert.equal(check.parseCandidates(`1. first\nCONFIDENCE: ${value}`).confidence, null)
}
assert.deepEqual(check.statsOf({ accepted: Infinity, dismissed: -1 }), {
  accepted: 0, dismissed: 0, acceptedChars: 0, dismissedChars: 0,
})
assert.equal(check.learnHint({ accepted: 1, dismissed: 1, acceptedChars: 2, dismissedChars: 200 }), '')
assert.match(check.learnHint({ accepted: 5, dismissed: 5, acceptedChars: 20, dismissedChars: 200 }), /shorter/)
let reads = 0
assert.equal(await check.workspaceContext({ fs: {
  async resolve() { reads++; throw new Error('denied') },
}}, '/unavailable'), '')
assert.equal(reads, 1)
assert.equal(await check.workspaceContext({}, '/unavailable'), '')
// Context preserves current intent and evidence without forwarding hidden blocks.
const message = (role, text, extra = {}) => ({ role, source: { kind: role === 'user' ? 'user' : role }, content: [{ type: 'text', text }], ...extra })
const history = [
  message('user', 'Do not publish; inspect only.'),
  message('assistant', 'Earlier answer.'),
  message('user', 'What is still unfinished?'),
  message('assistant', 'Checking', { content: [{ type: 'text', text: 'Checking' }, { type: 'tool-call', id: 't1', name: 'git_status', arguments: 'PRIVATE_ARGUMENTS' }] }),
  message('tool', 'Working tree clean; pending review.', { toolCallId: 't1' }),
  message('assistant', 'Implementation complete; review is pending.'),
  message('user', 'RUNTIME_INJECTION', { source: { kind: 'runtime' } }),
  message('assistant', '', { content: [{ type: 'reasoning', text: 'PRIVATE_REASONING' }] }),
]
const contextSession = { deriveMessages: () => history, surface: { nodes: [1, 2], replaceGeneration: 0, contentGeneration: 2 } }
const context = check.transcript(contextSession, 12000)
for (const text of ['Do not publish', 'What is still unfinished?', 'Implementation complete', 'Working tree clean', 'git_status']) assert(context.includes(text))
for (const text of ['PRIVATE_ARGUMENTS', 'PRIVATE_REASONING', 'RUNTIME_INJECTION']) assert(!context.includes(text))
for (const budget of [0, 10, 100, 500, 12000]) assert(check.transcript(contextSession, budget).length <= budget)
const longSession = { deriveMessages: () => [message('user', 'Keep this restriction. ' + 'x'.repeat(15000)), message('assistant', 'Done. ' + 'y'.repeat(15000))] }
const bounded = check.transcript(longSession, 1000)
assert(bounded.includes('Keep this restriction') && bounded.includes('Done.') && bounded.includes('[...truncated...]'))
const cut = check.sourceOf(contextSession)
contextSession.surface.contentGeneration++
assert.notEqual(check.sourceOf(contextSession), cut)
assert.match(check.SYSTEM.next, /one good candidate is enough/)
assert.match(check.SYSTEM.next, /no clear next message, output nothing/)
assert.deepEqual(check.parseCandidates('').candidates, [])
assert.deepEqual(check.parseCandidates('1. Only grounded intent.\nCONFIDENCE: 0.8').candidates, ['Only grounded intent.'])

// Execute real Client store/request code with deferred transport, not a second implementation.
const { readFile } = await import('node:fs/promises')
const { runInNewContext } = await import('node:vm')
let module
const requests = []
let currentSource = 'cut-1'
const storage = new Map(), timers = new Set(), sourceWaits = []
let stallSource = false
const expire = milliseconds => {
  const timer = [...timers].find(value => value.milliseconds === milliseconds)
  assert(timer, `deadline ${milliseconds} was installed`)
  timers.delete(timer); timer.callback()
}
const sandbox = {
  AbortController, DOMException, performance,
  setTimeout: (callback, milliseconds) => { const timer = { callback, milliseconds }; timers.add(timer); return timer },
  clearTimeout: timer => timers.delete(timer),
  window: { __ModuleLoader__: { load: value => { module = value } } },
  sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  fetch: async (url, options) => {
    if (String(url).includes('/turn?') && stallSource) return new Promise(resolve => sourceWaits.push(resolve))
    if (!String(url).endsWith('/suggest')) return { json: async () => ({ ok: true, source: currentSource }) }
    const body = JSON.parse(options.body)
    return new Promise(resolve => requests.push({ body, signal: options.signal,
      finish: (text, overrides = {}, stalledBody) => resolve({ json: async () => stalledBody ?? ({ ok: true, text, sessionId: body.sessionId, revision: body.revision, source: 'cut-1', ...overrides }) }) }))
  },
}
let clientSource = await readFile(new URL('./client.js', import.meta.url), 'utf8')
clientSource = clientSource.replace("      inject: ['slots'", "      checks: { runRequest, trackDraft, suggestionBySession, pendingBySession, nextRequestId, settingsStore, sourceMatches, timingBySession },\n      inject: ['slots'")
runInNewContext(clientSource, sandbox)
const legacyRecord = { kind: 'next', text: 'KEEP', draftAt: '', source: 'cut-1' }
sandbox.window[Symbol.for('dsh.composer-assist.session-state.v2')] = {
  requests: new Map([['legacy', 1]]), pending: new Map([['legacy', { id: 1, draft: '', revision: 1 }]]),
  suggestions: new Map([['legacy', legacyRecord]]), candidates: new Map(),
  drafts: new Map([['legacy', { draft: 'keep draft', revision: 1 }]]), listeners: new Set(),
}
const client = module.factory(() => ({})).checks
assert(client)
assert(!client.pendingBySession.has('legacy'), 'unbounded legacy requests cannot survive as busy')
assert.equal(sandbox.window[Symbol.for('dsh.composer-assist.session-state.v2')].requests.get('legacy'), 2)
assert.equal(client.suggestionBySession.get('legacy'), legacyRecord)
assert.equal(sandbox.window[Symbol.for('dsh.composer-assist.session-state.v2')].drafts.get('legacy').draft, 'keep draft')
client.trackDraft('a', 'draft')
const old = client.runRequest('complete', 'a', 'draft', 'test')
const beforeDuplicate = requests.length
await client.runRequest('complete', 'a', 'draft', 'remount')
assert.equal(requests.length, beforeDuplicate, 'remount must reuse the same draft request')
client.trackDraft('a', 'changed'); client.trackDraft('a', 'draft')
requests.at(-1).finish('STALE')
await old
assert(!client.suggestionBySession.has('a'), 'ABA draft edits must reject an old response')
const first = client.runRequest('next', 'a', 'draft', 'test')
const firstRequest = requests.at(-1)
const second = client.runRequest('next', 'a', 'draft', 'test')
const secondRequest = requests.at(-1)
firstRequest.finish('OLD'); await first
assert(client.pendingBySession.has('a'), 'old completion must not clear newer busy state')
assert.equal(client.timingBySession.get('a').pending, true, 'old completion cannot replace newer timing')
secondRequest.finish('NEW'); await second
assert.equal(client.suggestionBySession.get('a').text, 'NEW')
assert(!client.pendingBySession.has('a'))
const lateSource = client.runRequest('next', 'a', 'draft', 'test')
currentSource = 'cut-2'
requests.at(-1).finish('LATE SOURCE'); await lateSource
assert.equal(client.suggestionBySession.get('a').text, 'NEW', 'source must be rechecked before caching')
currentSource = 'cut-1'
const away = client.runRequest('next', 'b', '', 'test')
requests.at(-1).finish('OWNED BY B'); await away
assert.equal(client.suggestionBySession.get('a').text, 'NEW')
assert.equal(client.suggestionBySession.get('b').text, 'OWNED BY B')
const empty = client.runRequest('next', 'a', 'draft', 'test')
requests.at(-1).finish(''); await empty
assert.equal(client.suggestionBySession.get('a').text, 'NEW', 'empty predictions retain valid prior suggestions')
const mismatch = client.runRequest('next', 'a', 'draft', 'test')
requests.at(-1).finish('WRONG SESSION', { sessionId: 'b' }); await mismatch
assert.equal(client.suggestionBySession.get('a').text, 'NEW')
const cancelled = client.runRequest('next', 'a', 'draft', 'test')
client.nextRequestId('a'); requests.at(-1).finish('CANCELLED'); await cancelled
assert.equal(client.suggestionBySession.get('a').text, 'NEW')

// Fire the real Client deadlines without waiting or trusting transport cancellation.
client.settingsStore.value = { timeoutMs: 2000 }
const headerHang = client.runRequest('next', 'a', 'draft', 'timeout')
const lateHeader = requests.at(-1)
expire(3000); await headerHang
assert(lateHeader.signal.aborted && !client.pendingBySession.has('a'))
lateHeader.finish('TOO LATE')
await new Promise(resolve => setImmediate(resolve))
assert.equal(client.suggestionBySession.get('a').text, 'NEW')
let finishBody
const bodyHang = client.runRequest('next', 'a', 'draft', 'timeout')
requests.at(-1).finish('', {}, new Promise(resolve => { finishBody = resolve }))
await new Promise(resolve => setImmediate(resolve))
expire(3000); await bodyHang
assert(!client.pendingBySession.has('a'))
finishBody({ ok: true, text: 'LATE BODY' })
await new Promise(resolve => setImmediate(resolve))
assert.equal(client.suggestionBySession.get('a').text, 'NEW')
stallSource = true
const sourceHang = client.runRequest('next', 'a', 'draft', 'timeout')
requests.at(-1).finish('LATE SOURCE CHECK')
await new Promise(resolve => setImmediate(resolve))
expire(3000); await sourceHang
assert(!client.pendingBySession.has('a'))
sourceWaits.shift()({ json: async () => ({ ok: true, source: 'cut-1' }) })
await new Promise(resolve => setImmediate(resolve))
assert.equal(client.suggestionBySession.get('a').text, 'NEW')
const acceptCheck = client.sourceMatches('a', 'cut-1')
expire(5000)
await assert.rejects(acceptCheck, { name: 'TimeoutError' })
sourceWaits.shift()({ json: async () => ({ ok: true, source: 'cut-1' }) })
stallSource = false
const timedOld = client.runRequest('next', 'a', 'draft', 'timeout')
const timedRequest = requests.at(-1)
const stillNew = client.runRequest('next', 'a', 'draft', 'timeout')
expire(3000); await timedOld
assert(client.pendingBySession.has('a'), 'old timeout cannot clear newer busy state')
requests.at(-1).finish('NEW AFTER TIMEOUT'); await stillNew
timedRequest.finish('LATE OLD REQUEST')
await new Promise(resolve => setImmediate(resolve))
assert.equal(client.suggestionBySession.get('a').text, 'NEW AFTER TIMEOUT')
assert.equal(timers.size, 0, 'all Client deadline timers are cleared')

const measured = client.runRequest('next', 'a', 'draft', 'timing')
assert.equal(client.timingBySession.get('a').pending, true)
requests.at(-1).finish('MEASURED', { timing: { phase: 'validate', queue: 20, prepare: 15, model: 50, validate: 5, prompt: 'PRIVATE_TEXT' } })
await measured
const measuredTiming = client.timingBySession.get('a')
assert.equal(measuredTiming.status, 'complete')
assert.equal(measuredTiming.pending, false)
assert.deepEqual(JSON.parse(JSON.stringify(measuredTiming.host)), { phase: 'validate', queue: 20, prepare: 15, model: 50, validate: 5 })
assert(Number.isFinite(measuredTiming.total) && measuredTiming.total >= 0)
assert(!JSON.stringify(measuredTiming).includes('PRIVATE_TEXT') && !JSON.stringify(measuredTiming).includes('MEASURED'))
const newerTiming = client.runRequest('next', 'a', 'draft', 'timing')
const newerStats = client.timingBySession.get('a')
requests.at(-1).finish('INVALID TIMING', { timing: { phase: 'model', queue: 0, prepare: -1, model: 5, validate: 0 } })
await newerTiming
assert.equal(newerStats.host, null, 'invalid durations stay unknown')
assert.equal(client.timingBySession.get('a'), newerStats)
assert.equal(measuredTiming.status, 'complete', 'a new request has a separate timing record')

// Execute the actual accept callback through its asynchronous source check.
const acceptStart = clientSource.indexOf('        let accepting = false')
const acceptEnd = clientSource.indexOf('        acceptRef.current = accept', acceptStart)
assert(acceptStart >= 0 && acceptEnd > acceptStart)
for (const change of ['phase', 'session', 'revision', 'unmount', 'none']) {
  const writes = []
  let release
  const record = { kind: 'complete', draftAt: 'prefix', source: 'cut-1' }
  const refs = {
    pending: record, sessionId: 'a', draftRef: { current: 'prefix' }, phaseRef: { current: 'plain' },
    sessionIdRef: { current: 'a' }, acceptRef: { current: undefined },
    suggestionBySession: new Map([['a', record]]), draftBySession: new Map([['a', { revision: 1 }]]),
    currentCandidate: () => 'suffix', sourceMatches: () => new Promise(resolve => { release = resolve }),
    inputActions: { setDraft: value => writes.push(value) }, recordFeedback: async () => {}, clear: () => {},
    rememberSuggestion: () => {},
  }
  const accept = runInNewContext(`(() => {${clientSource.slice(acceptStart, acceptEnd)}; return accept })()`, refs)
  refs.acceptRef.current = accept
  assert.equal(accept(), true)
  if (change === 'phase') refs.phaseRef.current = 'composing'
  if (change === 'session') refs.sessionIdRef.current = 'b'
  if (change === 'revision') refs.draftBySession.set('a', { revision: 3 })
  if (change === 'unmount') refs.acceptRef.current = undefined
  release(true)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(writes, change === 'none' ? ['prefixsuffix'] : [], `accept guard: ${change}`)
}

// Execute the actual polish callback; intervening edits cannot be overwritten.
const polishStart = clientSource.indexOf('    function AssistButton(')
const runStart = clientSource.indexOf('      const runPolish = async () => {', polishStart)
const runEnd = clientSource.indexOf('      const runPredict = () => {', runStart)
assert(polishStart >= 0 && runStart > polishStart && runEnd > runStart)
for (const change of ['edit', 'session', 'phase', 'unmount', 'none']) {
  const writes = []
  let release, id = 0
  const refs = {
    polishIdle: true, sessionId: 'a', draft: 'original', mounted: { current: true },
    setOpen: () => {},
    live: { current: { sessionId: 'a', draft: 'original', phase: 'plain' } },
    draftBySession: new Map([['a', { revision: 1 }]]), nextRequestId: () => ++id, currentRequestId: () => id,
    setPolishBusy: () => {}, setPolishFailed: () => {}, sourceMatches: async () => true,
    request: () => new Promise(resolve => { release = resolve }), inputActions: { setDraft: value => writes.push(value) },
  }
  const run = runInNewContext(`(() => {${clientSource.slice(runStart, runEnd)}; return runPolish })()`, refs)
  const completion = run()
  if (change === 'edit') { refs.live.current.draft = 'new input'; refs.draftBySession.set('a', { revision: 2 }) }
  if (change === 'session') refs.live.current.sessionId = 'b'
  if (change === 'phase') refs.live.current.phase = 'composing'
  if (change === 'unmount') refs.mounted.current = false
  release({ text: 'polished', source: 'cut-1' })
  await completion
  assert.deepEqual(writes, change === 'none' ? ['polished'] : [], `polish guard: ${change}`)
}

// Clearing the composer restores the just-accepted suggestion, and only then.
{
  const restoreStart = clientSource.indexOf('      useEffect(() => {\n        if (!enabled || draft !== \'\') return')
  const restoreEnd = clientSource.indexOf('      const inline = settings?.display', restoreStart)
  assert(restoreStart >= 0 && restoreEnd > restoreStart, 'restore effect must exist')
  const block = clientSource.slice(restoreStart, restoreEnd)

  const makeRefs = ({ draft, stored, inflight, accepted }) => {
    const suggestions = new Map()
    if (stored !== undefined) suggestions.set('s', stored)
    const acceptedMap = new Map()
    if (accepted !== undefined) acceptedMap.set('s', accepted)
    const pending = new Map()
    if (inflight) pending.set('s', {})
    const refs = {
      enabled: true, draft, sessionId: 's',
      suggestionBySession: suggestions, acceptedBySession: acceptedMap, pendingBySession: pending,
      setPending: () => {}, restored: [],
    }
    refs.rememberSuggestion = (id, value) => { refs.restored.push([id, value]); suggestions.set(id, value) }
    return refs
  }
  // Run the effect body exactly as written: strip the wrapper and the dep array.
  const bodyStart = block.indexOf('{') + 1
  const bodyEnd = block.lastIndexOf('}, [enabled, draft, sessionId])')
  assert(bodyEnd > bodyStart, 'restore effect dep array must stay recognizable')
  const body = block.slice(bodyStart, bodyEnd)
  assert(body.includes('acceptedBySession.get(sessionId)'), 'restore body must read the accepted record')
  const runEffect = refs => new Function('refs', `with (refs) {${body}}`)(refs)

  const saved = { kind: 'next', text: 'hello', draftAt: '', candidates: ['hello'], source: 'cut-1' }
  // 1. Empty draft + accepted record + nothing newer => restored.
  const restore = makeRefs({ draft: '', accepted: saved })
  runEffect(restore)
  assert.equal(restore.restored.length, 1, 'accepted suggestion must be restored')
  assert.deepEqual(restore.restored[0], ['s', saved])
  // 2. A newer suggestion is stored => leave it alone.
  const newer = makeRefs({ draft: '', stored: saved, accepted: saved })
  runEffect(newer)
  assert.equal(newer.restored.length, 0, 'a stored suggestion must not be replaced')
  // 3. A request is in flight => do not interfere.
  const inflight = makeRefs({ draft: '', inflight: true, accepted: saved })
  runEffect(inflight)
  assert.equal(inflight.restored.length, 0, 'in-flight prediction must not be overwritten')
  // 4. Draft not empty => nothing restored.
  const typing = makeRefs({ draft: 'hello', accepted: saved })
  runEffect(typing)
  assert.equal(typing.restored.length, 0, 'only an empty draft restores')
}

// Low reasoning is chosen only from supported controls; stream errors reject partial text.
for (const supported of [true, false]) {
  let observed
  const llm = {
    prepareCall: async (controls, _signal, configure) => ({
      config: { reasoningEffort: 'medium', ...configure(controls, { reasoning: { efforts: supported ? [{ id: 'medium' }, { id: 'low' }] : [{ id: 'medium' }] } }) },
      stream: async function* (options) { observed = options; yield { type: 'text-delta', text: 'ok' } },
    }),
  }
  assert.equal(await check.runAuxiliary({ llm }, { id: 'speed' }, { maxOutputTokens: 600 }, 'system', 'prompt', new AbortController().signal, { provider: 'test', model: 'unchanged' }), 'ok')
  assert.equal(observed.reasoningEffort, supported ? 'low' : 'medium')
  assert.equal(observed.model, 'unchanged')
  assert.equal(observed.maxTokens, 600)
}
await assert.rejects(check.runAuxiliary({ llm: { prepareCall: async () => ({ config: {}, stream: async function* () {
  yield { type: 'text-delta', text: 'PARTIAL' }
  yield { type: 'finish', reason: { kind: 'error', failure: { message: 'stream failed' } } }
} }) } }, { id: 'error' }, {}, '', '', new AbortController().signal, {}), /stream failed/)
let prepared, dispatched = false, releasePreparation
const preparationSignal = new AbortController()
const preparation = check.generate({ llm: { prepareCall: () => new Promise(resolve => { releasePreparation = resolve; prepared = true }) } },
  { id: 'late-preparation' }, {}, '', '', preparationSignal.signal, 'late-preparation')
await new Promise(resolve => setImmediate(resolve))
assert(prepared)
preparationSignal.abort()
await assert.rejects(preparation)
assert(!check.predictingIn.has('late-preparation'))
releasePreparation({ config: {}, stream: async function* () { dispatched = true } })
await new Promise(resolve => setImmediate(resolve))
assert(!dispatched && !check.runningCalls.has('late-preparation'), 'late preparation cannot dispatch after abort')

// Exercise the real authenticated-route handler under a delayed auxiliary model.
const { apply } = await import('./index.js')
const routes = new Map(), generations = []
const session = { ...contextSession, id: 'host-test', seq: 3, requestHeader: () => ({ config: { provider: 'test', model: 'test' } }) }
const ctx = {
  get: () => undefined,
  sessions: { get: id => id === session.id ? session : undefined },
  llm: { prepareCall: async () => ({ config: {}, stream: async function* () { yield { type: 'text-delta', text: await new Promise(resolve => generations.push(resolve)) } } }) },
  effect: fn => fn(), on: () => () => {}, inject: (_names, fn) => fn(ctx),
  connection: { fetch: { register: route => { routes.set(route.path, route.fetch); return () => {} } } },
}
apply(ctx)
const home = process.env.DSH_HOME
process.env.DSH_HOME = `/tmp/composer-selfcheck-no-settings-${process.pid}`
const until = async predicate => { for (let i = 0; i < 200 && !predicate(); i++) await new Promise(resolve => setTimeout(resolve, 1)); assert(predicate(), 'deferred request reached model') }
const suggest = revision => routes.get('/api/composer-assist/suggest')(new Request('http://localhost/api/composer-assist/suggest', { method: 'POST', body: JSON.stringify({ sessionId: session.id, kind: 'next', revision }) }))
try {
  const oldSource = suggest(1)
  await until(() => generations.length === 1)
  session.surface.contentGeneration++
  generations[0]('1. MUST NOT LAND\nCONFIDENCE: 0.9')
  assert.equal((await (await oldSource).json()).reason, 'stale-source')
  const older = suggest(2)
  await until(() => generations.length === 2)
  const newer = suggest(3)
  await until(() => !check.predictingIn.has(session.id))
  assert.equal(generations.length, 2, 'replacement cannot overlap the old provider call')
  generations[1]('1. OLD\nCONFIDENCE: 0.9')
  assert.equal((await (await older).json()).reason, 'stale-source')
  await until(() => generations.length === 3)
  generations[2]('1. CURRENT\nCONFIDENCE: 0.9')
  const response = await (await newer).json()
  assert.equal(response.text, 'CURRENT')
  assert.equal(response.revision, 3)
  assert.equal(response.source, check.sourceOf(session))
  const savedTimeout = check.DEFAULTS.timeoutMs
  try {
    check.DEFAULTS.timeoutMs = 80
    const hung = suggest(4)
    await until(() => generations.length === 4)
    const timedOut = await (await hung).json()
    assert.equal(timedOut.reason, 'timeout')
    assert(!check.predictingIn.has(session.id), 'timeout cannot suppress later real turns')
    assert(check.runningCalls.has(`${session.id}:next`), 'actual provider call stays owned until it drains')
    const afterTimeout = suggest(5)
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(generations.length, 4)
    generations[3]('1. TOO LATE\nCONFIDENCE: 0.9')
    await until(() => generations.length === 5)
    generations[4]('1. RECOVERED\nCONFIDENCE: 0.9')
    assert.equal((await (await afterTimeout).json()).text, 'RECOVERED')
    assert(!check.runningCalls.has(`${session.id}:next`))
  } finally { check.DEFAULTS.timeoutMs = savedTimeout }
} finally {
  if (home === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = home
}
// Workspace context is gathered after every finished turn, so the git call it
// makes must not repeat inside the window. Count real gathers, not cache hits.
{
  const real = check.workspaceContext
  check.contextCache.clear()
  // Count every git invocation: that is the expensive part being cached.
  let gitCalls = 0
  let filenames = ['a.ts']
  const providers = {
    fs: { resolve: async cwd => cwd, listDir: async () => filenames.map(name => ({ name, type: 'file' })) },
    subprocess: {
      spawn() {
        gitCalls++
        return { done: Promise.resolve({ exitCode: 0 }), collected: { stdout: { readFrom: () => ({ text: '## main' }) } }, terminate() {} }
      },
    },
  }
  const ctx = (cwd, now) => check.cachedWorkspaceContext(providers, cwd, 8, now)

  // Same directory twice inside the window: one git call, identical text.
  const first = await ctx('/repo', 1000)
  const second = await ctx('/repo', 1500)
  assert.equal(first, second, 'a cached hit must return the same text')
  assert.equal(gitCalls, 1, 'a repeat inside the window must not run git again')

  // One millisecond before the window closes (1000 + 5000 - 1) it is still served.
  assert.equal(await ctx('/repo', 5999), first, 'a hit just inside the window must still be served')
  assert.equal(gitCalls, 1, 'the entry must stay valid until the window closes')

  // At the boundary it gathers again and sees new state.
  filenames = ['b.ts']
  assert.match(await ctx('/repo', 6000), /b\.ts/, 'the cache must expire after the window')
  assert.equal(gitCalls, 2, 'expiry must trigger a fresh gather')

  // A different directory is its own entry.
  await ctx('/other', 6100)
  assert.equal(gitCalls, 3, 'directories must not share an entry')

  // A gather that yields nothing is not remembered: it may only mean the host has
  // not wired the fs service yet.
  check.contextCache.clear()
  assert.equal(await check.cachedWorkspaceContext({}, '/repo', 8, 1000), '', 'no providers means no context')
  assert.equal(check.contextCache.size, 0, 'an empty result must not be remembered')

  // The uncached gather still works and returns a string.
  assert.equal(typeof (await real({}, '/tmp')), 'string')
  check.contextCache.clear()
}

console.log('Composer context, ownership, hard deadlines, late-result rejection and per-call low-reasoning checks passed')
