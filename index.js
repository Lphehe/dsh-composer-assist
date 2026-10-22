/**
 * Host half of the composer assistant: resolve the session's own model route,
 * run one short auxiliary completion, and answer it over the authenticated
 * /api channel. Nothing is appended to the session log.
 *
 * Kept dependency-free on purpose: only node builtins and the injected Cordis
 * services, so a profile upgrade cannot break the module at import time.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const SETTINGS_PATH = '/api/composer-assist/settings'
const SUGGEST_PATH = '/api/composer-assist/suggest'
const TURN_PATH = '/api/composer-assist/turn'
const PROBE_PATH = '/api/composer-assist/probe'

/**
 * Last self-report the browser sent about what it actually rendered. The Client
 * measures the live DOM (is the ghost element present, visible, and inside the
 * composer's bounding box) and posts it here, so the real rendering can be checked
 * from the Host without a debugger attached.
 */
let lastProbe = null

/** The most recent alignment measurement reported by the renderer. */
let lastAlign = null

/** What the transcript looked like at the last suggestion request. */
let lastTranscript = null

/** Rolling window of recent renderer reports, oldest first. */
const probes = []

/**
 * Sessions whose last turn has ended and not yet been consumed, with the turn
 * number that ended. The browser polls this instead of watching `session.running`:
 * that flag is per-step, so a tool-calling turn flips it many times and every flip
 * would look like "the answer finished".
 */
const finishedTurns = new Map()

/**
 * Sessions whose turn is currently carrying one of OUR auxiliary requests, with
 * the turn number. A prediction must never feed the auto-trigger: if the Host
 * reports a boundary while our own call is in flight, that boundary is ours.
 */
const predictingIn = new Map()

/**
 * The last turn number already handed to the browser for each session. The turn
 * feed is idempotent on this, so a client that polls twice (or retries) cannot
 * turn one finished answer into two predictions.
 */
const deliveredTurns = new Map()

/** Bundle-relative settings file; the Host home is the documented per-user store. */
const settingsFile = () => join(process.env.DSH_HOME ?? join(process.env.HOME ?? '.', '.dsh'), 'composer-assist', 'settings.json')

const DEFAULTS = {
  // On, one request per finished turn on an empty draft — the requested default.
  // Every request is a real billed model call, so the switch and the mode are one
  // settings row away, and `off` turns ambient work into manual-only.
  enabled: true,
  mode: 'auto',
  // 'bar' is the standalone suggestion row above the composer (the default the
  // user asked for). 'inline' paints it inside the composer as trailing ghost
  // text; that path is kept but off by default because it shares the host
  // placeholder's line.
  display: 'bar',
  provider: '',
  model: '',
  maxInputChars: 12000,
  // Reasoning models spend output budget on reasoning first; a tight cap returns an
  // empty string instead of a short answer. 600 fits one short message and stays cheap.
  maxOutputTokens: 600,
  timeoutMs: 20000,
  debounceMs: 600,
}

const SYSTEM = {
  next: `You predict the user's next message in an ongoing coding conversation.
Read the transcript and write the single message the user is most likely to send next.
Rules: write as the user, in the user's own language and tone; one short instruction or question; no greeting, no preamble, no quotes, no markdown fence; never describe what you are doing.
Always produce one concrete message. If the next step is unclear, predict the most plausible clarifying question or follow-up check rather than an empty answer.`,
  complete: `You complete the user's unfinished draft message in an ongoing coding conversation.
Output ONLY the continuation text that should be appended to the draft. Never repeat or paraphrase the draft, never add quotes, labels, or fences. Keep it short. If no natural continuation exists, output nothing.`,
  polish: `You rewrite the user's draft message to be clearer and more precise for an AI coding agent.
Keep the user's language, intent, and every constraint. Preserve code, paths, identifiers, and quoted text verbatim. Do not add requirements the user did not state. Output only the rewritten message, no preamble, no quotes, no fences.`,
}

const MAX_TRANSCRIPT_MESSAGES = 12

