/**
 * Browser half of the composer assistant: a suggestion strip above the input
 * card, a polish button in the composer tool row, and its two General settings
 * rows. Plain JavaScript on purpose — no build step, so the bundle is the
 * source a future upgrade reads.
 */
window.__ModuleLoader__.load({
  id: '@local/composer-assist',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useRef, useState } = React

    const NS = 'composerAssist'
    const API = '/api/composer-assist'

    const zh = {
      'strip.next': '预测输入框',
      'strip.complete': '补全草稿',
      'strip.accept': 'Tab 接受',
      'strip.acceptHint': 'Tab 接受（←/→ 切换候选）',
      'strip.preview': '预览 · 未填入草稿',
      'strip.cycle': '←/→ 切换候选',
      'strip.dismiss': '忽略',
      'strip.draftChanged': '草稿已变化，请重新预测',
      'strip.confidence': '置信度',
      'strip.picked': '已选',
      'strip.candidates': '候选建议',
      'strip.rowLabel': '第 {n} 条，共 {total} 条',
      'strip.confidenceHigh': '较高',
      'strip.confidenceMedium': '中等',
      'strip.confidenceLow': '较低',
      'strip.thinking': '正在生成…',
      'strip.failed': '生成失败',
      'predict.again': '重新预测输入框',
      'predict.short': '预测',
      'predict.title': '预测输入框',
      'predict.busy': '预测中…',
      'polish.short': '润色',
      'polish.title': '润色提示词',
      'polish.busy': '润色中…',
      'polish.failed': '润色失败',
      'assist.title': '润色或预测输入框',
      'assist.more': '更多操作与设置',
      'settings.title': '输入框预测',
      'settings.nav': '预测',
      'settings.restore': '恢复默认值',
      'settings.restoreHint': '把这几个数值改回插件默认值，不动开关和模型选择。',
      'settings.description': '在输入框上方预测你想输入的内容、补全草稿，或点 ✨ 润色提示词。',
      'settings.enabled': '启用',
      'settings.learn': '接受学习',
      'settings.learnHint': '记录你接受/忽略的建议来调整后续预测。默认关闭。',
      'settings.reset': '清除统计',
      'settings.resetHint': '清空已记录的接受/忽略计数。',
      'settings.resetFailed': '清除统计失败',
      'settings.mode': '模式',
      'settings.mode.auto': '自动预测（回复结束后）',
      'settings.mode.word': '单词补全（输入时）',
      'settings.mode.both': '两者都要',
      'settings.mode.off': '只在手动调用时',
      'settings.display': '显示位置',
      'settings.displayHint': '建议栏 = 输入框上方独立一行（推荐）；行内 = 画在输入框里。',
      'settings.display.bar': '输入框上方的建议栏（推荐）',
      'settings.display.inline': '输入框内',
      'settings.model': '预测模型',
      'settings.model.inherit': '跟随本会话模型',
      'settings.enabledHint': '关闭后行为与未安装时完全一致。',
      'settings.modeHint': '自动 = 每轮回答后预测一次；单词 = 输入时补全后半句。',
      'settings.modelHint': '留空则跟随本会话上次真实用过的模型。',
      'settings.model.search': '搜索模型或供应商',
      'settings.model.noMatch': '没有匹配的模型',
      'settings.model.loading': '正在读取模型列表…',
      'settings.model.routeMissing': '无法读取模型列表：宿主接口未就绪，请重启 DSH 后重试',
      'settings.model.badResponse': '宿主返回了无法识别的模型列表',
      'settings.group.behavior': '行为',
      'settings.group.budget': '限制与开销',
      'settings.summary.on': '已启用',
      'settings.group.learning': '学习',
      'settings.summary.off': '已关闭',
      'settings.maxOutputTokens': '输出上限',
      'settings.maxOutputTokensHint': '推理型模型先花推理预算，太小会导致返回空建议。',
      'settings.debounceMs': '输入停顿',
      'settings.debounceMsHint': '单词补全等你停手这么久才发请求。',
      'settings.timeoutMs': '超时',
      'settings.timeoutMsHint': '超时后静默丢弃，不打扰输入。单次模型调用的上限。',
      'settings.maxInputChars': '上下文上限',
      'settings.maxInputCharsHint': '发给预测模型的最近对话长度。',
      'settings.minConfidence': '置信度门槛',
      'settings.minConfidenceHint': '低于此值的预测会被丢弃；0 表示全部保留，只在建议栏标注置信度。',
      'settings.costNote': '每次预测都是一次真实计费的模型调用；关掉开关即可完全停止。',
      'settings.saveFailed': '设置保存失败',
      'settings.noModels': '当前没有可用模型，请先在「模型」设置里配置。',
      'settings.catalogFailed': '读取模型目录失败：',
      'settings.open': '输入框预测设置',
      'settings.close': '关闭',
      'settings.subagentNote': '子智能体可用的模型由 DSH 原生「子智能体模型选择设置」管理，不在本插件里改。',
    }
    const en = {
      'strip.next': 'Predicted input',
      'strip.complete': 'Draft continuation',
      'strip.accept': 'Tab to accept',
      'strip.acceptHint': 'Tab to accept (←/→ to cycle)',
      'strip.preview': 'Preview · not inserted',
      'strip.cycle': '←/→ switch candidates',
      'strip.dismiss': 'Dismiss',
      'strip.draftChanged': 'Draft changed; predict again',
      'strip.confidence': 'confidence',
      'strip.picked': 'ticked',
      'strip.candidates': 'Candidate suggestions',
      'strip.rowLabel': 'Candidate {n} of {total}',
      'strip.confidenceHigh': 'high',
      'strip.confidenceMedium': 'medium',
      'strip.confidenceLow': 'low',
      'strip.thinking': 'Generating…',
      'strip.failed': 'Generation failed',
      'predict.again': 'Predict input again',
      'predict.short': 'Predict',
      'predict.title': 'Predict input',
      'predict.busy': 'Predicting…',
      'polish.short': 'Polish',
      'polish.title': 'Polish prompt',
      'polish.busy': 'Polishing…',
      'polish.failed': 'Polish failed',
      'assist.title': 'Polish or predict the composer',
      'assist.more': 'More actions and settings',
      'settings.title': 'Composer prediction',
      'settings.nav': 'Prediction',
      'settings.restore': 'Restore defaults',
      'settings.restoreHint': 'Resets these numbers to the plugin defaults; leaves switches and model choice alone.',
      'settings.description': 'Predict what you are about to type, complete a draft, or polish it with ✨.',
      'settings.enabled': 'Enabled',
      'settings.learn': 'Acceptance learning',
      'settings.learnHint': 'Remember what you accept and dismiss to tune later predictions. Off by default.',
      'settings.reset': 'Clear stats',
      'settings.resetHint': 'Erase the recorded accept/dismiss counters.',
      'settings.resetFailed': 'Could not clear the stats',
      'settings.mode': 'Mode',
      'settings.mode.auto': 'Auto (after a reply)',
      'settings.mode.word': 'Word completion (while typing)',
      'settings.mode.both': 'Both',
      'settings.mode.off': 'Manual only',
      'settings.display': 'Where it shows',
      'settings.displayHint': 'Bar is its own row above the composer (recommended); Inline draws it inside.',
      'settings.display.bar': 'Bar above the composer (recommended)',
      'settings.display.inline': 'Inside the composer',
      'settings.model': 'Prediction model',
      'settings.model.inherit': 'Follow this session',
      'settings.enabledHint': 'Off behaves exactly like the plugin not being installed.',
      'settings.modeHint': 'Auto = once after each reply; Word = continue the draft while typing.',
      'settings.modelHint': 'Empty follows the model this session actually used last.',
      'settings.model.search': 'Search models or providers',
      'settings.model.noMatch': 'No matching model',
      'settings.model.loading': 'Loading models…',
      'settings.model.routeMissing': 'Cannot read models: the Host route is not ready; restart DSH and retry',
      'settings.model.badResponse': 'The Host returned an unreadable model list',
      'settings.group.behavior': 'Behaviour',
      'settings.group.budget': 'Limits and cost',
      'settings.summary.on': 'On',
      'settings.group.learning': 'Learning',
      'settings.summary.off': 'Off',
      'settings.maxOutputTokens': 'Output cap',
      'settings.maxOutputTokensHint': 'Reasoning models spend budget on reasoning first; a small cap yields an empty suggestion.',
      'settings.debounceMs': 'Typing pause',
      'settings.debounceMsHint': 'How long the draft must stay still before completion is requested.',
      'settings.timeoutMs': 'Timeout',
      'settings.timeoutMsHint': 'A timeout drops the request silently and never blocks typing.',
      'settings.maxInputChars': 'Context cap',
      'settings.maxInputCharsHint': 'How much recent conversation is sent to the prediction model.',
      'settings.minConfidence': 'Confidence bar',
      'settings.minConfidenceHint': 'Predictions below this are dropped; 0 keeps them and only shows the confidence badge.',
      'settings.costNote': 'Every prediction is a real billed model call; switch this off to stop it entirely.',
      'settings.saveFailed': 'Could not save settings',
      'settings.noModels': 'No models are available; configure one under Models first.',
      'settings.catalogFailed': 'Could not read the model catalog: ',
      'settings.open': 'Composer prediction settings',
      'settings.close': 'Close',
      'settings.subagentNote': 'Which models subagents may use is owned by the native "Subagent model selection" setting, not by this plugin.',
    }

    Object.assign(zh, {
      'timing.queue': '排队', 'timing.prepare': '准备', 'timing.model': '模型', 'timing.validate': '校验',
      'timing.waiting': '等待服务端阶段数据', 'timing.total': '总耗时', 'timing.elapsed': '已等待',
      'timing.complete': '已完成', 'timing.timeout': '超时', 'timing.failed': '请求失败',
      'timing.stale-source': '结果已过期', 'timing.low-confidence': '低于置信度门槛',
      'timing.empty-transcript': '缺少对话上下文', 'timing.empty-input': '草稿为空', 'timing.model-empty': '无候选结果',
      'timing.note': '排队=等待上一调用退出；准备=上下文与模型准备；模型含供应商及网络等待；校验含响应解析和来源核对。分段不含全部传输/页面开销；—表示未取得数据。仅当前页面内存保留最近8个会话的最新请求统计，不记录正文。',
    })
    Object.assign(en, {
      'timing.queue': 'Queue', 'timing.prepare': 'Prepare', 'timing.model': 'Model', 'timing.validate': 'Validate',
      'timing.waiting': 'Waiting for server timing', 'timing.total': 'Total', 'timing.elapsed': 'Elapsed',
      'timing.complete': 'Complete', 'timing.timeout': 'Timed out', 'timing.failed': 'Request failed',
      'timing.stale-source': 'Stale result', 'timing.low-confidence': 'Below confidence threshold',
      'timing.empty-transcript': 'No conversation context', 'timing.empty-input': 'Empty draft', 'timing.model-empty': 'No candidate',
      'timing.note': 'Queue waits for an earlier call; prepare includes context and model preparation; model includes provider/network wait; validation includes response parsing and source checks. Segments exclude some transport/page overhead; — means unavailable. Only the latest request for 8 sessions is retained in page memory; no prompt text.',
    })

    /** Shared settings snapshot so both the strip and the settings rows agree. */
    const settingsStore = {
      value: null,
      listeners: new Set(),
      set(next) {
        this.value = next
        for (const listener of this.listeners) listener()
      },
      subscribe(listener) {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
      },
    }

    async function readSettings() {
      try {
        const response = await fetch(`${API}/settings`)
        const body = await readJsonResponse(response, 'settings')
        if (body.ok !== true) throw new ResponseShapeError('settings: request was refused')
        if (body.settings === null || typeof body.settings !== 'object' || Array.isArray(body.settings)) {
          throw new ResponseShapeError('settings: "settings" is not an object')
        }
        settingsStore.error = undefined
        if (body.defaults !== undefined) settingsStore.defaults = body.defaults
        settingsStore.set(body.settings)
        return body.settings
      } catch (failure) {
        // A silent null store reads as "disabled" downstream, which looks like the
        // feature being broken. Keep the reason so a surface can say it out loud.
        settingsStore.error = failure instanceof Error ? failure.message : String(failure)
        return undefined
      }
    }

    async function saveSettings(patch) {
      const response = await fetch(`${API}/settings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const body = await response.json()
      if (body?.settings !== undefined) settingsStore.set(body.settings)
      return body
    }

    async function withTimeout(work, milliseconds) {
      const abort = new AbortController()
      let timer
      try {
        return await Promise.race([
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              const error = new DOMException('Suggestion timed out', 'TimeoutError')
              abort.abort(error)
              reject(error)
            }, milliseconds)
          }),
          work(abort.signal),
        ])
      } finally { clearTimeout(timer) }
    }

    const timingBySession = new Map()
    /**
     * Response shapes are checked field by field. Treating "the body is an object" as
     * enough is what turned a missing route, a moved revision and a real answer into the
     * same "expired" label; a shape mismatch has to say which field was wrong.
     */
    class ResponseShapeError extends Error {}

    async function readJsonResponse(response, what) {
      // Read the raw text so a non-JSON body (an unregistered route answers with plain
      // text) reports the real cause instead of a JSON syntax error. A Response without
      // text() — a test double, or an adapter that pre-parsed — falls back to json().
      const raw = typeof response.text === 'function' ? await response.text() : JSON.stringify(await response.json())
      let body
      try {
        body = JSON.parse(raw)
      } catch {
        // A route that is not registered answers with plain text, so say that rather
        // than reporting a JSON syntax error the user cannot act on.
        throw new ResponseShapeError(response.ok
          ? `${what}: response is not JSON`
          : `${what}: HTTP ${response.status}${raw === '' ? '' : ` (${raw.slice(0, 80)})`}`)
      }
      if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        throw new ResponseShapeError(`${what}: response is not an object`)
      }
      return body
    }

    const isPositiveInt = value => Number.isSafeInteger(value) && value >= 0

    function requireString(body, key, what) {
      if (typeof body[key] !== 'string') throw new ResponseShapeError(`${what}: "${key}" is not a string`)
      return body[key]
    }

    function requireFinite(body, key, what) {
      if (!Number.isFinite(body[key]) || body[key] < 0) {
        throw new ResponseShapeError(`${what}: "${key}" is not a non-negative number`)
      }
      return body[key]
    }


    async function request(kind, sessionId, draft, revision, source, cause) {
      const configured = settingsStore.value?.timeoutMs
      const deadline = Number.isFinite(configured) ? Math.max(2000, Math.min(120000, configured)) : 20000
      const id = currentRequestId(sessionId)
      const timing = { kind, started: performance.now(), pending: true, stage: 'waiting', host: null }
      timingBySession.delete(sessionId)
      timingBySession.set(sessionId, timing)
      while (timingBySession.size > 8) timingBySession.delete(timingBySession.keys().next().value)
      notifyStore()
      try {
        const result = await withTimeout(async (signal) => {
          const response = await fetch(`${API}/suggest`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ kind, sessionId, draft, revision, source, cause }),
            signal,
          })
          signal.throwIfAborted()
          timing.stage = 'validate'
          timing.receivedAt = performance.now()
          if (timingBySession.get(sessionId) === timing) notifyStore()
          const body = await readJsonResponse(response, `suggest(${kind})`)
          signal.throwIfAborted()
          // `ok` decides the branch; everything else is validated only where it is used,
          // so an optional field being absent is not an error but a wrong type is.
          if (typeof body.ok !== 'boolean') throw new ResponseShapeError('suggest: "ok" is not a boolean')
          if (body.ok !== true) {
            if (typeof body.error !== 'string' || body.error === '') {
              throw new ResponseShapeError('suggest: failure without an error message')
            }
            throw new Error(body.error)
          }
          const owned = body.sessionId === sessionId
            && body.revision === revision
            && typeof body.source === 'string'
          const phases = ['queue', 'prepare', 'model', 'validate']
          if (owned && phases.includes(body.timing?.phase)
            && phases.every(key => Number.isFinite(body.timing[key]) && body.timing[key] >= 0)) {
            timing.host = { phase: body.timing.phase, ...Object.fromEntries(phases.map(key => [key, body.timing[key]])) }
          }
          if (!owned) {
            // Say why this looked unowned instead of collapsing every cause into
            // "expired": a wrong revision, a missing source and a moved fingerprint are
            // different bugs.
            reportProbe({
              phase: 'not-owned', reason: 'not-owned',
              sameSession: body?.sessionId === sessionId,
              revisionMatches: body?.revision === revision,
              hasSource: typeof body?.source === 'string',
              source: body?.source, sourceBound: body?.sourceBound,
              sourceBefore: body?.sourceBefore, sourceAfter: body?.sourceAfter,
              hostReason: body?.reason,
            })
            return { text: '', candidates: [], confidence: null, reason: 'stale-source' }
          }
          const text = typeof body.text === 'string' ? body.text : ''
          if (text === '' && body.reason !== undefined) {
            reportProbe({ phase: 'empty-result', reason: body.reason, transcriptChars: body.transcriptChars })
            return { text: '', candidates: [], confidence: null, reason: body.reason }
          }
          // No second fingerprint veto here. The Host already refused superseded
          // requests, and the caller re-checks the draft revision before writing. Asking
          // the conversation to be byte-identical after a multi-second model call threw
          // away finished answers instead of protecting anything.
          signal.throwIfAborted()
          const candidates = Array.isArray(body.candidates)
            ? body.candidates.filter(item => typeof item === 'string' && item.trim() !== '').slice(0, 3)
            : []
          if (candidates.length === 0 && text !== '') candidates.push(text)
          const confidence = Number.isFinite(body.confidence) && body.confidence >= 0 && body.confidence <= 1 ? body.confidence : null
          return { text: candidates[0] ?? '', candidates, confidence, source: body.source }
        }, deadline + 1000)
        timing.status = id !== currentRequestId(sessionId) || draftBySession.get(sessionId)?.revision !== revision
          ? 'stale-source' : ['timeout', 'stale-source', 'low-confidence', 'empty-transcript', 'empty-input', 'model-empty'].includes(result.reason)
            ? result.reason : result.text === '' ? 'model-empty' : 'complete'
        return result
      } catch (error) {
        timing.status = error?.name === 'TimeoutError' ? 'timeout' : 'failed'
        throw error
      } finally {
        timing.pending = false
        timing.total = performance.now() - timing.started
        timing.clientValidation = timing.receivedAt === undefined ? 0 : performance.now() - timing.receivedAt
        if (timingBySession.get(sessionId) === timing) notifyStore()
      }
    }

    /**
     * Tell the Host what the user did with a suggestion. Best-effort: a failed
     * feedback call must never break accepting or dismissing. Only acted on when
     * the `learn` setting is on, which the Host checks itself.
     */
    async function recordFeedback(action, text) {
      try {
        const response = await fetch(`${API}/feedback`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, text, kind: 'next' }),
        })
        return await response.json()
      } catch { /* feedback is advisory, never fatal */ return undefined }
    }

    // Empty editors need a separate preview: their managed line break pushes the
    // native ::after hint onto a second line. Draft continuations use native flow.
    const GHOST_CLASS = 'composer-assist-ghost'
    const GHOST_STYLE_ID = 'composer-assist-ghost-style'

    /** One stylesheet for the ghost; injected once, removed with the plugin. */
    function ensureGhostStyle() {
      if (typeof document === 'undefined' || document.getElementById(GHOST_STYLE_ID) !== null) return
      const style = document.createElement('style')
      style.id = GHOST_STYLE_ID
      style.textContent = `
.${GHOST_CLASS} {
  grid-area: 1 / 1;
  min-width: 0;
  margin: 4px 8px 4px 14px;
  pointer-events: none;
  user-select: none;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  color: var(--dsw-alias-label-secondary);
}
[data-composer-input][data-composer-assist-continuation] p:last-child::after {
  color: var(--dsw-alias-label-secondary);
  opacity: 1;
}
.${GHOST_CLASS}[hidden] { display: none; }
/* The host's own placeholder occupies the same line and inset; showing both
   stacks two sentences on one baseline. While a ghost is visible it stands in
   for the placeholder. */
[data-composer-card] :has(> .${GHOST_CLASS}:not([hidden])) { display: grid; }
[data-composer-card] :has(> .${GHOST_CLASS}:not([hidden])) > [data-composer-input] { grid-area: 1 / 1; }
[data-composer-card] :has(> .${GHOST_CLASS}:not([hidden])) > [data-composer-placeholder] { display: none; }
`
      document.head.appendChild(style)
    }

    /** The live contenteditable of the resident composer, if one is mounted. */
    function composerInputElement() {
      if (typeof document === 'undefined') return undefined
      return document.querySelector('[data-composer-card] [data-composer-input]')
        ?? document.querySelector('[data-composer-card] [contenteditable="true"]')
        ?? undefined
    }

    /** The wrapper shared by the editor, placeholder, and empty-draft preview. */
    function ghostHostFor(element) {
      const grow = element?.parentElement
      return grow === null || grow === undefined ? undefined : grow
    }

    /** One ghost span per composer wrapper, created on demand. */
    function ghostSpanFor(element) {
      const host = ghostHostFor(element)
      if (host === undefined) return undefined
      let span = host.querySelector(`.${GHOST_CLASS}`)
      if (span === null) {
        span = document.createElement('span')
        span.className = GHOST_CLASS
        span.setAttribute('aria-hidden', 'true')
        span.hidden = true
        host.appendChild(span)
      }
      return span
    }

    const ownedHints = new Map()

    /** Empty drafts use an overlay; continuations use the editor's own text flow. */
    function paintGhost(element, text, continuation = false) {
      clearGhosts()
      if (element === undefined || text === '') return
      const existing = getComputedStyle(element).getPropertyValue('--dsh-composer-hint').trim()
      if (existing !== '' && existing !== '""') return
      if (continuation) {
        const value = `"${CSS.escape(text)}"`
        ownedHints.set(element, {
          value,
          previous: element.style.getPropertyValue('--dsh-composer-hint'),
          priority: element.style.getPropertyPriority('--dsh-composer-hint'),
        })
        element.style.setProperty('--dsh-composer-hint', value)
        element.setAttribute('data-composer-assist-continuation', '')
        return
      }
      const span = ghostSpanFor(element)
      if (span === undefined || span === null) return
      span.textContent = text
      span.hidden = false
    }

    /**
     * Report what the live DOM actually shows. This is the only honest check for
     * "the text is inside the input box": the plugin measures its own ghost against
     * the composer's own bounding rect in the real renderer and posts the result.
     */
    /** Measure the visible bar against the composer card, in real pixels. */
    function measureAlignment() {
      try {
        if (typeof document === 'undefined') return undefined
        const card = document.querySelector('[data-composer-card]')
        const bar = document.querySelector('[data-composer-assist-bar]')
        if (card === null || bar === null) return { present: false }
        const c = card.getBoundingClientRect(), b = bar.getBoundingClientRect()
        return {
          present: true,
          cardLeft: Math.round(c.left), cardRight: Math.round(c.right),
          barLeft: Math.round(b.left), barRight: Math.round(b.right),
          deltaLeft: Math.round(b.left - c.left), deltaRight: Math.round(b.right - c.right),
        }
      } catch { return undefined }
    }

    function reportProbe(extra) {
      try {
        const input = composerInputElement()
        const span = typeof document === 'undefined' ? null : document.querySelector(`.${GHOST_CLASS}`)
        const box = input?.getBoundingClientRect()
        const rect = span?.getBoundingClientRect()
        const style = span === null || span === undefined ? null : getComputedStyle(span)
        // The host placeholder shares the ghost's line; report whether it is showing,
        // because two visible sentences there means the collision regressed.
        const placeholder = typeof document === 'undefined'
          ? null : document.querySelector('[data-composer-card] [data-composer-placeholder]')
        const placeholderStyle = placeholder === null ? null : getComputedStyle(placeholder)
        const report = {
          at: Date.now(),
          ghostPresent: span !== null && span !== undefined,
          ghostText: span?.textContent ?? '',
          ghostHidden: span?.hidden ?? null,
          ghostDisplay: style?.display ?? null,
          ghostFontSize: style?.fontSize ?? null,
          placeholderPresent: placeholder !== null,
          placeholderDisplay: placeholderStyle?.display ?? null,
          placeholderVisible: placeholder !== null && placeholderStyle?.display !== 'none'
            && placeholderStyle?.visibility !== 'hidden',
          ghostColor: style?.color ?? null,
          insideComposer: box !== undefined && rect !== undefined
            && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1
            && rect.left >= box.left - 1 && rect.right <= box.right + 1,
          composerBox: box === undefined ? null : { top: box.top, bottom: box.bottom, left: box.left, right: box.right },
          ghostBox: rect === undefined ? null : { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
          ...extra,
        }
        void fetch(`${API}/probe`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report),
        }).catch(() => {})
        return report
      } catch { return undefined }
    }

    /** Hide every ghost this plugin owns (unmount, mode switch, no suggestion). */
    function clearGhosts() {
      if (typeof document === 'undefined') return
      for (const [element, hint] of ownedHints) {
        element.removeAttribute('data-composer-assist-continuation')
        if (element.style.getPropertyValue('--dsh-composer-hint') === hint.value) {
          if (hint.previous !== '') element.style.setProperty('--dsh-composer-hint', hint.previous, hint.priority)
          else element.style.removeProperty('--dsh-composer-hint')
        }
      }
      ownedHints.clear()
      for (const span of document.querySelectorAll(`.${GHOST_CLASS}`)) {
        span.hidden = true
        span.textContent = ''
      }
    }

    /** Drop the injected stylesheet and every ghost span; called once on unload. */
    function disposeGhosts() {
      if (typeof document === 'undefined') return
      clearGhosts()
      for (const span of document.querySelectorAll(`.${GHOST_CLASS}`)) span.remove()
      document.getElementById(GHOST_STYLE_ID)?.remove()
    }

    /**
     * Manual-prediction channel: the tool-row button cannot own the suggestion
     * (the strip does), so it asks the strip to produce one and the strip paints it.
     */
    const manualRequest = {
      current: undefined,
      /** Whether a suggestion is on screen right now (read by the tool-row button). */
      hasSuggestion: undefined,
      /** Subscribe to that boolean so the button label follows it. */
      subscribe: undefined,
    }

    /** Subscribers that re-read `hasSuggestion` when a suggestion appears or clears. */
    const listeners = new Set()

    /** A prediction request in flight, owned by the module (not a component). */
    function runRequest(kind, sessionId, draft, cause, source) {
      if (kind === 'complete' && hasDraftRequest(sessionId, draft)) return Promise.resolve(null)
      // Polish shares the session's request sequence so a prediction poll cannot mark a
      // finished polish stale merely by bumping the counter first.
      const id = nextRequestId(sessionId)
      const revision = trackDraft(sessionId, draft).revision
      const token = {}
      pendingBySession.set(sessionId, { id, token, draft, revision, bounded: true })
      publishStore()
      reportProbe({ phase: 'begin', trace: `req-${id}`, owner: sessionId, kind, cause })
      return request(kind, sessionId, draft, revision, source, cause).then((result) => {
        // A newer request for the same session supersedes this one, and an edited draft
        // invalidates it; either way the result must not be cached.
        const idMoved = id !== currentRequestId(sessionId)
        const draftMoved = draftBySession.get(sessionId)?.revision !== revision
        const stale = idMoved || draftMoved
        // Split the two causes: a superseded request is scheduling, an edited draft is
        // the user moving on. Collapsing them made this impossible to diagnose.
        reportProbe({ phase: 'result', trace: `req-${id}`, kind,
          textLength: result.text.length, stale, idMoved, draftMoved, owner: sessionId,
          confidence: result.confidence })
        if (stale || result.text === '') return null
        const record = {
          kind, text: result.text, draftAt: draft, source: result.source,
          candidates: result.candidates, confidence: result.confidence,
        }
        // Polish rewrites the draft; it is not a suggestion to show above it. Storing
        // it made the bar surface the polished text as if it were a new prediction.
        if (kind !== 'polish') rememberSuggestion(sessionId, record)
        return record
      }).catch(() => null).finally(() => {
        // Compare by the request identity this call owns, not by a numeric id a caller
        // may have pre-claimed: an unmatched id left the session permanently busy.
        if (pendingBySession.get(sessionId)?.token === token) pendingBySession.delete(sessionId)
        publishStore()
      })
    }

    /**
     * Per-session request sequence. Ownership of an in-flight request cannot live in
     * a component instance: switching conversations unmounts the strip and a fresh
     * `useRef` would restart at zero, marking the pending result stale.
     */
    const sessionStorageKey = 'dsh.composer-assist.predictions.v2'
    function restoreSessionState() {
      const state = {
        requests: new Map(), suggestions: new Map(), candidates: new Map(),
        drafts: new Map(), pending: new Map(), listeners: new Set(),
      }
      try {
        const entries = JSON.parse(sessionStorage.getItem(sessionStorageKey) ?? '[]')
        if (!Array.isArray(entries)) return state
        for (const entry of entries.slice(-8)) {
          if (!Array.isArray(entry)) continue
          const [id, record, index] = entry
          if (typeof id !== 'string' || record === null || typeof record !== 'object'
            || !['next', 'complete'].includes(record.kind) || typeof record.text !== 'string'
            || record.text === '' || typeof record.draftAt !== 'string' || typeof record.source !== 'string') continue
          const candidates = Array.isArray(record.candidates)
            ? record.candidates.filter(text => typeof text === 'string' && text !== '').slice(0, 3) : []
          state.suggestions.set(id, {
            kind: record.kind, text: record.text, draftAt: record.draftAt, candidates, source: record.source,
            confidence: Number.isFinite(record.confidence) && record.confidence >= 0 && record.confidence <= 1
              ? record.confidence : null,
          })
          state.candidates.set(id, Number.isSafeInteger(index) && index >= 0
            ? Math.min(index, Math.max(1, candidates.length) - 1) : 0)
        }
      } catch { /* Storage can be unavailable; retain predictions in memory. */ }
      return state
    }
    const sessionStateKey = Symbol.for('dsh.composer-assist.session-state.v2')
    const sessionState = window[sessionStateKey] ??= restoreSessionState()
    const requestSeqBySession = sessionState.requests
    const draftBySession = sessionState.drafts

    function trackDraft(sessionId, draft) {
      let state = draftBySession.get(sessionId)
      if (state === undefined || state.draft !== draft) {
        state = { draft, revision: (state?.revision ?? 0) + 1 }
        draftBySession.set(sessionId, state)
      }
      return state
    }

    function hasDraftRequest(sessionId, draft) {
      const active = pendingBySession.get(sessionId)
      return active?.draft === draft && active.revision === draftBySession.get(sessionId)?.revision
    }

    async function sourceMatches(sessionId, source) {
      return withTimeout(async (signal) => {
        const response = await fetch(`${API}/turn?sessionId=${encodeURIComponent(sessionId)}`, { signal })
        const body = await readJsonResponse(response, 'turn')
        signal.throwIfAborted()
        return body.ok === true && typeof source === 'string' && body.source === source
      }, 5000)
    }

    /** Next request id for one session. */
    function nextRequestId(sessionId) {
      const next = (requestSeqBySession.get(sessionId) ?? 0) + 1
      requestSeqBySession.set(sessionId, next)
      if (requestSeqBySession.size > 32) requestSeqBySession.delete(requestSeqBySession.keys().next().value)
      return next
    }

    /** The highest id issued for one session. */
    function currentRequestId(sessionId) {
      return requestSeqBySession.get(sessionId) ?? 0
    }

    /**
     * Per-session suggestion memory. The strip unmounts when the conversation
     * changes, so component state alone loses the prediction on every switch.
     * Keyed by session id and pruned to a few entries.
     */
    const suggestionBySession = sessionState.suggestions

    /**
     * Which candidate of the stored suggestion is currently shown, per session.
     * Kept separate from the suggestion because switching it is a UI action that
     * must survive a conversation switch just like the suggestion itself.
     */
    const candidateIndexBySession = sessionState.candidates

    /** Monotonic instance counter for mount/unmount tracing. */
    let instanceSeq = 0

    /** Sessions whose prediction is currently generating. */
    const pendingBySession = sessionState.pending
    // Pre-deadline requests cannot keep a reloaded plugin permanently busy.
    for (const [owner, active] of pendingBySession) {
      if (active?.bounded === true) continue
      nextRequestId(owner)
      pendingBySession.delete(owner)
    }

    /** Notified whenever any session's stored suggestion changes. */
    const storeListeners = sessionState.listeners

    /** Subscribe to store changes; returns the unsubscribe. */
    function onStoreChange(listener) {
      storeListeners.add(listener)
      return () => { storeListeners.delete(listener) }
    }

    /** Notify every subscriber after a store mutation. */
    function publishStore() {
      try {
        sessionStorage.setItem(sessionStorageKey, JSON.stringify(
          [...suggestionBySession].map(([id, record]) => [id, record, candidateIndexBySession.get(id) ?? 0]),
        ))
      } catch { /* Storage can be unavailable; retain predictions in memory. */ }
      notifyStore()
    }

    function notifyStore() {
      for (const listener of [...storeListeners]) { try { listener() } catch { /* one bad subscriber */ } }
    }

    /** Remember or forget one session's pending suggestion. */
    function rememberSuggestion(sessionId, value) {
      if (sessionId === undefined) return
      if (value === null) {
        suggestionBySession.delete(sessionId)
        candidateIndexBySession.delete(sessionId)
        // Ticks belong to one suggestion; keeping them would join candidates the user
        // never ticked in a later prediction.
        pickedBySession.delete(sessionId)
      } else {
        suggestionBySession.delete(sessionId)
        suggestionBySession.set(sessionId, value)
        // A fresh prediction always starts on its first candidate.
        candidateIndexBySession.set(sessionId, 0)
      }
      while (suggestionBySession.size > 8) suggestionBySession.delete(suggestionBySession.keys().next().value)
      publishStore()
    }

    /**
     * The suggestion the user just accepted, kept so clearing the composer brings
     * it back. Accepting used to forget it outright, which made an accepted
     * prediction unrecoverable after the draft was cleared. Kept per session and
     * never persisted: it is a one-step undo, not a second suggestion store.
     */
    const acceptedBySession = new Map()

    /** The currently shown candidate index for one session. */
    function candidateIndex(sessionId) {
      return candidateIndexBySession.get(sessionId) ?? 0
    }

    /** Total candidates in the stored suggestion (1 when there is no list). */
    function candidateTotal(sessionId) {
      const record = suggestionBySession.get(sessionId)
      if (record === null || record === undefined) return 0
      return Array.isArray(record.candidates) && record.candidates.length > 0
        ? record.candidates.length
        : 1
    }

    /**
     * Candidates the user ticked with Space, per session. Empty means "not choosing
     * several": accepting then takes just the shown candidate, so the single-select
     * path is unchanged for everyone who never presses Space.
     */
    const pickedBySession = new Map()

    /** Toggle one candidate in the ticked set; returns its new state. */
    function togglePicked(sessionId, index) {
      const total = candidateTotal(sessionId)
      if (total <= 1) return false
      const set = pickedBySession.get(sessionId) ?? new Set()
      if (set.has(index)) set.delete(index)
      else set.add(index)
      // An emptied set must not linger, or accepting would keep looking multi-select.
      if (set.size === 0) pickedBySession.delete(sessionId)
      else pickedBySession.set(sessionId, set)
      publishStore()
      return set.has(index)
    }

    /** Stable, top-to-bottom order for an accepted multi-selection. */
    function pickedText(sessionId) {
      const set = pickedBySession.get(sessionId)
      if (set === undefined || set.size === 0) return ''
      const record = suggestionBySession.get(sessionId)
      if (record === null || record === undefined) return ''
      const list = Array.isArray(record.candidates) && record.candidates.length > 0
        ? record.candidates : [record.text]
      return [...set].sort((a, b) => a - b)
        .map(index => String(list[index] ?? '')).filter(text => text !== '')
        .join('\n')
    }

    /** The text of the currently shown candidate. */
    function currentCandidate(sessionId) {
      const record = suggestionBySession.get(sessionId)
      if (record === null || record === undefined) return ''
      const total = candidateTotal(sessionId)
      const index = Math.min(candidateIndex(sessionId), total - 1)
      if (Array.isArray(record.candidates) && record.candidates.length > 0) {
        return String(record.candidates[index] ?? '')
      }
      return record.text
    }

    /**
     * Cycle to the next or previous candidate. Returns false when there is only
     * one candidate, so the keyboard handler can leave the suggestion untouched.
     */
    function cycleCandidate(sessionId, delta) {
      const total = candidateTotal(sessionId)
      if (total <= 1) return false
      const next = (candidateIndex(sessionId) + delta + total) % total
      candidateIndexBySession.set(sessionId, next)
      publishStore()
      return true
    }

    /** Accept handle published by the mounted strip for the keyboard listener. */
    const acceptRef = { current: undefined }

    // Suggestion bar. Depth comes from a host surface layer plus a one-pixel
    // boundary — DESIGN.md defines no shadow token, and the old 4px left accent read
    // as decoration rather than state.
    const stripStyle = {
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      // Align with the composer card: same cap and side clearances the host uses for
      // its own dock cards, centred in the stack. This slot is a sibling of the input
      // bar, whose wrapper carries `padding: 0 <side-clearance>`; without the same
      // inset the bar is one clearance too wide on each side.
      boxSizing: 'border-box',
      width: 'calc(100% - 2 * var(--dsh-composer-side-clearance, 16px))',
      maxWidth: 'var(--dsh-composer-card-max-width)',
      margin: '0 auto 8px', padding: '10px 12px', borderRadius: '12px',
      border: '1px solid var(--dsw-alias-border-l1)',
      // A faint brand wash plus the card layer: distinct from the composer below
      // without the heavy accent bar the design brief rejected.
      background: 'color-mix(in srgb, var(--dsw-alias-brand-primary) 3%, var(--dsw-alias-bg-layer-1))',
      color: 'var(--dsw-alias-label-primary)',
      fontSize: '13px', lineHeight: '1.5',
    }
    // The badge is a label, not a control: 11px on the documented label step.
    // Pills, not bare labels: the header has to say which feature spoke and what state
    // it is in, and flat grey text disappeared against the card surface.
    // Restraint: the header states what spoke and how sure it is in plain type. Three
    // boxed pills competed with the rows below, which are the thing the user acts on.
    // The one bold element in this bar is the picked-row highlight.
    const stripBadge = {
      flex: '0 0 auto', fontSize: '11px', fontWeight: '650', lineHeight: '1.6',
      color: 'var(--dsw-alias-brand-primary)', whiteSpace: 'nowrap',
    }
    const stripText = {
      flex: '1 1 auto', minWidth: 0, color: 'var(--dsw-alias-label-primary)',
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    }
    const stripActions = { flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '6px' }

    // 5px chip corners and the token selection tint; a ticked row is highlighted as a
    // whole so the choice does not depend on reading a glyph.
    // Rows are the primary control of this bar, so they carry the layer-2 surface a
    // button would: an untinted row still reads as clickable rather than as plain text.
    const candidateRow = {
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      boxSizing: 'border-box', padding: '8px 12px', marginTop: '6px',
      borderRadius: '8px', cursor: 'pointer',
      border: '1px solid var(--dsw-alias-border-l1)',
      background: 'var(--dsw-alias-bg-layer-2)',
      color: 'var(--dsw-alias-label-primary)',
      textAlign: 'left',
    }
    // Three states, deliberately far apart in contrast so a row's status needs no
    // hunting:
    //   default  — layer-2 surface, hairline boundary
    //   shown    — the arrows point here: a 2px brand ring on the card surface
    //   picked   — solid brand fill with inverted text, the one bold element of this bar
    const candidateRowShown = {
      ...candidateRow,
      border: '2px solid var(--dsw-alias-brand-primary)',
      padding: '7px 11px',
      background: 'var(--dsw-alias-bg-layer-1)',
    }
    const candidateRowPicked = {
      ...candidateRow,
      border: '1px solid var(--dsw-alias-brand-primary)',
      background: 'var(--dsw-alias-brand-primary)',
      color: 'var(--dsw-alias-bg-base)',
    }
    // Inverted text on the filled row; the label step stays the same.
    const candidateTextPicked = {
      flex: '1 1 auto', minWidth: 0,
      color: 'var(--dsw-alias-bg-base)',
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    }
    // A plain numeral, not a second badge inside a row that is already a control.
    const candidateIndexLabel = {
      flex: '0 0 auto', width: '14px', textAlign: 'right',
      fontSize: '10px', fontWeight: '650', lineHeight: '1.6',
      color: 'var(--dsw-alias-label-secondary)',
    }
    /** One suggestion strip: renders nothing when there is nothing to offer. */
    function SuggestionStrip({ sessionId, useInput, useSession, inputActions, settings, t }) {
      const draft = useInput(state => state.draft)
      trackDraft(sessionId, draft)
      const phase = useInput(state => state.phase)
      const phaseRef = useRef(phase)
      phaseRef.current = phase
      const blank = useSession(session => session.blank)
      // Drives poll cadence only; a turn boundary comes from the Host, never from this flag.
      const running = useSession(session => session.running)
      const [pending, setPending] = useState(null)
      const [busy, setBusy] = useState(false)
      const [failed, setFailed] = useState(false)
      const askRef = useRef(undefined)
      const sessionIdRef = useRef(sessionId)
      sessionIdRef.current = sessionId
      const pendingRef = useRef(null)
      const draftRef = useRef(draft)
      draftRef.current = draft

      const enabled = settings !== null && settings.enabled === true
      const mode = settings?.mode ?? 'auto'

      // One identity per instance. A switch that reuses the instance keeps this id;
      // a remount gets a new one. The trace below reads this to tell them apart.
      const instanceId = useRef(undefined)
      if (instanceId.current === undefined) instanceId.current = `i${(++instanceSeq)}`
      useEffect(() => {
        reportProbe({ phase: 'mount', instanceId: instanceId.current, sessionId })
        return () => {
          reportProbe({ phase: 'unmount', instanceId: instanceId.current, sessionId: sessionIdRef.current })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      // A pending suggestion belongs to the draft it was produced for; any manual edit drops it.
      // Switching conversations restores that session's own suggestion rather than
      // dropping it; a session with none shows nothing.
      useEffect(() => {
        const apply = () => {
          const restored = suggestionBySession.get(sessionId) ?? null
          // A fresh object on every publish: the candidate index lives in the module
          // store, so handing React the same reference would skip the re-render and
          // an arrow-key cycle would never repaint.
          setPending(restored === null ? null : { ...restored })
          // Generating state lives with the session too, so switching back shows the
          // "generating" bar again instead of a blank gap until the result lands.
          setBusy(pendingBySession.has(sessionId))
        }
        apply()
        reportProbe({ phase: 'restore', instanceId: instanceId.current, sessionId,
          hasStored: suggestionBySession.get(sessionId) != null,
          storedSize: suggestionBySession.size,
          keys: [...suggestionBySession.keys()].map(k => k.slice(-6)) })
        setFailed(false)
        return onStoreChange(apply)
      }, [sessionId])
      // Draft edits keep completed candidates, but accepting still requires the exact draft.
      useEffect(() => {
        if (!enabled) return undefined
        let stopped = false
        const verify = async () => {
          const stored = suggestionBySession.get(sessionId)
          if (stored === undefined) return
          try {
            const matches = await sourceMatches(sessionId, stored.source)
            if (!stopped && !matches && suggestionBySession.get(sessionId) === stored) rememberSuggestion(sessionId, null)
          } catch { /* A failed read cannot prove that a cached suggestion is stale. */ }
        }
        void verify()
        const timer = setInterval(() => { void verify() }, 5000)
        return () => { stopped = true; clearInterval(timer) }
      }, [sessionId, enabled, running, pending?.source])

      /**
       * @param via - 'accept' consumes it, 'dismiss' forgets it, 'hide' only hides it.
       *   A hide keeps the store intact, so leaving and returning to the session
       *   restores the suggestion instead of losing it to an unrelated keypress.
       */

      const clear = (via) => {
        reportProbe({ phase: 'clear', via: via ?? 'unknown', instanceId: instanceId.current,
          sessionId, hadPending: pending !== null })
        // Advance the sequence only when the user actually dismisses or accepts, so a
        // request still in flight stops counting as wanted. A 'hide' (Escape) leaves the
        // suggestion intact, and bumping there threw away an answer about to arrive.
        if (via !== 'hide') nextRequestId(sessionId)
        if (via !== 'hide') rememberSuggestion(sessionId, null)
        setPending(null); setBusy(false); setFailed(false)
        for (const listener of listeners) listener()
      }

      const ask = async (kind, at, cause, source) => {
        const owner = sessionId
        // Automatic asks (a finished turn, a typing debounce) must not replace a request
        // that is already running: the replacement bumps the sequence and the answer in
        // flight is discarded as expired. A manual click is an explicit request for a
        // fresh answer, so it keeps the right to supersede.
        const automatic = cause !== 'manual'
        if (automatic && pendingBySession.has(owner)) return
        reportProbe({ phase: 'request', kind, cause: cause ?? 'unknown', draft: at, owner })
        setFailed(false)
        await runRequest(kind, owner, at, cause, source)
        if (sessionIdRef.current === owner) {
          const stored = suggestionBySession.get(owner)
          setPending(stored === undefined ? null : { ...stored })
          setBusy(pendingBySession.has(owner))
          for (const listener of listeners) listener()
        }
      }

      // Sending a message must retire the suggestion. The session starts running the
      // moment the user submits, so that transition is the signal: the old candidates
      // described a conversation state the user has already moved past, and leaving them
      // on screen made it look like a reply to the message just sent.
      const wasRunning = useRef(running)
      useEffect(() => {
        const started = running === true && wasRunning.current !== true
        wasRunning.current = running
        if (started && (pending !== null || pendingBySession.has(sessionId))) clear('send')
      }, [running])

      // Auto prediction: exactly one request per finished turn.
      //
      // `session.running` is a STEP-level flag — a tool-calling turn flips it off
      // between every step, which is why watching it fired predictions mid-answer.
      // The Host records the real boundary (`agent/turn-stopping`) and hands it over
      // exactly once, so this only has to ask. Polling is dense while the agent works
      // and stops when it goes idle; two catch-up asks cover the turn that just ended.
      useEffect(() => {
        if (!enabled || (mode !== 'auto' && mode !== 'both')) return undefined
        let stopped = false
        const poll = async () => {
          if (stopped) return
          try {
            // Peek first: consuming before we know we can act would burn the
            // boundary if a session switch lands in between (the old code lost the
            // turn exactly that way, leaving nothing to show on return).
            const peek = await fetch(`${API}/turn?sessionId=${encodeURIComponent(sessionId)}`)
            const seen = await readJsonResponse(peek, 'turn')
            // The Host already generated this one, including for sessions the user was not
            // looking at. Adopt it instead of asking a second time: one billable call per
            // finished turn, whichever conversation it belongs to.
            if (seen.auto !== null && seen.auto !== undefined && suggestionBySession.get(sessionId) === undefined) {
              if (seen.turn !== null && seen.turn !== undefined) {
                void fetch(`${API}/turn?sessionId=${encodeURIComponent(sessionId)}&consume=1`)
              }
              reportProbe({ phase: 'adopt-host', sessionId, count: Array.isArray(seen.auto.candidates) ? seen.auto.candidates.length : 1 })
              rememberSuggestion(sessionId, {
                kind: 'next', text: seen.auto.text, draftAt: '',
                source: seen.auto.source, candidates: seen.auto.candidates, confidence: seen.auto.confidence,
              })
              return
            }
            if (stopped || seen.turn === null || seen.turn === undefined) return
            // A draft in progress means the user is already writing; leave the
            // boundary UNCONSUMED so it can still serve them after they clear it.
            // (The old code consumed it here, which is why a finished turn could
            // produce nothing at all.)
            if (draftRef.current !== '') return
            // A boundary recorded by the turn that just ended is stale the moment the
            // user sends: the assistant is answering again and the draft is empty. Without
            // this check the leftover boundary was claimed immediately and a prediction
            // popped up for a conversation that had not produced its answer yet.
            if (running === true) return
            // Claim, then ask. Only a successful claim may drop the suggestion.
            const claim = await fetch(`${API}/turn?sessionId=${encodeURIComponent(sessionId)}&consume=1`)
            const claimed = await readJsonResponse(claim, 'turn')
            if (claimed.turn === null || claimed.turn === undefined) return
            // The Host predicts on this boundary already. Firing a second request here
            // would bill the user twice for one finished turn, so the client only reads
            // what the Host produced.
            if (blank || draftRef.current !== '') return
          } catch { /* a missed poll just means no prediction for that turn */ }
        }
        void poll()
        const timers = []
        // Never start a second prediction for the same session while one is running:
        // the new request bumps the sequence, so the answer already in flight came back
        // "expired" a second or two later. That is what made predictions look unreliable.
        // (The guard lives in poll below.)
        if (running) {
          // Dense while the agent works: the boundary can land at any step end.
          timers.push(setInterval(() => { void poll() }, 1000))
        } else {
          // Idle: catch the turn that just ended, then keep a slow heartbeat so a
          // boundary published after the dense window is still picked up exactly once.
          timers.push(setTimeout(() => { void poll() }, 900), setTimeout(() => { void poll() }, 2200))
          timers.push(setInterval(() => { void poll() }, 5000))
        }
        return () => { stopped = true; timers.forEach(t => { clearInterval(t); clearTimeout(t) }) }
        // `draft` is deliberately absent: a keystroke must not restart the poll.
      }, [enabled, mode, blank, sessionId, running])

      // Word completion: debounce the typed draft, never repeat an accepted line.
      useEffect(() => {
        if (!enabled || (mode !== 'word' && mode !== 'both')) return
        if (draft.trim() === '' || hasDraftRequest(sessionId, draft)) return
        if (suggestionBySession.get(sessionId)?.draftAt === draft) return
        const timer = setTimeout(() => {
          if (draftRef.current === draft && !hasDraftRequest(sessionId, draft)) void ask('complete', draft, 'typing')
        }, settings?.debounceMs ?? 600)
        return () => { clearTimeout(timer) }
      }, [draft, enabled, mode, sessionId, settings?.debounceMs])

      // Mirror the live handlers on every render. The button lives in another slot
      // and may mount earlier, so it always reads the CURRENT closure instead of a
      // stale one captured on the first render.
      askRef.current = ask
      pendingRef.current = pending
      manualRequest.current = (kind) => {
        reportProbe({ phase: 'manual-fire', kind: kind ?? 'next', hasAsk: askRef.current !== undefined, enabled })
        // `ask` is async, so a caller that polls for busy state immediately after this
        // call could still see "idle" and fire again. Record the claim synchronously.
        pendingBySession.set(sessionId, { id: currentRequestId(sessionId) + 1, token: {}, bounded: true })
        publishStore()
        void askRef.current?.(kind ?? 'next', draftRef.current, 'manual')
      }
      manualRequest.hasSuggestion = () => pendingRef.current !== null
      // True while a request for this session is genuinely in flight. The button used a
      // fixed 3s timeout, which re-enabled it long before a 20s model call finished; the
      // next click then superseded the answer that was about to land.
      manualRequest.isBusy = () => pendingBySession.has(sessionId)
      manualRequest.subscribe = (listener) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      }

      // Broadcast pending changes to the button.
      useEffect(() => {
        for (const listener of listeners) listener()
      }, [pending, failed])

      // Report real alignment whenever the bar is on screen, so a layout regression
      // shows up as numbers instead of a screenshot argument.
      useEffect(() => {
        if (pending === null && !busy && !failed) return undefined
        const timer = setTimeout(() => {
          const measured = measureAlignment()
          if (measured !== undefined) reportProbe({ phase: 'align', ...measured })
        }, 60)
        return () => { clearTimeout(timer) }
      }, [pending, busy, failed, sessionId])

      // Accept/Escape from the keyboard listener.
      useEffect(() => {
        let accepting = false
        const accept = () => {
          const stored = suggestionBySession.get(sessionId)
          if (pending === null || stored === undefined || stored.draftAt !== draftRef.current
            || phaseRef.current !== 'plain' || accepting) return false
          const revision = draftBySession.get(sessionId)?.revision
          // A ticked selection wins: the user explicitly chose several candidates.
          const picked = pickedText(sessionId)
          const text = picked !== '' ? picked : currentCandidate(sessionId)
          accepting = true
          // Write the draft immediately. This used to await a network round trip that
          // compared the conversation's content generation first, so any change in
          // between — including the message the prediction followed — discarded the
          // accept silently and Tab looked dead. The synchronous prechecks above are
          // what actually protect the draft; the remote check was only a second opinion.
          inputActions.setDraft(stored.kind === 'complete' ? `${stored.draftAt}${text}` : text)
          void (async () => {
            try {
              void recordFeedback('accept', text)
              // Keep the accepted suggestion so clearing the draft restores it.
              // `next`-kind carries draftAt === '', so it is directly reusable;
              // a completion is anchored to the draft it continued and is dropped
              // once that draft is gone.
              if (stored.kind === 'next') acceptedBySession.set(sessionId, stored)
              else acceptedBySession.delete(sessionId)
              clear('accept')
            } catch { /* Never overwrite a draft when its source cannot be verified. */ }
            finally { accepting = false }
          })()
          return true
        }
        acceptRef.current = accept
        return () => { if (acceptRef.current === accept) acceptRef.current = undefined }
      }, [pending, inputActions])

      useEffect(() => {
        const onKey = (event) => {
          if (pending === null) return
          // Escape anywhere in the app (closing a menu, a dialog, the sidebar) is not
          // a request to discard the suggestion. Only while the composer holds focus.
          const target = event.target
          const insideComposer = target instanceof Element
            && target.closest('[data-composer-card]') !== null
          if (!insideComposer) return
          // An IME owns Escape and the arrows while it composes; taking them would
          // cancel a candidate or move inside the composition.
          if (event.isComposing === true || event.keyCode === 229) return
          // A modifier means the user asked for selection, word, or line movement.
          if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
          if (event.defaultPrevented) return
          // Arrow keys cycle through the candidate list; Tab then accepts the pick.
          // Only on an empty draft: with text in the composer the caret has somewhere
          // to go, and stealing the arrow would break normal editing.
          // A vertical list: Down/Right advance, Up/Left go back. Only on an empty
          // draft, where the arrows have no caret to move.
          if (draftRef.current === '') {
            const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1
              : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0
            if (step !== 0 && cycleCandidate(sessionId, step)) {
              event.preventDefault()
              return
            }
          }
          // Space ticks the shown candidate. Only with an empty draft and several
          // candidates: text in the composer means Space is a space, and with one
          // candidate there is nothing to choose between.
          if (event.key === ' ') {
            if (draftRef.current === '' && candidateTotal(sessionId) > 1) {
              togglePicked(sessionId, candidateIndex(sessionId))
              event.preventDefault()
              return
            }
          }
          // Hide, do not forget: an Escape must not destroy what a switch could restore.
          if (event.key === 'Escape') clear('hide')
        }
        window.addEventListener('keydown', onKey)
        return () => { window.removeEventListener('keydown', onKey) }
      }, [pending])

      // Clearing the composer brings back the suggestion that was just accepted.
      // Deliberately narrow: only when the draft becomes empty, nothing newer is
      // stored, and no request is in flight — otherwise this would fight the
      // prediction the user asked for.
      useEffect(() => {
        if (!enabled || draft !== '') return
        if (suggestionBySession.get(sessionId) !== undefined || pendingBySession.has(sessionId)) return
        const saved = acceptedBySession.get(sessionId)
        if (saved === undefined) return
        // Delete before publishing: rememberSuggestion notifies every listener, and a
        // re-render that still saw the record would restore it again in a loop and
        // take the strip down with it.
        acceptedBySession.delete(sessionId)
        rememberSuggestion(sessionId, saved)
        setPending(saved)
      }, [enabled, draft, sessionId])

      const inline = settings?.display === 'inline'
      // The session is answering: whatever is still stored belongs to the previous
      // exchange. Hiding it during render (not in an effect) is what stops the bar from
      // painting for one frame and disappearing — the flash the user saw on send.
      const sending = running === true
      const continuation = !sending && pending?.kind === 'complete' && pending.draftAt === draft && draft !== ''
      const ghost = enabled && pending !== null
        && ((pending.kind === 'next' && draft === '') || continuation)
        ? currentCandidate(sessionId) : ''

      // The ghost lives over the composer surface, not in this component's tree, so
      // it is reconciled on every relevant change and released on unmount.
      useEffect(() => {
        if (!inline) { clearGhosts(); return undefined }
        ensureGhostStyle()
        const element = composerInputElement()
        if (element === undefined) return undefined
        paintGhost(element, ghost, continuation)
        reportProbe({ phase: 'paint', ghost })
        return undefined
      }, [ghost, inline, sessionId, continuation])
      useEffect(() => () => { clearGhosts() }, [])

      // Record the render decision: this is the only place that can explain a bar
      // that should be visible but is not.
      reportProbe({ phase: 'render', instanceId: instanceId.current, sessionId,
        enabled, inline, hasPending: pending !== null, busy, failed,
        willRender: enabled && (pending !== null || busy || failed) })
      if (!enabled) return null
      // Rendering stops here while the session answers, so no frame ever shows a stale
      // suggestion after a send. The effect below still clears the stored state.
      if (sending) return null
      // Inline mode keeps only a thin affordance row; the text itself is in the composer.
      if (inline && pending === null && !busy && !failed) return null
      if (!inline && pending === null && !busy && !failed) return null

      const badge = busy ? t('strip.thinking')
        : failed ? t('strip.failed')
          // `pending` can be null while busy or failed, so never read through it.
          : t(pending?.kind === 'complete' ? 'strip.complete' : 'strip.next')

      // The candidate list and its confidence ride the store, not component state,
      // so a switch mid-cycle restores the same pick.
      const stored = pending !== null ? suggestionBySession.get(sessionId) : null
      const text = currentCandidate(sessionId)
      const total = candidateTotal(sessionId)
      // The list the rows are built from, and the ticked set for this session. A
      // suggestion without a candidate array is normalised to one entry so the row
      // builder never has to special-case it.
      const candidateList = Array.isArray(stored?.candidates) && stored.candidates.length > 0
        ? stored.candidates : stored === null ? [] : [stored.text]
      const pickedForSession = pickedBySession.get(sessionId)
      const confidence = stored?.confidence
      // Built here rather than via locale interpolation: the locale helper's
      // placeholder behaviour is not verified, and numbers need no translation.
      const pickedCount = pickedForSession === undefined ? 0 : pickedForSession.size
      const counter = total > 1
        ? `${candidateIndex(sessionId) + 1}/${total}${pickedCount > 0 ? ` · ${pickedCount} ${t('strip.picked')}` : ''}`
        : ''
      // The model's number is its own rough guess, so it is labelled as such and
      // rounded to a coarse band: a made-up 73% would read as a real probability.
      const confidenceText = typeof confidence === 'number'
        ? `${t('strip.confidence')} ${confidence >= 0.7 ? t('strip.confidenceHigh')
          : confidence >= 0.4 ? t('strip.confidenceMedium') : t('strip.confidenceLow')}`
        : null

      // Standalone suggestion bar above the composer. Its own element and its own
      // line, so it can never collide with the composer placeholder.
      // With several candidates the bar becomes a column: a header row for status and
      // actions, then a full-width list. The old single row put the list between the
      // badge and the buttons, which squeezed every row and centred its text.
      // A suggestion belongs to the draft it was produced for. Once the draft moves on,
      // the whole list is stale: rendering it next to a finished polish showed two
      // unrelated states at once. The bar keeps only the timing row in that case.
      const current = pending !== null && pending.draftAt === draft
      const listed = total > 1 && current
      const rootStyle = inline
        ? { ...stripStyle, padding: '2px 4px', marginBottom: '4px', border: 'none', borderRadius: 0, background: 'transparent' }
        : listed
          ? { ...stripStyle, flexDirection: 'column', alignItems: 'stretch', gap: '0' }
          : stripStyle

      const acceptButton = pending !== null && h('button', {
        type: 'button',
        onClick: () => { acceptRef.current?.() },
        disabled: pending.draftAt !== draft,
        title: pending.draftAt !== draft
          ? t('strip.draftChanged')
          : total > 1 && draft === '' ? t('strip.acceptHint') : t('strip.accept'),
        style: {
          opacity: pending.draftAt !== draft ? '0.45' : '1',
          cursor: pending.draftAt !== draft ? 'not-allowed' : 'pointer',
          border: 'none',
          background: 'var(--dsw-alias-brand-primary)',
          color: 'var(--dsw-alias-bg-base)',
          borderRadius: '8px', padding: '3px 12px',
          fontSize: '12px', fontWeight: '600', lineHeight: '1.6',
          whiteSpace: 'nowrap',
        },
      }, t('strip.accept'))

      const dismissButton = pending !== null && h('button', {
        type: 'button',
        onClick: () => {
          void recordFeedback('dismiss', currentCandidate(sessionId))
          clear('dismiss')
        },
        title: t('strip.dismiss'),
        style: {
          cursor: 'pointer', border: '1px solid var(--dsw-alias-border-l1)',
          background: 'transparent', color: 'var(--dsw-alias-label-secondary)',
          borderRadius: '8px', padding: '3px 10px',
          fontSize: '12px', lineHeight: '1.6',
          whiteSpace: 'nowrap',
        },
      }, t('strip.dismiss'))

      const header = h('div', {
        style: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
      },
      h('span', { style: stripBadge }, inline && ghost !== '' ? t('strip.preview') : badge),
      // Everything that qualifies the suggestion sits in one muted run, separated by a
      // middot, so the header reads as a sentence instead of a row of competing chips.
      h('span', {
        style: {
          flex: '0 0 auto', minWidth: 0, overflow: 'hidden',
          fontSize: '11px', lineHeight: '1.6',
          color: 'var(--dsw-alias-label-secondary)', whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        },
      }, [confidenceText, counter, inline && total > 1 && draft === '' ? t('strip.cycle') : null]
        .filter(part => part !== null && part !== '').join(' \u00b7 ')),
      h('span', { style: { flex: '1 1 auto' } }),
      h('span', { style: stripActions }, acceptButton, dismissButton))

      const list = listed
        ? h('div', {
          style: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' },
          role: 'group', 'aria-label': t('strip.candidates'),
        },
        [...Array(total).keys()].map(index => h('button', {
          key: index,
          type: 'button',
          'aria-pressed': pickedForSession?.has(index) === true,
          'aria-label': t('strip.rowLabel').replace('{n}', String(index + 1)).replace('{total}', String(total)),
          onClick: () => {
            // Clicking a row also shows it, so a mouse never acts on a hidden pick.
            candidateIndexBySession.set(sessionId, index)
            togglePicked(sessionId, index)
          },
          style: pickedForSession?.has(index) === true
            ? candidateRowPicked
            : index === candidateIndex(sessionId) ? candidateRowShown : candidateRow,
        },
        h('span', {
          // On the filled row the numeral has to invert too, or it disappears.
          style: pickedForSession?.has(index) === true
            ? { ...candidateIndexLabel, color: 'var(--dsw-alias-bg-base)' }
            : candidateIndexLabel,
        }, `${index + 1}`),
        h('span', {
          style: pickedForSession?.has(index) === true ? candidateTextPicked : stripText,
        }, String(candidateList[index] ?? '')))))
        : h('span', { style: inline && ghost !== '' ? {
          ...stripText, position: 'absolute', width: '1px', height: '1px',
          overflow: 'hidden', clipPath: 'inset(50%)',
        } : { ...stripText, paddingTop: '2px' } }, pending !== null ? text : '')

      return h('div', {
        style: rootStyle, role: 'status', 'aria-live': 'polite', 'data-composer-assist-bar': '',
      }, header, list)
    }


    function RequestTiming({ sessionId, settings, t }) {
      const [, redraw] = useState(0)
      const timing = timingBySession.get(sessionId)
      useEffect(() => {
        const off = onStoreChange(() => redraw(value => value + 1))
        redraw(value => value + 1)
        return off
      }, [sessionId])
      useEffect(() => {
        if (!settings?.enabled || !timing?.pending) return
        const timer = setInterval(() => redraw(value => value + 1), 500)
        return () => clearInterval(timer)
      }, [sessionId, settings?.enabled, timing?.pending])
      if (!settings?.enabled || timing === undefined) return null
      const elapsed = timing.pending ? performance.now() - timing.started : timing.total
      const validation = timing.receivedAt === undefined ? 0
        : timing.pending ? performance.now() - timing.receivedAt : timing.clientValidation
      const format = ms => ms === undefined ? '—' : ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`
      const values = ['queue', 'prepare', 'model'].map(key => `${t(`timing.${key}`)} ${format(timing.host?.[key])}`)
      values.push(`${t('timing.validate')} ${timing.host !== null
        ? format(timing.host.validate + validation) : timing.receivedAt === undefined ? '—' : `≥${format(validation)}`}`)
      const stage = timing.host?.phase ?? timing.stage
      const label = timing.pending ? timing.stage === 'waiting' ? t('timing.waiting') : `${t('timing.validate')}…`
        : ['timeout', 'failed'].includes(timing.status)
          ? `${t(`timing.${timing.status}`)} · ${t(`timing.${stage}`)}` : t(`timing.${timing.status}`)
      return h('div', {
        'data-composer-timing': true, title: t('timing.note'),
        style: {
          display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'center',
          boxSizing: stripStyle.boxSizing, width: stripStyle.width, maxWidth: stripStyle.maxWidth,
          margin: '0 auto', padding: '2px 0 4px',
          fontSize: '11px', lineHeight: '1.5', color: 'var(--dsw-alias-label-secondary)',
        },
      }, [
        h('span', { key: 'status', role: 'status', 'aria-live': 'polite' }, `${t(timing.kind === 'polish' ? 'polish.short' : timing.kind === 'complete' ? 'strip.complete' : 'predict.short')} · ${label}`),
        h('span', { key: 'elapsed' }, `${t(timing.pending ? 'timing.elapsed' : 'timing.total')} ${format(elapsed)}`),
        h('span', { key: 'segments' }, values.join(' · ')),
      ])
    }

    /**
     * One ✨ button in the composer tool row: a menu picks polish or predict.
     * The two actions stay separate because their results differ — polish rewrites
     * the draft, predict only fills the strip above it — so they are never fused
     * into one click whose effect the user cannot predict.
     */
    function AssistButton({ sessionId, useInput, inputActions, t, loadCatalog }) {
      const draft = useInput(state => state.draft)
      const phase = useInput(state => state.phase)
      trackDraft(sessionId, draft)
      const live = useRef({ sessionId, draft, phase })
      live.current = { sessionId, draft, phase }
      const mounted = useRef(true)
      useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
      const [polishBusy, setPolishBusy] = useState(false)
      const [polishFailed, setPolishFailed] = useState(false)
      const polishIdle = draft.trim() !== '' && phase === 'plain' && !polishBusy

      const [predictBusy, setPredictBusy] = useState(false)
      const [hasSuggestion, setHasSuggestion] = useState(false)
      const busyTimer = useRef(undefined)
      // Mirror the strip's pending state so the menu can say "regenerate" when one
      // is already showing.
      useEffect(() => {
        const read = () => { setHasSuggestion(manualRequest.hasSuggestion?.() === true) }
        read()
        // Two independent slots: whichever mounts first cannot rely on the other's
        // subscription being published yet, so also re-read on a slow tick.
        const timer = setInterval(read, 1000)
        const off = manualRequest.subscribe?.(read)
        return () => { clearInterval(timer); off?.(); clearTimeout(busyTimer.current) }
      }, [])

      const [open, setOpen] = useState(false)
      const [showSettings, setShowSettings] = useState(false)
      const box = useRef(null)
      const button = useRef(null)
      const menuAnchor = useRef(null)
      // The toolbar sits inside clipping/scrolling ancestors, so an absolutely
      // positioned panel is cut off and reads as a dead click. Anchor a fixed
      // panel to the measured button rect instead.
      const [anchor, setAnchor] = useState(null)
      const openMenu = () => {
        const rect = menuAnchor.current?.getBoundingClientRect()
        if (rect !== undefined && rect !== null) setAnchor({ left: rect.left, bottom: window.innerHeight - rect.top })
        setOpen(true)
      }
      useEffect(() => {
        if (!open) return
        const onKey = event => { if (event.key === 'Escape') { setShowSettings(false); setOpen(false) } }
        const onDown = event => {
          const target = event.target
          if (box.current?.contains(target) === true || menuAnchor.current?.contains(target) === true) return
          setShowSettings(false); setOpen(false)
        }
        document.addEventListener('keydown', onKey)
        document.addEventListener('mousedown', onDown)
        return () => {
          document.removeEventListener('keydown', onKey)
          document.removeEventListener('mousedown', onDown)
        }
      }, [open])

      const runPolish = async () => {
        setOpen(false)
        if (!polishIdle) return
        // Go through runRequest so the id/revision bookkeeping is the same one the
        // predict path uses. Calling request() directly passed a stale revision, so the
        // reply never looked owned and the polished text was silently dropped.
        setPolishBusy(true); setPolishFailed(false)
        try {
          const result = await runRequest('polish', sessionId, draft, 'manual')
          const stillMine = () => mounted.current && live.current.sessionId === sessionId
            && live.current.draft === draft && live.current.phase === 'plain'
          const text = result?.text ?? ''
          if (text !== '' && stillMine()) inputActions.setDraft(text)
          else if (text === '' && stillMine()) setPolishFailed(true)
        } catch {
          if (mounted.current) setPolishFailed(true)
        } finally {
          if (mounted.current) setPolishBusy(false)
        }
      }

      const runPredict = () => {
        setOpen(false)
        const fire = manualRequest.current
        // Report the miss: a silent no-op is indistinguishable from a dead button.
        if (fire === undefined) { reportProbe({ phase: 'click-miss', reason: 'no-channel' }); return }
        // Refuse a second click while the first is genuinely running: re-firing bumps
        // the request sequence and discards the answer already in flight.
        if (manualRequest.isBusy?.() === true) return
        setPredictBusy(true)
        reportProbe({ phase: 'manual-fire', cause: 'click' })
        try { fire('next') } catch { /* the strip reports its own failures */ }
        // Release when the channel reports the request finished, with a generous
        // ceiling so a wedged request can never pin the button forever.
        const poll = () => {
          if (mounted.current !== true) return
          if (manualRequest.isBusy?.() === true) {
            busyTimer.current = setTimeout(poll, 250)
            return
          }
          busyTimer.current = undefined
          setPredictBusy(false)
        }
        busyTimer.current = setTimeout(poll, 250)
      }

      const busy = polishBusy || predictBusy
      const polishLabel = polishFailed ? t('polish.failed') : polishBusy ? t('polish.busy') : t('polish.title')
      const predictLabel = predictBusy ? t('predict.busy')
        : hasSuggestion ? t('predict.again') : t('predict.title')
      const item = {
        display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
        textAlign: 'left', cursor: 'pointer',
        border: 'none', background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        borderRadius: '6px', padding: '6px 8px', fontSize: '12px', lineHeight: '1.5',
      }
      const inert = { ...item, cursor: 'default', color: 'var(--dsw-alias-label-secondary)', opacity: '0.6' }

      // The primary action follows the draft: empty composer predicts, text polishes.
      // The ▾ half is the only way to reach the other action, so a click on the main
      // area always does exactly what its label says.
      const primary = draft.trim() === '' ? 'predict' : 'polish'
      const primaryLabel = primary === 'polish' ? polishLabel : predictLabel
      const primaryBusy = primary === 'polish' ? polishBusy : predictBusy
      const primaryEnabled = primary === 'polish' ? polishIdle : !predictBusy
      const runPrimary = () => { if (primary === 'polish') void runPolish(); else runPredict() }

      return h('div', { style: { position: 'relative', display: 'inline-flex' } },
        h('div', {
          ref: menuAnchor,
          style: {
            display: 'inline-flex', alignItems: 'stretch',
            border: open || polishIdle ? '1px solid var(--dsw-alias-brand-primary)' : '1px solid var(--dsw-alias-border-l1)',
            background: open || polishIdle ? 'var(--dsw-alias-bg-layer-1)' : 'transparent',
            borderRadius: '6px', overflow: 'hidden',
            opacity: busy ? '0.6' : '1',
          },
        },
        h('button', {
          ref: button,
          type: 'button',
          onClick: runPrimary,
          // Never disabled: a stuck busy state must not make the menu unreachable.
          'aria-disabled': busy || undefined,
          title: polishFailed ? t('polish.failed') : primaryLabel,
          'aria-label': primaryLabel,
          'data-composer-assist': true,
          style: {
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            cursor: primaryEnabled && !busy ? 'pointer' : 'default',
            border: 'none', background: 'transparent',
            color: polishFailed ? 'var(--dsw-alias-state-error-primary)'
              : polishIdle || primary === 'predict' ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)',
            padding: '2px 6px', minHeight: '24px',
            fontSize: '12px', fontWeight: '600', lineHeight: '1.5',
            whiteSpace: 'nowrap',
          },
        }, [h('span', { key: 'icon', 'aria-hidden': true }, primaryBusy ? '\u22ef' : primary === 'polish' ? '✨' : '\u2192'),
          h('span', { key: 'label' }, t(primary === 'polish' ? 'polish.short' : 'predict.short'))]),
        h('button', {
          type: 'button',
          onClick: () => { if (open) { setShowSettings(false); setOpen(false) } else openMenu() },
          'aria-haspopup': 'menu',
          'aria-expanded': open,
          title: t('assist.more'),
          'aria-label': t('assist.more'),
          'data-composer-assist-more': true,
          style: {
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', border: 'none',
            borderLeft: '1px solid var(--dsw-alias-border-l1)',
            background: open ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
            color: open ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)',
            padding: '2px 6px', minHeight: '24px', minWidth: '24px',
            fontSize: '12px', lineHeight: '1.5',
          },
        }, h('span', { 'aria-hidden': true }, '⚙'))),
        open && h('div', {
          ref: box,
          role: 'menu',
          'aria-label': t('assist.more'),
          'data-composer-assist-menu': true,
          style: {
            position: 'fixed', zIndex: 60,
            left: `${anchor?.left ?? 0}px`,
            bottom: `${anchor?.bottom ?? 0}px`,
            minWidth: showSettings ? 'min(440px, calc(100vw - 32px))' : '180px',
            maxWidth: 'calc(100vw - 24px)',
            boxSizing: 'border-box', padding: '4px',
            maxHeight: 'min(70vh, 560px)', overflowY: 'auto',
            border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '10px',
            background: 'var(--dsw-alias-bg-layer-1)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
          },
        },
        h('button', {
          type: 'button', role: 'menuitem',
          disabled: !polishIdle,
          onClick: () => { void runPolish() },
          title: polishLabel,
          style: polishIdle ? item : inert,
        }, [h('span', { key: 'icon', 'aria-hidden': true }, polishBusy ? '\u22ef' : '✨'),
          h('span', { key: 'label' }, polishLabel)]),
        h('button', {
          type: 'button', role: 'menuitem',
          'aria-disabled': predictBusy || undefined,
          onClick: runPredict,
          title: predictLabel,
          style: predictBusy ? inert : item,
        }, [h('span', { key: 'icon', 'aria-hidden': true }, predictBusy ? '\u22ef' : '\u2192'),
          h('span', { key: 'label' }, predictLabel)]),
        h('div', { style: { borderTop: '1px solid var(--dsw-alias-border-l1)', margin: '4px 0 0', paddingTop: '4px' } },
          h('button', {
            type: 'button', role: 'menuitem',
            'aria-expanded': showSettings,
            onClick: () => setShowSettings(value => !value),
            title: t('settings.title'),
            style: item,
          }, [h('span', { key: 'icon', 'aria-hidden': true }, '\u2699'),
            h('span', { key: 'label' }, t('settings.title'))]),
          showSettings && h('div', { style: { padding: '4px 4px 8px' } },
            h(SettingsSection, { t, loadCatalog, embedded: true })))))
    }

    /**
     * Searchable model picker. A native <select> is unusable once a profile has dozens
     * of routes: it cannot be typed into, and this list spans every provider.
     * Typing filters by provider and model name; an empty field means "follow this
     * session", which is also the reset action.
     */
    function ModelPicker({ catalog, value, t, loading, error, onOpen, onPick }) {
      const [open, setOpen] = useState(false)
      const [query, setQuery] = useState('')
      const box = useRef(null)
      const field = useRef(null)
      useEffect(() => {
        if (!open) return
        const onDown = event => {
          if (box.current?.contains(event.target) === true) return
          setOpen(false)
        }
        const onKey = event => { if (event.key === 'Escape') setOpen(false) }
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
          document.removeEventListener('mousedown', onDown)
          document.removeEventListener('keydown', onKey)
        }
      }, [open])

      const selected = catalog.find(entry => `${entry.provider}\u0000${entry.id}` === value)
      const label = selected === undefined
        ? (value === '' ? t('settings.model.inherit') : value.replace('\u0000', ' · '))
        : `${selected.provider} · ${selected.name}`
      const needle = query.trim().toLowerCase()
      // Own copy of the field metrics: SettingsSection's selectStyle is scoped inside
      // that component and not visible here.
      const pickerField = {
        background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)',
        border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '8px',
        padding: '6px 10px', fontSize: '13px',
      }
      const matches = needle === '' ? catalog : catalog.filter(entry =>
        `${entry.provider} ${entry.id} ${entry.name}`.toLowerCase().includes(needle))
      const option = {
        display: 'flex', alignItems: 'baseline', gap: '8px', width: '100%',
        textAlign: 'left', cursor: 'pointer', border: 'none', background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        borderRadius: '6px', padding: '6px 8px', fontSize: '12px', lineHeight: '1.5',
      }

      return h('div', { ref: box, style: { position: 'relative', minWidth: '260px' } },
        h('button', {
          type: 'button',
          'aria-haspopup': 'listbox',
          'aria-expanded': open,
          'data-model-picker': true,
          title: label,
          onClick: () => {
            const next = !open
            setOpen(next)
            if (next) { setQuery(''); onOpen?.(); field.current?.focus() }
          },
          style: {
            ...pickerField, display: 'flex', alignItems: 'center', gap: '8px',
            width: '100%', cursor: 'pointer', textAlign: 'left',
          },
        },
        h('span', { style: { flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, label),
        h('span', { 'aria-hidden': true, style: { color: 'var(--dsw-alias-label-secondary)' } }, '\u25be')),
        open && h('div', {
          style: {
            position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 40,
            width: 'min(360px, 80vw)', boxSizing: 'border-box', padding: '6px',
            border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '10px',
            background: 'var(--dsw-alias-bg-layer-1)',
          },
        },
        h('input', {
          ref: field,
          type: 'search',
          value: query,
          placeholder: t('settings.model.search'),
          'aria-label': t('settings.model.search'),
          onChange: event => setQuery(event.target.value),
          style: { ...pickerField, width: '100%', minWidth: 0, marginBottom: '6px', boxSizing: 'border-box' },
        }),
        h('div', { role: 'listbox', style: { maxHeight: '240px', overflowY: 'auto' } },
          h('button', {
            type: 'button', role: 'option',
            'aria-selected': value === '',
            onClick: () => { onPick?.(null); setOpen(false) },
            style: option,
          }, t('settings.model.inherit')),
          matches.map(entry => h('button', {
            key: `${entry.provider}\u0000${entry.id}`,
            type: 'button', role: 'option',
            'aria-selected': `${entry.provider}\u0000${entry.id}` === value,
            onClick: () => { onPick?.(entry); setOpen(false) },
            style: `${entry.provider}\u0000${entry.id}` === value
              ? { ...option, background: 'var(--dsw-alias-bg-layer-2)' } : option,
          },
          h('span', { style: { flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' } }, entry.name),
          h('span', { style: { flex: '0 0 auto', fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, entry.provider))),
          // Say which of the three reasons applies: a failed read, a slow one, or a
          // filter that simply matched nothing. They need different user actions.
          matches.length === 0 && h('div', {
            style: {
              padding: '8px', fontSize: '12px', lineHeight: '1.5',
              color: error !== '' ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-label-secondary)',
              wordBreak: 'break-word',
            },
          }, error !== '' ? error : loading ? t('settings.model.loading') : t('settings.model.noMatch')))))
    }

    /** Full settings page in the left nav: switch, mode, model, and the numbers. */
    function SettingsSection({ t, loadCatalog, embedded = false }) {
      const [settings, setSettings] = useState(settingsStore.value)
      const [catalog, setCatalog] = useState([])
      const [error, setError] = useState('')

      useEffect(() => {
        if (settingsStore.value === null) void readSettings()
        return settingsStore.subscribe(() => { setSettings(settingsStore.value) })
      }, [])

      // The picker needs its options before the user opens it: a <select> that loads
      // on focus cannot repaint its list while it is open.
      useEffect(() => { if (settingsStore.value !== null) void refreshCatalog() }, [settings !== null])

      const save = async (patch) => {
        setError('')
        const body = await saveSettings(patch)
        if (body?.ok !== true) setError(t('settings.saveFailed'))
      }
      const [catalogState, setCatalogState] = useState('idle')
      const [catalogError, setCatalogError] = useState('')
      const refreshCatalog = async () => {
        if (catalog.length > 0 || catalogState === 'loading') return
        setCatalogState('loading')
        setCatalogError('')
        try {
          const rows = await loadCatalog()
          setCatalog(Array.isArray(rows) ? rows : [])
          setCatalogState('done')
        } catch (failure) {
          // Surface the reason inside the picker: "no matching model" alone told the
          // user nothing about a failing catalog read.
          setCatalogError(failure instanceof Error ? failure.message : String(failure))
          setCatalogState('failed')
        }
      }

      const current = settings
      const labelStyle = { fontSize: '13px', fontWeight: '600', lineHeight: '1.5', color: 'var(--dsw-alias-label-primary)' }
      const hintStyle = { fontSize: '12px', lineHeight: '1.5', color: 'var(--dsw-alias-label-secondary)', marginTop: '1px' }
      // One width for every control: the right-hand column lines up, which reads as
      // order far more than any added border or tint could.
      const selectStyle = {
        background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)',
        border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '8px',
        padding: '6px 10px', fontSize: '13px', lineHeight: '1.5',
        // Sized to its own longest option, not a fixed width: a hard 200px clipped
        // "输入框上方的建议栏（推荐）" mid-word.
        boxSizing: 'border-box', width: 'auto', minWidth: '210px', maxWidth: '300px',
      }
      const value = current?.provider !== undefined && current?.provider !== ''
        ? `${current.provider}\u0000${current.model}` : ''
      const number = (key, min, max) => h('input', {
        type: 'number', min, max,
        value: current?.[key] ?? '',
        onChange: event => {
          const parsed = Number(event.target.value)
          if (Number.isFinite(parsed)) void save({ [key]: parsed })
        },
        style: { ...selectStyle, minWidth: '120px' },
      })

      // Modelled on the Host's own settings pages: no cards, no shadows, no eyebrow
      // labels. One column, a plain heading, then rows separated by hairlines. The
      // controls align on a single right edge, which is what makes a long list readable.
      // Group labels sit below the row labels in weight: they divide the list, they are
      // not headings to read. Same reason the first row under one has no top border.
      const sectionHeading = title => h('div', {
        style: {
          fontSize: '12px', fontWeight: '600', lineHeight: '1.5',
          color: 'var(--dsw-alias-label-secondary)',
          margin: '20px 0 2px',
        },
      }, title)

      const control = {
        flex: '0 0 auto', display: 'flex', alignItems: 'center',
        justifyContent: 'flex-end', gap: '10px',
      }

      const settingRow = (label, hint, node, { top = true } = {}) => h('div', {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '24px', padding: '11px 0',
          borderTop: top ? '1px solid var(--dsw-alias-border-l1)' : 'none',
        },
      },
      h('div', { style: { minWidth: 0 } },
        h('div', { style: labelStyle }, label),
        h('div', { style: hintStyle }, hint)),
      h('div', { style: control }, node))

      const toggle = (key, checked) => h('input', {
        type: 'checkbox',
        checked,
        onChange: event => { void save({ [key]: event.target.checked }) },
      })

      const modeValue = current?.mode ?? 'auto'
      const displayValue = current?.display === 'inline' ? 'inline' : 'bar'

      // Numeric fields carry their unit inside the field, so the column stays aligned
      // without a second text element floating beside every input.
      /**
       * Numeric field. Values are stored as the plugin uses them (milliseconds), but a
       * duration is shown in seconds so nobody divides 45000 by 1000 in their head.
       * `per` is the factor between the shown number and the stored one.
       */
      const unit = (key, bounds, suffix, per = 1) => {
        const stored = current?.[key]
        const shown = Number.isFinite(stored) ? stored / per : ''
        return h('div', {
          style: { display: 'flex', alignItems: 'center', gap: '8px' },
        },
        h('input', {
          type: 'number',
          step: per === 1 ? 1 : 0.5,
          min: bounds[0] / per, max: bounds[1] / per,
          value: shown,
          onChange: event => {
            const parsed = Number(event.target.value)
            if (!Number.isFinite(parsed)) return
            void save({ [key]: Math.round(parsed * per) })
          },
          style: { ...selectStyle, width: '110px', minWidth: '110px', textAlign: 'right' },
        }),
        h('span', {
          style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', minWidth: '26px' },
        }, suffix))
      }

      return h('div', { style: { padding: embedded ? '0' : '4px 0 32px', maxWidth: '680px' } },
        // No heading at all. The settings nav already labels this page, and the popover
        // is opened from a menu item that names it — a third copy was pure repetition.
        h('p', {
          style: {
            fontSize: '12px', lineHeight: '1.6', margin: '0 0 2px',
            color: 'var(--dsw-alias-label-secondary)',
          },
        }, t('settings.description')),

        sectionHeading(t('settings.group.behavior')),
        h('div', null,
          settingRow(
            t('settings.enabled'), t('settings.enabledHint'),
            toggle('enabled', current?.enabled === true), { top: false }),
          settingRow(
            t('settings.mode'), t('settings.modeHint'),
            h('select', {
              style: selectStyle,
              value: modeValue,
              onChange: event => { void save({ mode: event.target.value }) },
            }, ['auto', 'word', 'both', 'off'].map(mode => h('option', { key: mode, value: mode }, t(`settings.mode.${mode}`))))),
          settingRow(
            t('settings.display'), t('settings.displayHint'),
            h('select', {
              style: selectStyle,
              value: displayValue,
              onChange: event => { void save({ display: event.target.value }) },
            }, ['bar', 'inline'].map(display => h('option', { key: display, value: display }, t(`settings.display.${display}`))))),
          settingRow(
            t('settings.model'), t('settings.modelHint'),
            h(ModelPicker, {
              catalog,
              value,
              t,
              loading: catalogState === 'loading',
              error: catalogState === 'failed' ? catalogError : '',
              onOpen: () => { void refreshCatalog() },
              onPick: entry => { void save(entry === null ? { provider: '', model: '' } : { provider: entry.provider, model: entry.id }) },
            }))),

        sectionHeading(t('settings.group.budget')),
        h('div', null,
          settingRow(
            t('settings.maxOutputTokens'), t('settings.maxOutputTokensHint'),
            unit('maxOutputTokens', [100, 4000], 'tok'), { top: false }),
          settingRow(
            t('settings.debounceMs'), t('settings.debounceMsHint'),
            unit('debounceMs', [200, 5000], 's', 1000)),
          settingRow(
            t('settings.timeoutMs'), t('settings.timeoutMsHint'),
            unit('timeoutMs', [2000, 120000], 's', 1000)),
          settingRow(
            t('settings.maxInputChars'), t('settings.maxInputCharsHint'),
            unit('maxInputChars', [1000, 100000], 'chars')),
          settingRow(
            t('settings.minConfidence'), t('settings.minConfidenceHint'),
            unit('minConfidence', [0, 1], '0–1', 0.1))),

        // One way back: a mistyped budget or timeout had no undo except remembering the
        // old number. Values come from the Host's own DEFAULTS, not a client copy.
        h('div', { style: { display: 'flex', justifyContent: 'flex-end', padding: '10px 0 0' } },
          h('button', {
            type: 'button',
            onClick: async () => {
              const d = settingsStore.defaults
              if (d === undefined) return
              setError('')
              const patch = {}
              for (const key of ['maxOutputTokens', 'debounceMs', 'timeoutMs', 'maxInputChars', 'minConfidence']) {
                if (d[key] !== undefined) patch[key] = d[key]
              }
              const body = await saveSettings(patch)
              if (body?.ok !== true) setError(t('settings.saveFailed'))
            },
            title: t('settings.restoreHint'),
            style: {
              cursor: 'pointer', border: 'none', background: 'transparent',
              color: 'var(--dsw-alias-label-secondary)',
              padding: '2px 4px', fontSize: '12px', textDecoration: 'underline',
            },
          }, t('settings.restore'))),

        sectionHeading(t('settings.group.learning')),
        h('div', null,
          settingRow(
            t('settings.learn'), t('settings.learnHint'),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
              toggle('learn', current?.learn === true),
              h('button', {
                type: 'button',
                onClick: async () => {
                  setError('')
                  const body = await recordFeedback('reset', '')
                  if (body?.ok !== true) setError(t('settings.resetFailed'))
                  await readSettings()
                },
                title: t('settings.resetHint'),
                style: {
                  cursor: 'pointer', border: '1px solid var(--dsw-alias-border-l1)',
                  background: 'transparent', color: 'var(--dsw-alias-label-secondary)',
                  borderRadius: '8px', padding: '5px 12px', fontSize: '12px',
                },
              }, t('settings.reset'))), { top: false })),

        h('p', {
          style: {
            fontSize: '12px', lineHeight: '1.6', margin: '20px 0 0',
            color: 'var(--dsw-alias-label-secondary)',
          },
        }, t('settings.costNote')),
        h('p', {
          style: {
            fontSize: '12px', lineHeight: '1.6', margin: '8px 0 0',
            color: 'var(--dsw-alias-label-secondary)',
          },
        }, t('settings.subagentNote')),
        error !== '' && h('p', { style: { fontSize: '12px', color: 'var(--dsw-alias-state-error-primary)', marginTop: '12px' } }, error),
      )
    }

    return {
      inject: ['slots', 'locale', 'shortcuts', 'remote', 'remote.session'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'composer-assist: dictionaries')
        // The strip reads `enabled` from the shared store, and a null store means
        // "off". Load it at activation — not when some settings page happens to mount —
        // or the feature stays invisible for the whole session.
        void readSettings()
        const t = ctx.locale.bind(NS)

        /** Every routable model, flattened for the picker; failures degrade to "follow this session". */
        const loadCatalog = async () => {
          // The Client side has no llm service (only layout, locale, sessions, slots,
          // theme, timer, workspaces), so it cannot enumerate providers itself. The Host
          // exposes the catalog over this plugin's own authenticated route instead.
          const response = await fetch(`${API}/models`)
          let body
          try {
            body = await readJsonResponse(response, 'models')
          } catch (failure) {
            // Name the realistic cause first: an unregistered route answers as plain text.
            if (!response.ok) throw new Error(`${t('settings.model.routeMissing')} (HTTP ${response.status})`)
            throw new Error(`${t('settings.model.badResponse')}: ${failure.message}`)
          }
          if (body.ok !== true) throw new Error(body.error ?? body.reason ?? t('settings.model.badResponse'))
          if (!Array.isArray(body.models)) throw new Error(t('settings.model.badResponse'))
          const rows = []
          for (const entry of body.models) {
            if (entry === null || typeof entry !== 'object') continue
            if (typeof entry.provider !== 'string' || typeof entry.id !== 'string') continue
            rows.push({
              provider: entry.provider,
              id: entry.id,
              name: typeof entry.name === 'string' && entry.name !== '' ? entry.name : entry.id,
            })
          }
          return rows
        }

        /** Settings snapshot hook shared by both surfaces. */
        const useSettings = () => {
          const [value, setValue] = useState(settingsStore.value)
          useEffect(() => {
            setValue(settingsStore.value)
            return settingsStore.subscribe(() => { setValue(settingsStore.value) })
          }, [])
          return value
        }

        /** Stable slot component: reads settings itself so its identity never changes. */
        function StripSlot(props) {
          const settings = useSettings()
          return h(React.Fragment, null,
            h(SuggestionStrip, { ...props, settings, t }),
            h(RequestTiming, { sessionId: props.sessionId, settings, t }))
        }

        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
          name: 'conversation.input.dock', id: 'composer-assist', order: 10, locale: NS,
        }, StripSlot))

        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left', id: 'composer-assist-assist', order: 10, locale: NS,
          inject: () => ({ loadCatalog }),
        }, AssistButton))

        // One page in the settings left nav; no row in General.
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'composer-assist', order: 35, locale: NS,
          // Short label: this is a nav row, and the full name lives in the menu item.
          label: () => t('settings.nav'),
          inject: () => ({ loadCatalog }),
        }, SettingsSection))

        // The painted ghost outlives the component, so unloading must release it.
        ctx.effect(() => () => { disposeGhosts() }, 'composer-assist: release inline ghost')

        // Tab accepts only in the message editor, never in another editable field.
        ctx.effect(() => ctx.shortcuts.observeFixedInput((input) => {
          if (input.type !== 'keydown') return
          if (input.gesture.code !== 'Tab') return
          if (input.gesture.shift || input.gesture.control || input.gesture.alt || input.gesture.meta) return
          if (input.gesture.composing || input.gesture.defaultPrevented) return
          if (input.context.region !== 'editable' || input.context.modal !== null) return
          const focused = document.activeElement
          if (!(focused instanceof Element) || focused.closest('[data-composer-input]') === null) return
          if (acceptRef.current?.() !== true) return
          input.consume()
        }), 'composer-assist: Tab accepts a prediction')
      },
    }
  },
})
