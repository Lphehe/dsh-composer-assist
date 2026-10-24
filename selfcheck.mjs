import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
// The assistant's own next-step suggestions look exactly like user requests; the prompt
// has to forbid reusing them, and the transcript label must repeat that in place.
assert.match(check.SYSTEM.next, /Never reuse or lightly reword a sentence the Assistant wrote/)
{
  const t = check.transcript(
    { deriveMessages: () => [
      { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'hi' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Change it back to 0.7.1' }] },
    ] },
    4000,
  )
  assert.match(t, /never copy or reword/, 'the assistant label must carry the constraint')
}
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
// A moved conversation fingerprint must NOT discard a finished answer: it changes for
// reasons unrelated to the suggestion, which is how every prediction died at 2-7s.
const lateSource = client.runRequest('next', 'a', 'draft', 'test')
currentSource = 'cut-2'
requests.at(-1).finish('FINGERPRINT MOVED'); await lateSource
assert.equal(client.suggestionBySession.get('a').text, 'FINGERPRINT MOVED',
  'a moved fingerprint must not discard the answer')
currentSource = 'cut-1'
client.suggestionBySession.set('a', { kind: 'next', draftAt: 'draft', text: 'NEW', candidates: ['NEW'], source: 'cut-1' })
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
// The request no longer awaits a conversation-fingerprint round trip, so the old
// 3000ms source-hang case is gone; the overall deadline still has to fire.
const deadlineHang = client.runRequest('next', 'a', 'draft', 'deadline')
await new Promise(resolve => setImmediate(resolve))
expire(3000)
await deadlineHang
assert(!client.pendingBySession.has('a'), 'a fired deadline must clear the busy state')
assert.equal(client.suggestionBySession.get('a').text, 'NEW')
// sourceMatches still guards an ACCEPT, which is a one-shot user action; it is no
// longer part of the prediction path.
const acceptCheck = client.sourceMatches('a', 'cut-1')
expire(5000)
await assert.rejects(acceptCheck, { name: 'TimeoutError' })
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

// Execute the actual accept callback. It writes the draft synchronously, so a Tab press
// lands even when the conversation moved on; the prechecks below are what stop an
// unwanted overwrite.
const acceptStart = clientSource.indexOf('        let accepting = false')
const acceptEnd = clientSource.indexOf('        acceptRef.current = accept', acceptStart)
assert(acceptStart >= 0 && acceptEnd > acceptStart)
for (const change of ['phase', 'session', 'draft', 'stale', 'none']) {
  const writes = []
  const record = { kind: 'complete', draftAt: 'prefix', source: 'cut-1' }
  const refs = {
    pending: record, sessionId: 'a', draftRef: { current: 'prefix' }, phaseRef: { current: 'plain' },
    sessionIdRef: { current: 'a' }, acceptRef: { current: undefined },
    suggestionBySession: new Map([['a', record]]), draftBySession: new Map([['a', { revision: 1 }]]),
    currentCandidate: () => 'suffix', pickedText: () => '',
    inputActions: { setDraft: value => writes.push(value) }, recordFeedback: async () => {}, clear: () => {},
    rememberSuggestion: () => {},
  }
  // Apply the condition BEFORE the call: these are the synchronous guards.
  if (change === 'phase') refs.phaseRef.current = 'composing'
  // The stored suggestion belongs to a different session, which is what a switch looks
  // like from this closure: the map keyed by 'a' no longer holds this record.
  if (change === 'session') refs.suggestionBySession.clear()
  if (change === 'draft') refs.draftRef.current = 'edited'
  if (change === 'stale') refs.suggestionBySession.clear()
  const accept = runInNewContext(`(() => {${clientSource.slice(acceptStart, acceptEnd)}; return accept })()`, refs)
  refs.acceptRef.current = accept
  const claimed = accept()
  await new Promise(resolve => setImmediate(resolve))
  if (change === 'none') {
    assert.equal(claimed, true, 'a valid accept must claim the key')
    assert.deepEqual(writes, ['prefixsuffix'], 'accept must write the draft immediately')
  } else {
    assert.equal(claimed, false, `accept must refuse: ${change}`)
    assert.deepEqual(writes, [], `accept must not write: ${change}`)
  }
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
    runRequest: () => new Promise(resolve => { release = resolve }), inputActions: { setDraft: value => writes.push(value) },
  }
  const run = runInNewContext(`(() => {${clientSource.slice(runStart, runEnd)}; return runPolish })()`, refs)
  const completion = run()
  if (change === 'edit') { refs.live.current.draft = 'new input'; refs.draftBySession.set('a', { revision: 2 }) }
  if (change === 'session') refs.live.current.sessionId = 'b'
  if (change === 'phase') refs.live.current.phase = 'composing'
  if (change === 'unmount') refs.mounted.current = false
  release({ text: 'polished', candidates: ['polished'], source: 'cut-1' })
  await completion
  assert.deepEqual(writes, change === 'none' ? ['polished'] : [], `polish guard: ${change}`)
  // The polished text must actually reach the draft on the clean path; a missing
  // write-back is exactly the bug that made the button look inert.
  if (change === 'none') assert.deepEqual(writes, ['polished'], 'polish must write the result back')
}