/** Read the persisted settings document, defaulting on any malformed or missing file. */
async function readSettings() {
  try {
    const parsed = JSON.parse(await readFile(settingsFile(), 'utf8'))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DEFAULTS }
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

/** Persist a merged settings document; unknown keys are dropped. */
async function writeSettings(patch) {
  const current = await readSettings()
  const next = { ...current }
  for (const key of Object.keys(DEFAULTS)) {
    if (patch !== null && typeof patch === 'object' && key in patch) next[key] = patch[key]
  }
  next.enabled = next.enabled === true
  if (!['auto', 'word', 'both', 'off'].includes(next.mode)) next.mode = DEFAULTS.mode
  if (!['bar', 'card', 'inline'].includes(next.display)) next.display = DEFAULTS.display
  next.provider = typeof next.provider === 'string' ? next.provider : ''
  next.model = typeof next.model === 'string' ? next.model : ''
  const target = settingsFile()
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}

/** Collapse one message to its text, dropping tool traffic and images. */
function messageText(message) {
  if (message.role !== 'user' && message.role !== 'assistant') return undefined
  const parts = []
  for (const block of message.content ?? []) {
    if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
    else if (block.type === 'tool-call' || block.type === 'tool-result') return undefined
  }
  const text = parts.join('\n').trim()
  return text === '' ? undefined : `${message.role === 'user' ? 'User' : 'Assistant'}: ${text}`
}

/** The recent conversational tail, oldest first, bounded by characters. */
function transcript(session, maxChars) {
  const lines = []
  // `deriveMessages()` reflects only what the surface has folded so far: a session
  // that was just attached (or one whose surface is still building) can answer with
  // an empty list even though the log has content.
  const messages = session.deriveMessages()
  for (let index = messages.length - 1; index >= 0 && lines.length < MAX_TRANSCRIPT_MESSAGES; index--) {
    const line = messageText(messages[index])
    if (line !== undefined) lines.unshift(line)
  }
  let text = lines.join('\n\n')
  if (text.length > maxChars) text = text.slice(text.length - maxChars)
  return text
}

/** Settings route first, then the session's last real request, then the deployment default. */
function resolveRoute(ctx, session, settings) {
  if (settings.provider !== '' && settings.model !== '') return { provider: settings.provider, model: settings.model }
  const header = session.requestHeader()
  if (header?.config?.provider !== undefined && header.config.model !== undefined) {
    return { provider: header.config.provider, model: header.config.model }
  }
  const fallback = ctx.get('agentDefaultModel')?.currentSelection()
  if (fallback !== undefined) return { provider: fallback.provider, model: fallback.model }
  return undefined
}

/** Strip wrapping quotes and fences a model may still add around a bare message. */
function clean(text) {
  let value = text.trim()
  const fence = /^```[a-z]*\n([\s\S]*?)\n```$/u.exec(value)
  if (fence !== null) value = fence[1].trim()
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('“') && value.endsWith('”')))) {
    value = value.slice(1, -1).trim()
  }
  return value
}

/** One auxiliary request against the resolved route; returns the assembled text. */
async function generate(ctx, session, settings, system, prompt, signal) {
  const route = resolveRoute(ctx, session, settings)
  if (route === undefined) throw new Error('没有可用的模型路由：请先在设置里选择模型')
  // Mark this session as carrying our own auxiliary request for the whole call.
  const sessionKey = String(session.id)
  const marker = (predictingIn.get(sessionKey) ?? 0) + 1
  predictingIn.set(sessionKey, marker)
  try {
    return await runAuxiliary(ctx, session, settings, system, prompt, signal, route)
  } finally {
    const left = (predictingIn.get(sessionKey) ?? 1) - 1
    if (left <= 0) predictingIn.delete(sessionKey)
    else predictingIn.set(sessionKey, left)
  }
}

/** The auxiliary model call itself, run while the session carries our marker. */
async function runAuxiliary(ctx, session, settings, system, prompt, signal, route) {
  const call = await ctx.llm.prepareCall({ ...route, maxTokens: settings.maxOutputTokens }, signal)
  const options = {
    ...call.config,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    system,
    sessionId: session.id,
    signal,
  }
  let text = ''
  for await (const chunk of call.stream(options)) {
    if (chunk.type === 'text-delta') text += chunk.text
  }
  return clean(text)
}

/** Build the framed prompt for one requested kind. */
function buildPrompt(kind, draft, history) {
  if (kind === 'next') {
    if (history === '') return undefined
    return `Conversation so far:\n\n${history}\n\nWrite the user's next message.`
  }
  if (kind === 'complete') {
    if (draft.trim() === '') return undefined
    const context = history === '' ? '' : `Conversation so far:\n\n${history}\n\n`
    return `${context}The user is currently typing this draft:\n\n${draft}\n\nWrite only the continuation.`
  }
  return `The user's draft message:\n\n${draft}\n\nRewrite it.`
}

/** Read one JSON request body with a hard byte ceiling. */
async function readJson(request) {
  const text = await request.text()
  if (text.length > 200_000) throw new Error('请求过大')
  const parsed = JSON.parse(text)
  if (parsed === null || typeof parsed !== 'object') throw new Error('请求格式不正确')
  return parsed
}

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
})

/**
 * Register the assistant routes while the connection and model services exist.
 * @param ctx - host plugin context.
 */
