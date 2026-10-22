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
      'strip.dismiss': '忽略',
      'strip.confidence': '置信度',
      'strip.confidenceHigh': '较高',
      'strip.confidenceMedium': '中等',
      'strip.confidenceLow': '较低',
      'strip.thinking': '正在生成…',
      'strip.failed': '生成失败',
      'predict.again': '重新预测输入框',
      'predict.title': '预测输入框',
      'predict.busy': '预测中…',
      'polish.title': '润色提示词',
      'polish.busy': '润色中…',
      'polish.failed': '润色失败',
      'settings.title': '输入框预测',
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
      'settings.maxOutputTokens': '输出上限（token）',
      'settings.maxOutputTokensHint': '推理型模型先花推理预算，太小会导致返回空建议。',
      'settings.debounceMs': '输入停顿（毫秒）',
      'settings.debounceMsHint': '单词补全等你停手这么久才发请求。',
      'settings.timeoutMs': '超时（毫秒）',
      'settings.timeoutMsHint': '超时后静默丢弃，不打扰输入。',
      'settings.maxInputChars': '上下文上限（字符）',
      'settings.maxInputCharsHint': '发给预测模型的最近对话长度。',
      'settings.minConfidence': '置信度门槛',
      'settings.minConfidenceHint': '低于此值的预测会被丢弃；0 表示全部保留，只在建议栏标注置信度。',
      'settings.costNote': '每次预测都是一次真实计费的模型调用；关掉开关即可完全停止。',
      'settings.saveFailed': '设置保存失败',
      'settings.noModels': '当前没有可用模型，请先在「模型」设置里配置。',
      'settings.catalogFailed': '读取模型目录失败：',
    }
    const en = {
      'strip.next': 'Predicted input',
      'strip.complete': 'Draft continuation',
      'strip.accept': 'Tab to accept',
      'strip.acceptHint': 'Tab to accept (←/→ to cycle)',
      'strip.dismiss': 'Dismiss',
      'strip.confidence': 'confidence',
      'strip.confidenceHigh': 'high',
      'strip.confidenceMedium': 'medium',
      'strip.confidenceLow': 'low',
      'strip.thinking': 'Generating…',
      'strip.failed': 'Generation failed',
      'predict.again': 'Predict input again',
      'predict.title': 'Predict input',
      'predict.busy': 'Predicting…',
      'polish.title': 'Polish prompt',
      'polish.busy': 'Polishing…',
      'polish.failed': 'Polish failed',
      'settings.title': 'Composer prediction',
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
      'settings.maxOutputTokens': 'Output cap (tokens)',
      'settings.maxOutputTokensHint': 'Reasoning models spend budget on reasoning first; a small cap yields an empty suggestion.',
      'settings.debounceMs': 'Typing pause (ms)',
      'settings.debounceMsHint': 'How long the draft must stay still before completion is requested.',
      'settings.timeoutMs': 'Timeout (ms)',
      'settings.timeoutMsHint': 'A timeout drops the request silently and never blocks typing.',
      'settings.maxInputChars': 'Context cap (characters)',
      'settings.maxInputCharsHint': 'How much recent conversation is sent to the prediction model.',
      'settings.minConfidence': 'Confidence bar',
      'settings.minConfidenceHint': 'Predictions below this are dropped; 0 keeps them and only shows the confidence badge.',
      'settings.costNote': 'Every prediction is a real billed model call; switch this off to stop it entirely.',
      'settings.saveFailed': 'Could not save settings',
      'settings.noModels': 'No models are available; configure one under Models first.',
      'settings.catalogFailed': 'Could not read the model catalog: ',
    }

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
        const body = await response.json()
        if (body?.settings === undefined) throw new Error('settings response carried no settings')
        settingsStore.error = undefined
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

    async function request(kind, sessionId, draft) {
      const response = await fetch(`${API}/suggest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, sessionId, draft }),
      })
      const body = await response.json()
      if (body?.ok !== true) throw new Error(body?.error ?? 'failed')
      const text = typeof body.text === 'string' ? body.text : ''
      // Surface the Host's own explanation; an empty string alone cannot be acted on.
      if (text === '' && body.reason !== undefined) {
        reportProbe({ phase: 'empty-result', reason: body.reason, transcriptChars: body.transcriptChars })
        // A brand-new or empty session has nothing to predict from. That is not a
        // failure, so surface it as a quiet "no suggestion", not a silent no-op.
        return { text: '', candidates: [], confidence: null, reason: body.reason }
      }
      // `next` returns a candidate list; the other kinds return a single text.
      const candidates = Array.isArray(body.candidates)
        ? body.candidates.filter(item => typeof item === 'string' && item.trim() !== '').slice(0, 3)
        : []
      if (candidates.length === 0 && text !== '') candidates.push(text)
      const confidence = Number.isFinite(body.confidence) && body.confidence >= 0 && body.confidence <= 1 ? body.confidence : null
      return { text: candidates[0] ?? '', candidates, confidence }
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

    /**
     * Paint the suggestion as trailing ghost text inside the composer.
     *
     * Why not the host's `--dsh-composer-hint`: that rule lives on
     * `.input p:last-child::after`, and the host's own placeholder is an
     * absolutely-positioned sibling (`.placeholder`, inset 4/8/auto/14) that is
     * shown exactly while `draft === ''` — the very moment a prediction appears.
     * It paints after the editor, so it covers the ghost completely. A hint on an
     * empty draft can therefore never be visible.
     *
     * Instead this plugin owns one absolutely-positioned span inside the same
     * relatively-positioned `.grow` wrapper. It is behind nothing, adds no editable
     * node, and the draft text never contains it. The caret line's height and the
     * left inset are mirrored from the host's own `.input` padding.
     */
    const GHOST_CLASS = 'composer-assist-ghost'
    const GHOST_STYLE_ID = 'composer-assist-ghost-style'

    /** One stylesheet for the ghost; injected once, removed with the plugin. */
    function ensureGhostStyle() {
      if (typeof document === 'undefined' || document.getElementById(GHOST_STYLE_ID) !== null) return
      const style = document.createElement('style')
      style.id = GHOST_STYLE_ID
      style.textContent = `
.${GHOST_CLASS} {
  position: absolute;
  left: 14px;
  right: 8px;
  top: 4px;
  pointer-events: none;
  user-select: none;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  color: var(--dsw-alias-label-caption);
  opacity: 0.75;
}
.${GHOST_CLASS}[hidden] { display: none; }
/* The host's own placeholder occupies the same line and inset; showing both
   stacks two sentences on one baseline. While a ghost is visible it stands in
   for the placeholder. */
.grow:has(> .${GHOST_CLASS}:not([hidden])) [data-composer-placeholder] { display: none; }
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

    /** The element whose absolutely-positioned children sit over the editor. */
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

    /** Show, update, or hide the ghost. An empty string hides it without removing it. */
    function paintGhost(element, text) {
      const span = element === undefined ? undefined : ghostSpanFor(element)
      if (span === undefined || span === null) return
      if (text === '') {
        span.hidden = true
        span.textContent = ''
        return
      }
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
      for (const span of document.querySelectorAll(`.${GHOST_CLASS}`)) {
        span.hidden = true
        span.textContent = ''
      }
    }

    /** Drop the injected stylesheet and every ghost span; called once on unload. */
    function disposeGhosts() {
      if (typeof document === 'undefined') return
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
    function runRequest(kind, sessionId, draft, cause) {
      const id = nextRequestId(sessionId)
      reportProbe({ phase: 'begin', trace: `req-${id}`, owner: sessionId, kind, cause })
      return request(kind, sessionId, draft).then((result) => {
        const stale = id !== currentRequestId(sessionId)
        reportProbe({ phase: 'result', trace: `req-${id}`, kind,
          textLength: result.text.length, stale, owner: sessionId, confidence: result.confidence })
        if (result.text === '') return null
        // `next` carries a candidate list and a confidence; the other kinds stay single.
        const record = {
          kind, text: result.text, draftAt: draft,
          candidates: result.candidates, confidence: result.confidence,
        }
        if (!stale) rememberSuggestion(sessionId, record)
        return record
      }).catch(() => null)
    }

    /**
     * Per-session request sequence. Ownership of an in-flight request cannot live in
     * a component instance: switching conversations unmounts the strip and a fresh
     * `useRef` would restart at zero, marking the pending result stale.
     */
    const requestSeqBySession = new Map()

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
    const suggestionBySession = new Map()

    /**
     * Which candidate of the stored suggestion is currently shown, per session.
     * Kept separate from the suggestion because switching it is a UI action that
     * must survive a conversation switch just like the suggestion itself.
     */
    const candidateIndexBySession = new Map()

    /** Monotonic instance counter for mount/unmount tracing. */
    let instanceSeq = 0

    /** Sessions whose prediction is currently generating. */
    const pendingBySession = new Set()

    /** Notified whenever any session's stored suggestion changes. */
    const storeListeners = new Set()

    /** Subscribe to store changes; returns the unsubscribe. */
    function onStoreChange(listener) {
      storeListeners.add(listener)
      return () => { storeListeners.delete(listener) }
    }

    /** Notify every subscriber after a store mutation. */
    function publishStore() {
      for (const listener of [...storeListeners]) { try { listener() } catch { /* one bad subscriber */ } }
    }

    /** Remember or forget one session's pending suggestion. */
    function rememberSuggestion(sessionId, value) {
      if (sessionId === undefined) return
      if (value === null) {
        suggestionBySession.delete(sessionId)
        candidateIndexBySession.delete(sessionId)
      } else {
        suggestionBySession.delete(sessionId)
        suggestionBySession.set(sessionId, value)
        // A fresh prediction always starts on its first candidate.
        candidateIndexBySession.set(sessionId, 0)
      }
      while (suggestionBySession.size > 8) suggestionBySession.delete(suggestionBySession.keys().next().value)
      publishStore()
    }

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

    const stripStyle = {
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      // Align with the composer card: same cap and the same side clearances the
      // host uses for its own dock cards, centred in the stack.
      // Measured against the live card: this slot is a sibling of the input bar, and
      // the bar's own wrapper carries `padding: 0 <side-clearance>`. Without the same
      // inset here the bar is exactly one clearance too wide on each side
      // (observed delta: -16 / +16). Pull both sides in by that clearance.
      boxSizing: 'border-box',
      width: 'calc(100% - 2 * var(--dsh-composer-side-clearance, 16px))',
      maxWidth: 'var(--dsh-composer-card-max-width)',
      margin: '0 auto 8px', padding: '10px 12px 10px 14px', borderRadius: '12px',
      // Brand-tinted so the card reads as "the assistant spoke" at a glance.
      border: '1px solid var(--dsw-alias-brand-primary)',
      borderLeft: '4px solid var(--dsw-alias-brand-primary)',
      background: 'var(--dsw-alias-bg-layer-1)',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.06)',
      color: 'var(--dsw-alias-label-primary)',
      fontSize: '13px', lineHeight: '1.55',
    }
    const stripBadge = {
      flex: '0 0 auto', fontSize: '11px', fontWeight: '600',
      color: 'var(--dsw-alias-brand-primary)', letterSpacing: '0.02em',
      paddingTop: '1px', whiteSpace: 'nowrap',
    }
    const stripText = {
      flex: '1 1 auto', minWidth: 0, color: 'var(--dsw-alias-label-primary)',
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    }
    const stripActions = { flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '6px' }

    /** One suggestion strip: renders nothing when there is nothing to offer. */
    function SuggestionStrip({ sessionId, useInput, useSession, inputActions, settings, t }) {
      const draft = useInput(state => state.draft)
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
      // Typing does NOT discard a suggestion: it stays until accepted, dismissed,
      // superseded by a newer prediction, or the session changes.

      /**
       * @param via - 'accept' consumes it, 'dismiss' forgets it, 'hide' only hides it.
       *   A hide keeps the store intact, so leaving and returning to the session
       *   restores the suggestion instead of losing it to an unrelated keypress.
       */
      const clear = (via) => {
        reportProbe({ phase: 'clear', via: via ?? 'unknown', instanceId: instanceId.current,
          sessionId, hadPending: pending !== null })
        nextRequestId(sessionId)
        if (via !== 'hide') rememberSuggestion(sessionId, null)
        setPending(null); setBusy(false); setFailed(false)
        for (const listener of listeners) listener()
      }

      const ask = async (kind, at, cause) => {
        const owner = sessionId
        reportProbe({ phase: 'request', kind, cause: cause ?? 'unknown', draft: at, owner })
        // Session-scoped, so the generating state survives a switch.
        pendingBySession.add(owner)
        publishStore()
        setBusy(true); setFailed(false)
        // The request and its store write belong to the MODULE: a session switch may
        // unmount this strip while the request is in flight, and the result must
        // still land where a later mount can read it.
        const record = await runRequest(kind, owner, at, cause)
        pendingBySession.delete(owner)
        publishStore()
        if (sessionIdRef.current === owner) {
          // An empty result means "nothing this time": keep whatever the store holds
          // for this session instead of blanking the bar or flagging a failure.
          const stored = suggestionBySession.get(owner)
          setPending(stored === undefined ? null : { ...stored })
          setBusy(false)
          for (const listener of listeners) listener()
        }
      }

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
            const seen = await peek.json()
            if (stopped || seen?.turn === null || seen?.turn === undefined) return
            // A draft in progress means the user is already writing; leave the
            // boundary UNCONSUMED so it can still serve them after they clear it.
            // (The old code consumed it here, which is why a finished turn could
            // produce nothing at all.)
            if (draftRef.current !== '') return
            // Claim, then ask. Only a successful claim may drop the suggestion.
            const claim = await fetch(`${API}/turn?sessionId=${encodeURIComponent(sessionId)}&consume=1`)
            const claimed = await claim.json()
            if (claimed?.turn === null || claimed?.turn === undefined) return
            if (blank) return
            // Issued even if this instance unmounts next tick: ask() writes to the
            // module store, which is what a later mount reads.
            void ask('next', '', 'turn-end')
          } catch { /* a missed poll just means no prediction for that turn */ }
        }
        void poll()
        const timers = []
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
        if (draft.trim() === '') return
        if (pending !== null && pending.draftAt === draft) return
        const timer = setTimeout(() => { void ask('complete', draft, 'typing') }, settings?.debounceMs ?? 600)
        return () => { clearTimeout(timer) }
      }, [draft, enabled, mode, sessionId, settings?.debounceMs])

      // Mirror the live handlers on every render. The button lives in another slot
      // and may mount earlier, so it always reads the CURRENT closure instead of a
      // stale one captured on the first render.
      askRef.current = ask
      pendingRef.current = pending
      manualRequest.current = (kind) => {
        reportProbe({ phase: 'manual-fire', kind: kind ?? 'next', hasAsk: askRef.current !== undefined, enabled })
        void askRef.current?.(kind ?? 'next', draftRef.current, 'manual')
      }
      manualRequest.hasSuggestion = () => pendingRef.current !== null
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
        acceptRef.current = () => {
          if (pending === null) return false
          // Never accept a suggestion that the store says belongs to another session.
          const stored = suggestionBySession.get(sessionId)
          if (stored === null || stored === undefined) return false
          // Accept whatever candidate is currently shown, not necessarily the first.
          const text = currentCandidate(sessionId)
          if (stored.kind === 'next') inputActions.setDraft(text)
          else if (stored.kind === 'complete') inputActions.setDraft(`${draftRef.current}${text}`)
          else inputActions.setDraft(text)
          void recordFeedback('accept', text)
          clear('accept')
          return true
        }
        return () => { acceptRef.current = undefined }
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
          if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && draftRef.current === '') {
            if (cycleCandidate(sessionId, event.key === 'ArrowRight' ? 1 : -1)) {
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

      const inline = settings?.display === 'inline'
      const ghost = !enabled || pending === null ? '' : currentCandidate(sessionId)

      // The ghost lives over the composer surface, not in this component's tree, so
      // it is reconciled on every relevant change and released on unmount.
      useEffect(() => {
        if (!inline) { clearGhosts(); return undefined }
        ensureGhostStyle()
        const element = composerInputElement()
        if (element === undefined) return undefined
        paintGhost(element, ghost)
        reportProbe({ phase: 'paint', ghost })
        return undefined
      }, [ghost, inline, sessionId])
      useEffect(() => () => { clearGhosts() }, [])

      // Record the render decision: this is the only place that can explain a bar
      // that should be visible but is not.
      reportProbe({ phase: 'render', instanceId: instanceId.current, sessionId,
        enabled, inline, hasPending: pending !== null, busy, failed,
        willRender: enabled && (pending !== null || busy || failed) })
      if (!enabled) return null
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
      const confidence = stored?.confidence
      // Built here rather than via locale interpolation: the locale helper's
      // placeholder behaviour is not verified, and numbers need no translation.
      const counter = total > 1 ? `${candidateIndex(sessionId) + 1}/${total}` : ''
      // The model's number is its own rough guess, so it is labelled as such and
      // rounded to a coarse band: a made-up 73% would read as a real probability.
      const confidenceText = typeof confidence === 'number'
        ? `${t('strip.confidence')} ${confidence >= 0.7 ? t('strip.confidenceHigh')
          : confidence >= 0.4 ? t('strip.confidenceMedium') : t('strip.confidenceLow')}`
        : null

      // Standalone suggestion bar above the composer. Its own element and its own
      // line, so it can never collide with the composer placeholder.
      return h('div', { style: stripStyle, role: 'status', 'aria-live': 'polite', 'data-composer-assist-bar': '' },
        h('span', { style: stripBadge }, badge),
        confidenceText !== null && h('span', {
          style: {
            flex: '0 0 auto', fontSize: '10px', fontWeight: '600',
            color: confidence >= 0.7 ? 'var(--dsw-alias-label-secondary)' : 'var(--dsw-alias-label-tertiary)',
            paddingTop: '2px', whiteSpace: 'nowrap',
          },
        }, confidenceText),
        h('span', { style: stripText }, pending !== null ? text : ''),
        counter !== '' && h('span', { style: stripBadge }, counter),
        h('span', { style: stripActions },
          pending !== null && h('button', {
            type: 'button',
            onClick: () => { acceptRef.current?.() },
            title: total > 1 ? t('strip.acceptHint') : t('strip.accept'),
            style: {
              cursor: 'pointer', border: 'none',
              background: 'var(--dsw-alias-brand-primary)',
              color: 'var(--dsw-alias-bg-base)',
              borderRadius: '6px', padding: '3px 12px',
              fontSize: '12px', fontWeight: '600', lineHeight: '1.6',
              whiteSpace: 'nowrap',
            },
          }, t('strip.accept')),
          pending !== null && h('button', {
            type: 'button',
            onClick: () => {
              void recordFeedback('dismiss', currentCandidate(sessionId))
              clear('dismiss')
            },
            title: t('strip.dismiss'),
            style: {
              cursor: 'pointer', border: '1px solid var(--dsw-alias-border-l1)',
              background: 'transparent', color: 'var(--dsw-alias-label-secondary)',
              borderRadius: '6px', padding: '3px 10px', fontSize: '12px', lineHeight: '1.6',
              whiteSpace: 'nowrap',
            },
          }, t('strip.dismiss')),
        ),
      )
    }

    /** Predict the next message on demand, from the composer tool row. */
    function PredictButton({ t }) {
      const [busy, setBusy] = useState(false)
      const [hasSuggestion, setHasSuggestion] = useState(false)
      const busyTimer = useRef(undefined)

      // Mirror the strip's pending state so the label can say "regenerate" when one
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

      const run = () => {
        const fire = manualRequest.current
        // Report the miss: a silent no-op is indistinguishable from a dead button.
        if (fire === undefined) { reportProbe({ phase: 'click-miss', reason: 'no-channel' }); return }
        if (busyTimer.current !== undefined) return
        setBusy(true)
        reportProbe({ phase: 'manual-fire', cause: 'click' })
        // Release on a timer this component owns. A cross-component "settled"
        // callback depends on the strip re-rendering, which can be skipped — that
        // left the button permanently disabled. 3s is a floor, not a correctness
        // dependency: the request itself keeps running regardless.
        busyTimer.current = setTimeout(() => {
          busyTimer.current = undefined
          setBusy(false)
        }, 3000)
        try { fire('next') } catch { /* the strip reports its own failures */ }
      }

      const label = busy ? t('predict.busy')
        : hasSuggestion ? t('predict.again') : t('predict.title')

      return h('button', {
        type: 'button',
        onClick: run,
        // Deliberately NOT disabled: a stuck `busy` would make the button
        // unclickable with no way back. The handler guards against re-entry.
        'aria-disabled': busy || undefined,
        title: label,
        'aria-label': label,
        style: {
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          cursor: busy ? 'default' : 'pointer',
          border: '1px solid var(--dsw-alias-border-l1)',
          background: 'transparent',
          color: 'var(--dsw-alias-label-secondary)',
          borderRadius: '8px', padding: '4px 10px',
          fontSize: '12px', fontWeight: '600', lineHeight: '1.6',
          whiteSpace: 'nowrap',
          opacity: busy ? '0.6' : '1',
        },
      }, busy ? [h('span', { key: 'dot', 'aria-hidden': true }, '\u22ef'), h('span', { key: 'label' }, label)]
        : [h('span', { key: 'icon', 'aria-hidden': true }, '\u2192'), h('span', { key: 'label' }, label)])
    }

    /** ✨ button in the composer tool row; rewrites the current draft into it. */
    function PolishButton({ sessionId, useInput, inputActions, t }) {
      const draft = useInput(state => state.draft)
      const phase = useInput(state => state.phase)
      const [busy, setBusy] = useState(false)
      const [failed, setFailed] = useState(false)
      const idle = draft.trim() !== '' && phase === 'plain' && !busy

      const run = async () => {
        if (!idle) return
        setBusy(true); setFailed(false)
        try {
          // `request` answers with a record; polish only needs its text.
          const { text } = await request('polish', sessionId, draft)
          if (text !== '') inputActions.setDraft(text)
        } catch {
          setFailed(true)
        } finally {
          setBusy(false)
        }
      }

      return h('button', {
        type: 'button',
        onClick: () => { void run() },
        disabled: !idle,
        title: failed ? t('polish.failed') : busy ? t('polish.busy') : t('polish.title'),
        'aria-label': t('polish.title'),
        style: {
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          cursor: idle ? 'pointer' : 'default',
          // Idle is brand-tinted and readable; disabled stays visible but clearly inert.
          border: idle ? '1px solid var(--dsw-alias-brand-primary)' : '1px solid var(--dsw-alias-border-l1)',
          background: idle ? 'var(--dsw-alias-bg-layer-1)' : 'transparent',
          color: failed ? 'var(--dsw-alias-state-error-primary)'
            : idle ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)',
          borderRadius: '8px', padding: '4px 10px',
          fontSize: '12px', fontWeight: '600', lineHeight: '1.6',
          whiteSpace: 'nowrap',
        },
      }, busy ? t('polish.busy')
        : [h('span', { key: 'icon', 'aria-hidden': true }, '✨'), h('span', { key: 'label' }, t('polish.title'))])
    }

    /** Full settings page in the left nav: switch, mode, model, and the numbers. */
    function SettingsSection({ t, loadCatalog }) {
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
      const refreshCatalog = async () => {
        if (catalog.length > 0) return
        try {
          const rows = await loadCatalog()
          if (Array.isArray(rows)) setCatalog(rows)
          if (Array.isArray(rows) && rows.length === 0) setError(t('settings.noModels'))
        } catch (failure) {
          setError(`${t('settings.catalogFailed')}${failure instanceof Error ? failure.message : String(failure)}`)
        }
      }

      const current = settings
      const card = {
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '12px',
        background: 'var(--dsw-alias-bg-layer-1)',
        padding: '4px 16px',
        marginBottom: '12px',
      }
      const row = {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '16px', padding: '14px 0',
        borderTop: '1px solid var(--dsw-alias-border-l1)',
      }
      const first = { ...row, borderTop: 'none' }
      const labelStyle = { fontSize: '13px', color: 'var(--dsw-alias-label-primary)' }
      const hintStyle = { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', marginTop: '2px' }
      const selectStyle = {
        background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)',
        border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '8px',
        padding: '6px 10px', fontSize: '13px', minWidth: '220px',
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

      return h('div', { style: { padding: '8px 0 24px' } },
        h('h2', { style: { fontSize: '16px', margin: '0 0 6px', color: 'var(--dsw-alias-label-primary)' } },
          t('settings.title')),
        h('p', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', margin: '0 0 16px' } },
          t('settings.description')),

        h('div', { style: card },
          h('div', { style: first },
            h('div', null,
              h('div', { style: labelStyle }, t('settings.enabled')),
              h('div', { style: hintStyle }, t('settings.enabledHint'))),
            h('input', {
              type: 'checkbox',
              checked: current?.enabled === true,
              onChange: event => { void save({ enabled: event.target.checked }) },
            })),
          h('div', { style: row },
            h('div', null,
              h('div', { style: labelStyle }, t('settings.learn')),
              h('div', { style: hintStyle }, t('settings.learnHint'))),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
              h('input', {
                type: 'checkbox',
                checked: current?.learn === true,
                onChange: event => { void save({ learn: event.target.checked }) },
              }),
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
                  borderRadius: '8px', padding: '4px 10px', fontSize: '12px',
                },
              }, t('settings.reset')))),
          h('div', { style: row },
            h('div', null,
              h('div', { style: labelStyle }, t('settings.mode')),
              h('div', { style: hintStyle }, t('settings.modeHint'))),
            h('select', {
              style: selectStyle,
              value: current?.mode ?? 'auto',
              onChange: event => { void save({ mode: event.target.value }) },
            }, ['auto', 'word', 'both', 'off'].map(mode => h('option', { key: mode, value: mode }, t(`settings.mode.${mode}`))))),
          h('div', { style: row },
            h('div', null,
              h('div', { style: labelStyle }, t('settings.display')),
              h('div', { style: hintStyle }, t('settings.displayHint'))),
            h('select', {
              style: selectStyle,
              value: current?.display === 'inline' ? 'inline' : 'bar',
              onChange: event => { void save({ display: event.target.value }) },
            }, ['bar', 'inline'].map(display => h('option', { key: display, value: display }, t(`settings.display.${display}`))))),
          h('div', { style: row },
            h('div', null,
              h('div', { style: labelStyle }, t('settings.model')),
              h('div', { style: hintStyle }, t('settings.modelHint'))),
            h('select', {
              style: selectStyle,
              value,
              onFocus: () => { void refreshCatalog() },
              onChange: event => {
                const raw = event.target.value
                if (raw === '') { void save({ provider: '', model: '' }); return }
                const [provider, model] = raw.split('\u0000')
                void save({ provider, model })
              },
            },
            h('option', { value: '' }, t('settings.model.inherit')),
            catalog.map(entry => h('option', { key: `${entry.provider}\u0000${entry.id}`, value: `${entry.provider}\u0000${entry.id}` }, `${entry.provider} · ${entry.name}`)))),
        ),

        h('div', { style: card },
          h('div', { style: first },
            h('div', null,
              h('div', { style: labelStyle }, t('settings.maxOutputTokens')),
              h('div', { style: hintStyle }, t('settings.maxOutputTokensHint'))),
            number('maxOutputTokens', 100, 4000)),
          h('div', { style: row },
            h('div', null,
              h('div', { style: labelStyle }, t('settings.debounceMs')),
              h('div', { style: hintStyle }, t('settings.debounceMsHint'))),
            number('debounceMs', 200, 5000)),
          h('div', { style: row },
            h('div', null,
              h('div', { style: labelStyle }, t('settings.timeoutMs')),
              h('div', { style: hintStyle }, t('settings.timeoutMsHint'))),
            number('timeoutMs', 2000, 120000)),
          h('div', { style: row },
            h('div', null,
              h('div', { style: labelStyle }, t('settings.maxInputChars')),
              h('div', { style: hintStyle }, t('settings.maxInputCharsHint'))),
            number('maxInputChars', 1000, 100000)),
          h('div', { style: row },
            h('div', null,
              h('div', { style: labelStyle }, t('settings.minConfidence')),
              h('div', { style: hintStyle }, t('settings.minConfidenceHint'))),
            number('minConfidence', 0, 1)),
        ),

        h('p', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', margin: '4px 0 0' } },
          t('settings.costNote')),
        error !== '' && h('p', { style: { fontSize: '12px', color: 'var(--dsw-alias-state-error-primary)' } }, error),
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
          const result = await ctx.remote.session.modelCatalog()
          if (result?.ok !== true) throw new Error(result?.error?.message ?? 'model catalog unavailable')
          const rows = []
          for (const group of result.value.groups) {
            for (const model of group.models) rows.push({ provider: group.id, id: model.id, name: model.name })
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
          return h(SuggestionStrip, { ...props, settings: useSettings(), t })
        }

        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
          name: 'conversation.input.dock', id: 'composer-assist', order: 10, locale: NS,
        }, StripSlot))

        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left', id: 'composer-assist-predict', order: 9, locale: NS,
        }, PredictButton))

        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left', id: 'composer-assist-polish', order: 10, locale: NS,
        }, PolishButton))

        // One page in the settings left nav; no row in General.
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'composer-assist', order: 35, locale: NS,
          label: () => t('settings.title'),
          inject: () => ({ loadCatalog }),
        }, SettingsSection))

        // The painted ghost outlives the component, so unloading must release it.
        ctx.effect(() => () => { disposeGhosts() }, 'composer-assist: release inline ghost')

        // Tab accepts only on an editable target outside any modal, and only when a
        // suggestion is actually pending; everything else passes through untouched.
        ctx.effect(() => ctx.shortcuts.observeFixedInput((input) => {
          if (input.type !== 'keydown') return
          if (input.gesture.code !== 'Tab') return
          if (input.gesture.shift || input.gesture.control || input.gesture.alt || input.gesture.meta) return
          if (input.gesture.composing || input.gesture.defaultPrevented) return
          if (input.context.region !== 'editable' || input.context.modal !== null) return
          if (acceptRef.current?.() !== true) return
          input.consume()
        }), 'composer-assist: Tab accepts a prediction')
      },
    }
  },
})
