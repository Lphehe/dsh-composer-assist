import assert from 'node:assert/strict'
import { __test as check } from './index.js'

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
const storage = new Map()
const sandbox = {
  window: { __ModuleLoader__: { load: value => { module = value } } },
  sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  fetch: async (url, options) => {
    if (!String(url).endsWith('/suggest')) return { json: async () => ({ ok: true, source: currentSource }) }
    const body = JSON.parse(options.body)
    return new Promise(resolve => requests.push({ body, finish: (text, overrides = {}) => resolve({ json: async () => ({ ok: true, text, sessionId: body.sessionId, revision: body.revision, source: 'cut-1', ...overrides }) }) }))
  },
}
let clientSource = await readFile(new URL('./client.js', import.meta.url), 'utf8')
clientSource = clientSource.replace("      inject: ['slots'", "      checks: { runRequest, trackDraft, suggestionBySession, pendingBySession, nextRequestId },\n      inject: ['slots'")
runInNewContext(clientSource, sandbox)
const client = module.factory(() => ({})).checks
assert(client)
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
const polishStart = clientSource.indexOf('    function PolishButton(')
const runStart = clientSource.indexOf('      const run = async () => {', polishStart)
const runEnd = clientSource.indexOf("      return h('button'", runStart)
assert(polishStart >= 0 && runStart > polishStart && runEnd > runStart)
for (const change of ['edit', 'session', 'phase', 'unmount', 'none']) {
  const writes = []
  let release, id = 0
  const refs = {
    idle: true, sessionId: 'a', draft: 'original', mounted: { current: true },
    live: { current: { sessionId: 'a', draft: 'original', phase: 'plain' } },
    draftBySession: new Map([['a', { revision: 1 }]]), nextRequestId: () => ++id, currentRequestId: () => id,
    setBusy: () => {}, setFailed: () => {}, sourceMatches: async () => true,
    request: () => new Promise(resolve => { release = resolve }), inputActions: { setDraft: value => writes.push(value) },
  }
  const run = runInNewContext(`(() => {${clientSource.slice(runStart, runEnd)}; return run })()`, refs)
  const completion = run()
  if (change === 'edit') { refs.live.current.draft = 'new input'; refs.draftBySession.set('a', { revision: 2 }) }
  if (change === 'session') refs.live.current.sessionId = 'b'
  if (change === 'phase') refs.live.current.phase = 'composing'
  if (change === 'unmount') refs.mounted.current = false
  release({ text: 'polished', source: 'cut-1' })
  await completion
  assert.deepEqual(writes, change === 'none' ? ['polished'] : [], `polish guard: ${change}`)
}

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
  await until(() => generations.length === 3)
  generations[1]('1. OLD\nCONFIDENCE: 0.9')
  assert.equal((await (await older).json()).reason, 'stale-source')
  generations[2]('1. CURRENT\nCONFIDENCE: 0.9')
  const response = await (await newer).json()
  assert.equal(response.text, 'CURRENT')
  assert.equal(response.revision, 3)
  assert.equal(response.source, check.sourceOf(session))
} finally {
  if (home === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = home
}
console.log('Composer context, conservative prediction, source/draft race, ownership and fallback checks passed')