export function apply(ctx) {
  ctx.inject(['llm', 'connection', 'sessions'], (scoped) => {
    // One in-flight request per session and kind; a newer request supersedes the older one.
    const inflight = new Map()

    scoped.effect(() => scoped.connection.fetch.register({
      path: SETTINGS_PATH,
      methods: ['GET', 'POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        try {
          if (request.method === 'POST') return json(200, { ok: true, settings: await writeSettings(await readJson(request)) })
          return json(200, { ok: true, settings: await readSettings() })
        } catch (error) {
          return json(400, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      },
    }), 'composer-assist: settings route')

    // Record one finished turn per session; the agent-scoped listener filters to
    // the session it belongs to.
    scoped.effect(() => scoped.on('agent/turn-stopping', ({ agent, turn }) => {
      const sessionId = String(agent.session.id)
      // Our own auxiliary call runs inside this session; if a boundary arrives while
      // it is in flight, that boundary belongs to the prediction, not to the user's
      // answer. Recording it would make the prediction trigger itself forever.
      if ((predictingIn.get(sessionId) ?? 0) > 0) return
      // One finished answer can only ever produce one prediction, even if the
      // browser polls again or retries after a consume.
      if ((deliveredTurns.get(sessionId) ?? -1) >= turn) return
      finishedTurns.set(sessionId, turn)
    }), 'composer-assist: turn boundaries')

    scoped.effect(() => scoped.connection.fetch.register({
      path: TURN_PATH,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: async (request) => {
        const sessionId = new URL(request.url).searchParams.get('sessionId')
        if (sessionId === null) return json(200, { ok: true, turn: null })
        const turn = finishedTurns.get(sessionId) ?? null
        // `consume=1` is the browser acknowledging the turn, so one turn suggests once.
        if (turn !== null && new URL(request.url).searchParams.get('consume') === '1') {
          finishedTurns.delete(sessionId)
          deliveredTurns.set(sessionId, turn)
        }
        return json(200, { ok: true, turn })
      },
    }), 'composer-assist: turn route')

    scoped.effect(() => scoped.connection.fetch.register({
      path: PROBE_PATH,
      methods: ['GET', 'POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        if (request.method === 'POST') {
          try {
            const report = await readJson(request)
            if (report?.phase === 'align') lastAlign = report
            probes.push(report)
            if (probes.length > 40) probes.shift()
            lastProbe = report
          } catch { /* keep the previous report */ }
          return json(200, { ok: true })
        }
        return json(200, { ok: true, probe: lastProbe, align: lastAlign, transcript: lastTranscript, recent: probes })
      },
    }), 'composer-assist: probe route')

    scoped.effect(() => scoped.connection.fetch.register({
      path: SUGGEST_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        let body
        try {
          body = await readJson(request)
        } catch (error) {
          return json(400, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
        const sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined
        const session = sessionId === undefined ? undefined : scoped.sessions.get(sessionId)
        if (session === undefined) return json(404, { ok: false, error: '会话不存在或未加载' })
        const kind = body.kind === 'complete' || body.kind === 'polish' ? body.kind : 'next'
        const settings = await readSettings()
        const draft = typeof body.draft === 'string' ? body.draft : ''
        const history = transcript(session, settings.maxInputChars)
        const prompt = buildPrompt(kind, draft, history)
        // Record what the transcript actually looked like at the moment of the
        // request: an empty fold and an empty log are different bugs.
        lastTranscript = {
          at: Date.now(), sessionId: session.id, kind,
          messages: session.deriveMessages().length,
          chars: history.length,
          seq: String(session.seq),
        }
        if (prompt === undefined) {
          // Name the reason: an empty transcript and a model that answered nothing
          // look identical to the client, and they need different fixes.
          return json(200, { ok: true, text: '', reason: kind === 'next' && history === '' ? 'empty-transcript' : 'empty-input' })
        }

        const key = `${session.id}:${kind}`
        inflight.get(key)?.abort()
        const abort = new AbortController()
        inflight.set(key, abort)
        const timer = setTimeout(() => abort.abort(), settings.timeoutMs)
        try {
          const text = await generate(scoped, session, settings, SYSTEM[kind], prompt, abort.signal)
          if (text === '') return json(200, { ok: true, text: '', reason: 'model-empty', transcriptChars: history.length })
          return json(200, { ok: true, text })
        } catch (error) {
          if (abort.signal.aborted) return json(200, { ok: true, text: '' })
          return json(200, { ok: false, error: error instanceof Error ? error.message : String(error) })
        } finally {
          clearTimeout(timer)
          if (inflight.get(key) === abort) inflight.delete(key)
        }
      },
    }), 'composer-assist: suggest route')
  })
}