// Space ticks candidates and an accept joins the ticked ones in order.
{
  const start = clientSource.indexOf('    function togglePicked(sessionId, index)')
  assert(start >= 0, 'togglePicked must exist')
  const end = clientSource.indexOf('    /** The text of the currently shown candidate. */', start)
  assert(end > start, 'helpers must be delimited')
  const block = clientSource.slice(start, end)
  const record = { kind: 'next', draftAt: '', text: 'a', candidates: ['a', 'b', 'c'], source: 's' }
  const refs = {
    suggestionBySession: new Map([['s', record]]),
    candidateIndexBySession: new Map(), pickedBySession: new Map(),
    publishStore: () => {},
    candidateTotal: id => refs.suggestionBySession.get(id)?.candidates.length ?? 0,
  }
  const api = new Function('refs', `with (refs) { ${block}
    return { togglePicked, pickedText, pickedBySession } }`)(refs)
  assert.equal(api.pickedText('s'), '', 'nothing ticked means single select')
  assert.equal(api.togglePicked('s', 0), true, 'first tick adds')
  assert.equal(api.togglePicked('s', 2), true, 'second tick adds')
  assert.equal(api.pickedText('s'), 'a\nc', 'ticks join in candidate order')
  assert.equal(api.togglePicked('s', 0), false, 'toggling again removes')
  assert.equal(api.pickedText('s'), 'c')
  assert.equal(api.togglePicked('s', 2), false)
  assert.equal(api.pickedBySession.has('s'), false, 'an emptied set must not linger')
}

// A stale suggestion must not render next to a fresh polish: the list has to be gated
// on the draft the suggestion was made for.
{
  const src = readFileSync(new URL('./client.js', import.meta.url), 'utf8')
  assert(src.includes('const current = pending !== null && pending.draftAt === draft'),
    'the strip must know when a suggestion no longer matches the draft')
  assert(src.includes('const listed = total > 1 && current'),
    'the candidate list must be gated on that match')
}

// Polish must not receive the workspace summary: it lists the branch and changed
// files, and the model echoed that instead of revising the draft.
{
  const host = readFileSync(new URL('./index.js', import.meta.url), 'utf8')
  assert(host.includes("kind === 'polish' ? '' : context"),
    'polish must not be given the workspace context')
  assert(host.includes("polish: `You rewrite the user's draft message"),
    'polish prompt must ask for a rewrite')
}

// Polish must rewrite the draft and must not register itself as a suggestion.
{
  const src = readFileSync(new URL('./client.js', import.meta.url), 'utf8')
  assert(src.includes("if (kind !== 'polish') rememberSuggestion(sessionId, record)"),
    'polish must stay out of the suggestion store')
  assert(src.includes("runRequest('polish', sessionId, draft, 'manual')"),
    'polish must go through the shared request path')
}

// A turn boundary produced by the plugin's own auxiliary call must be skipped, or each
// prediction re-arms the next one and the bar never settles.
{
  const host = readFileSync(new URL('./index.js', import.meta.url), 'utf8')
  const start = host.indexOf("scoped.on('agent/turn-stopping'")
  assert(start >= 0, 'turn boundary listener must exist')
  const body = host.slice(start, host.indexOf('turn boundaries', start))
  assert(body.includes('predictingIn.get(sessionId) ?? 0) > 0) return'),
    'own-call boundaries must be skipped')
  // The dedupe map is named deliveredTurns in this build; either name must guard the
  // same rule, so accept both rather than pinning a rename.
  assert(body.includes('servedTurns.get(sessionId)') || body.includes('deliveredTurns.get(sessionId)'),
    'served turns must not re-predict')
}

// The model picker must read a real catalog and stay searchable.
{
  const src = readFileSync(new URL('./client.js', import.meta.url), 'utf8')
  // The Client has no llm service, so the catalog must come from the Host's own route.
  assert(src.includes("fetch(`${API}/models`)"), 'the client must read the host catalog route')
  assert(!src.includes('ctx.remote.llm'), 'the client must not assume a remote.llm service')
  assert(!src.includes('ctx.remote.session.modelCatalog()'),
    'the unusable remote.session.modelCatalog call must be gone')
  assert(src.includes('function ModelPicker('), 'a searchable picker must exist')
  assert(src.includes('settings.model.search'), 'the picker must offer a search field')
  const host = readFileSync(new URL('./index.js', import.meta.url), 'utf8')
  assert(host.includes("path: MODELS_PATH"), 'the host must register the catalog route')
  assert(host.includes('llm.listProviders()'), 'the host must enumerate providers')
  assert(host.includes('llm.listModels(provider.id)'), 'the host must enumerate each provider models')
}

// A picked row must be an inverse fill, not a faint tint: at 22% it was
// indistinguishable from the default row and the user could not see the selection.
{
  const src = readFileSync(new URL('./client.js', import.meta.url), 'utf8')
  const start = src.indexOf('const candidateRowPicked = {')
  assert(start >= 0, 'picked row style must exist')
  const block = src.slice(start, src.indexOf('}', start) + 1)
  assert(block.includes("background: 'var(--dsw-alias-brand-primary)'"),
    'a picked row must use the solid brand fill')
  assert(!block.includes('color-mix'), 'a picked row must not be a diluted tint')
  assert(block.includes("color: 'var(--dsw-alias-bg-base)'"),
    'picked row text must invert per the documented primary-button pairing')
  assert(src.includes('candidateTextPicked'), 'the inverted text style must be applied')
}

// An automatic prediction must never replace one already in flight: doing so bumped
// the request sequence and the answer on the wire came back "expired" seconds later.
{
  const src = readFileSync(new URL('./client.js', import.meta.url), 'utf8')
  assert(src.includes('const automatic = cause !== \'manual\''),
    'asks must distinguish automatic from manual')
  assert(src.includes('if (automatic && pendingBySession.has(owner)) return'),
    'an automatic ask must not supersede a running one')
  assert(src.includes("if (via !== 'hide') nextRequestId(sessionId)"),
    'hiding a suggestion must not invalidate an answer in flight')
}

// Sending a message must retire the standing suggestion: the user moved on, and a
// leftover candidate reads like an answer to the message just sent.
{
  const src = readFileSync(new URL('./client.js', import.meta.url), 'utf8')
  assert(src.includes('const started = running === true && wasRunning.current !== true'),
    'the send transition must be detected')
  assert(src.includes("clear('send')"), 'sending must clear the suggestion')
  const clearAt = src.indexOf('const clear = (via) =>')
  const effectAt = src.indexOf('// Sending a message must retire the suggestion.')
  assert(clearAt > 0 && effectAt > clearAt, 'clear must be defined before the send effect')
}

// A session the user is not looking at must still get its prediction, and the browser
// must not pay for a second one on the same boundary.
{
  const host = readFileSync(new URL('./index.js', import.meta.url), 'utf8')
  assert(host.includes('async function predictInBackground('), 'the Host must predict autonomously')
  assert(host.includes('void predictInBackground(sessionId)'), 'the turn boundary must start it')
  assert(host.includes('if (backgroundIn.has(sessionId)) return'), 'one background call per session')
  assert(host.includes('autoSuggestions.set(sessionId'), 'the result must be stored for the browser')
  const src = readFileSync(new URL('./client.js', import.meta.url), 'utf8')
  assert(src.includes("reportProbe({ phase: 'adopt-host'"), 'the client must adopt the Host result')
  assert(!src.includes("void ask('next', '', 'turn-end', claimed.source)"),
    'the client must not fire a second paid prediction for the same boundary')
}

// Every component the JSX tree renders must exist. Deleting one while a registration
// still referenced it threw at render time and took the whole strip down silently.
{
  // Slot components are passed to register(); the rest are rendered with h().
  for (const [name, usage] of [
    ['AssistButton', 'assist slot'],
    ['SettingsSection', 'render'],
    ['SuggestionStrip', 'render'],
    ['RequestTiming', 'render'],
  ]) {
    assert(
      clientSource.includes(`function ${name}(`) || clientSource.includes(`const ${name} =`),
      `${name} must be defined`)
    const used = clientSource.includes(`h(${name},`) || clientSource.includes(`, ${name}))`)
    assert(used, `${name} (${usage}) must be referenced`)
  }
}

// The ▾ menu must open from the measured button rect and survive a missing rect.
{
  const start = clientSource.indexOf('      const openMenu = () => {')
  assert(start >= 0, 'openMenu must exist')
  const end = clientSource.indexOf('      useEffect(() => {', start)
  assert(end > start, 'openMenu body must be delimited')
  const body = clientSource.slice(start, end) + '\nreturn { openMenu }'
  const runWith = rect => {
    const state = { open: false, anchor: null }
    const refs = {
      open: false, anchor: null,
      menuAnchor: { current: rect === undefined ? null : { getBoundingClientRect: () => rect } },
      setOpen: v => { state.open = v },
      setAnchor: v => { state.anchor = v },
      window: { innerHeight: 800 },
    }
    const out = new Function('refs', `with (refs) { ${body} }`)(refs)
    out.openMenu()
    return { open: state.open, anchor: state.anchor }
  }
  // A real rect anchors the panel just above the button.
  const measured = runWith({ left: 120, top: 700 })
  assert.equal(measured.open, true, 'menu must open')
  assert.deepEqual(measured.anchor, { left: 120, bottom: 100 }, 'anchor must sit above the button')
  // No measurable element must still open, not throw.
  const unmeasured = runWith(undefined)
  assert.equal(unmeasured.open, true, 'menu must open even without a rect')
}

// A manual request must reach the Host labelled manual, and must not be superseded
// by an automatic one: that supersede rule is what made the button look dead.
{
  assert(
    /body: JSON\.stringify\(\{ kind, sessionId, draft, revision, source, cause \}\)/.test(clientSource),
    'the suggest body must carry cause')
  assert(
    /runRequest\('polish', sessionId, draft, 'manual'\)/.test(clientSource),
    'polish must go through runRequest marked manual')

  // Execute the real staleness rule from index.js against both request kinds.
  const src = readFileSync(new URL('./index.js', import.meta.url), 'utf8')
  const start = src.indexOf('        const manual = body.cause === \'manual\'')
  assert(start >= 0, 'the manual branch must exist in the Host')
  const end = src.indexOf('        const discard = ', start)
  assert(end > start, 'the staleness rule must be delimited')
  const block = src.slice(start, end)

  const runRule = (cause, { superseded = false, moved = false } = {}) => {
    const ticket = {}
    const refs = {
      trace: () => {},
      kind: 'next',
      body: { cause }, moved, ticket,
      latestRequests: { get: () => (superseded ? {} : refs.ticket), set: () => {}, delete: () => {} },
      inflight: { get: () => undefined },
      session: {}, source: 'cut-1',
      sourceOf: () => (refs.moved ? 'cut-2' : 'cut-1'),
      key: 'k', reply: () => ({}),
    }
    const out = new Function('refs', `with (refs) { ${block}\n return { manual, stale: stale() } }`)(refs)
    return out
  }
  assert.equal(runRule('manual').manual, true, 'host must recognise a manual request')
  assert.equal(runRule('turn-end').manual, false, 'host must not treat automatic as manual')
  // Manual survives another request arriving; automatic does not.
  assert.equal(runRule('manual', { superseded: true }).stale, false, 'manual must survive supersede')
}

// The merged button's primary action follows the draft: empty predicts, text polishes.
{
  const start = clientSource.indexOf("      const primary = draft.trim() === '' ? 'predict' : 'polish'")
  assert(start >= 0, 'primary action selection must exist')
  const end = clientSource.indexOf('      const runPrimary = ', start)
  assert(end > start, 'runPrimary must follow the selection')
  const runLineEnd = clientSource.indexOf('\n', end)
  const body = clientSource.slice(start, end)
    + clientSource.slice(end, runLineEnd).replace(/^      /, '') + '\nreturn { primary, runPrimary, calls: refs.calls }'
  const runFor = draft => {
    const calls = []
    const refs = {
      draft, polishIdle: true, predictBusy: false, polishLabel: 'p', predictLabel: 'q', polishBusy: false,
      calls, runPolish: () => calls.push('polish'), runPredict: () => calls.push('predict'),
    }
    const out = new Function('refs', `with (refs) { ${body} }`)(refs)
    out.runPrimary()
    return { primary: out.primary, calls }
  }
  assert.deepEqual(runFor(''), { primary: 'predict', calls: ['predict'] }, 'empty draft must predict')
  assert.deepEqual(runFor('hello'), { primary: 'polish', calls: ['polish'] }, 'non-empty draft must polish')
  assert.equal(runFor('   ').primary, 'predict', 'whitespace-only draft counts as empty')
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
  // A conversation that moved on does NOT invalidate a finished answer: the fingerprint
  // moves for unrelated reasons and this check is what discarded live predictions.
  const oldSource = suggest(1)
  await until(() => generations.length === 1)
  session.surface.contentGeneration++
  generations[0]('1. STILL LANDS\nCONFIDENCE: 0.9')
  const settled = await (await oldSource).json()
  assert.equal(settled.text, 'STILL LANDS', 'a moved fingerprint must not discard the answer')
  assert.equal(settled.reason, undefined)
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
