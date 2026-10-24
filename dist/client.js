(() => {
  // composer-assist-client.js
  window.__ModuleLoader__.load({
    id: "dsh-composer-assist",
    factory(require2) {
      const React = require2("react");
      const h = React.createElement;
      const { useEffect, useRef, useState } = React;
      const NS = "composerAssist";
      const API = "/api/composer-assist";
      const zh = {
        "strip.next": "\u9884\u6D4B\u8F93\u5165\u6846",
        "strip.complete": "\u8865\u5168\u8349\u7A3F",
        "strip.accept": "Tab \u63A5\u53D7",
        "strip.acceptHint": "Tab \u63A5\u53D7\uFF08\u2190/\u2192 \u5207\u6362\u5019\u9009\uFF09",
        "strip.preview": "\u9884\u89C8 \xB7 \u672A\u586B\u5165\u8349\u7A3F",
        "strip.cycle": "\u2190/\u2192 \u5207\u6362\u5019\u9009",
        "strip.dismiss": "\u5FFD\u7565",
        "strip.draftChanged": "\u8349\u7A3F\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u9884\u6D4B",
        "strip.confidence": "\u7F6E\u4FE1\u5EA6",
        "strip.picked": "\u5DF2\u9009",
        "strip.candidates": "\u5019\u9009\u5EFA\u8BAE",
        "strip.rowLabel": "\u7B2C {n} \u6761\uFF0C\u5171 {total} \u6761",
        "strip.confidenceHigh": "\u8F83\u9AD8",
        "strip.confidenceMedium": "\u4E2D\u7B49",
        "strip.confidenceLow": "\u8F83\u4F4E",
        "strip.thinking": "\u6B63\u5728\u751F\u6210\u2026",
        "strip.failed": "\u751F\u6210\u5931\u8D25",
        "predict.again": "\u91CD\u65B0\u9884\u6D4B\u8F93\u5165\u6846",
        "predict.short": "\u9884\u6D4B",
        "predict.title": "\u9884\u6D4B\u8F93\u5165\u6846",
        "predict.busy": "\u9884\u6D4B\u4E2D\u2026",
        "polish.short": "\u6DA6\u8272",
        "polish.title": "\u6DA6\u8272\u63D0\u793A\u8BCD",
        "polish.busy": "\u6DA6\u8272\u4E2D\u2026",
        "polish.failed": "\u6DA6\u8272\u5931\u8D25",
        "assist.title": "\u6DA6\u8272\u6216\u9884\u6D4B\u8F93\u5165\u6846",
        "assist.more": "\u66F4\u591A\u64CD\u4F5C\u4E0E\u8BBE\u7F6E",
        "settings.title": "\u8F93\u5165\u6846\u9884\u6D4B",
        "settings.nav": "\u9884\u6D4B",
        "settings.restore": "\u6062\u590D\u9ED8\u8BA4\u503C",
        "settings.restoreHint": "\u628A\u8FD9\u51E0\u4E2A\u6570\u503C\u6539\u56DE\u63D2\u4EF6\u9ED8\u8BA4\u503C\uFF0C\u4E0D\u52A8\u5F00\u5173\u548C\u6A21\u578B\u9009\u62E9\u3002",
        "settings.description": "\u5728\u8F93\u5165\u6846\u4E0A\u65B9\u9884\u6D4B\u4F60\u60F3\u8F93\u5165\u7684\u5185\u5BB9\u3001\u8865\u5168\u8349\u7A3F\uFF0C\u6216\u70B9 \u2728 \u6DA6\u8272\u63D0\u793A\u8BCD\u3002",
        "settings.enabled": "\u542F\u7528",
        "settings.learn": "\u63A5\u53D7\u5B66\u4E60",
        "settings.learnHint": "\u8BB0\u5F55\u4F60\u63A5\u53D7/\u5FFD\u7565\u7684\u5EFA\u8BAE\u6765\u8C03\u6574\u540E\u7EED\u9884\u6D4B\u3002\u9ED8\u8BA4\u5173\u95ED\u3002",
        "settings.reset": "\u6E05\u9664\u7EDF\u8BA1",
        "settings.resetHint": "\u6E05\u7A7A\u5DF2\u8BB0\u5F55\u7684\u63A5\u53D7/\u5FFD\u7565\u8BA1\u6570\u3002",
        "settings.resetFailed": "\u6E05\u9664\u7EDF\u8BA1\u5931\u8D25",
        "settings.mode": "\u6A21\u5F0F",
        "settings.mode.auto": "\u81EA\u52A8\u9884\u6D4B\uFF08\u56DE\u590D\u7ED3\u675F\u540E\uFF09",
        "settings.mode.word": "\u5355\u8BCD\u8865\u5168\uFF08\u8F93\u5165\u65F6\uFF09",
        "settings.mode.both": "\u4E24\u8005\u90FD\u8981",
        "settings.mode.off": "\u53EA\u5728\u624B\u52A8\u8C03\u7528\u65F6",
        "settings.display": "\u663E\u793A\u4F4D\u7F6E",
        "settings.displayHint": "\u5EFA\u8BAE\u680F = \u8F93\u5165\u6846\u4E0A\u65B9\u72EC\u7ACB\u4E00\u884C\uFF08\u63A8\u8350\uFF09\uFF1B\u884C\u5185 = \u753B\u5728\u8F93\u5165\u6846\u91CC\u3002",
        "settings.display.bar": "\u8F93\u5165\u6846\u4E0A\u65B9\u7684\u5EFA\u8BAE\u680F\uFF08\u63A8\u8350\uFF09",
        "settings.display.inline": "\u8F93\u5165\u6846\u5185",
        "settings.model": "\u9884\u6D4B\u6A21\u578B",
        "settings.model.inherit": "\u8DDF\u968F\u672C\u4F1A\u8BDD\u6A21\u578B",
        "settings.enabledHint": "\u5173\u95ED\u540E\u884C\u4E3A\u4E0E\u672A\u5B89\u88C5\u65F6\u5B8C\u5168\u4E00\u81F4\u3002",
        "settings.modeHint": "\u81EA\u52A8 = \u6BCF\u8F6E\u56DE\u7B54\u540E\u9884\u6D4B\u4E00\u6B21\uFF1B\u5355\u8BCD = \u8F93\u5165\u65F6\u8865\u5168\u540E\u534A\u53E5\u3002",
        "settings.modelHint": "\u7559\u7A7A\u5219\u8DDF\u968F\u672C\u4F1A\u8BDD\u4E0A\u6B21\u771F\u5B9E\u7528\u8FC7\u7684\u6A21\u578B\u3002",
        "settings.model.search": "\u641C\u7D22\u6A21\u578B\u6216\u4F9B\u5E94\u5546",
        "settings.model.noMatch": "\u6CA1\u6709\u5339\u914D\u7684\u6A21\u578B",
        "settings.model.loading": "\u6B63\u5728\u8BFB\u53D6\u6A21\u578B\u5217\u8868\u2026",
        "settings.model.routeMissing": "\u65E0\u6CD5\u8BFB\u53D6\u6A21\u578B\u5217\u8868\uFF1A\u5BBF\u4E3B\u63A5\u53E3\u672A\u5C31\u7EEA\uFF0C\u8BF7\u91CD\u542F DSH \u540E\u91CD\u8BD5",
        "settings.model.badResponse": "\u5BBF\u4E3B\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u6A21\u578B\u5217\u8868",
        "settings.group.behavior": "\u884C\u4E3A",
        "settings.group.budget": "\u9650\u5236\u4E0E\u5F00\u9500",
        "settings.summary.on": "\u5DF2\u542F\u7528",
        "settings.group.learning": "\u5B66\u4E60",
        "settings.summary.off": "\u5DF2\u5173\u95ED",
        "settings.maxOutputTokens": "\u8F93\u51FA\u4E0A\u9650",
        "settings.maxOutputTokensHint": "\u63A8\u7406\u578B\u6A21\u578B\u5148\u82B1\u63A8\u7406\u9884\u7B97\uFF0C\u592A\u5C0F\u4F1A\u5BFC\u81F4\u8FD4\u56DE\u7A7A\u5EFA\u8BAE\u3002",
        "settings.debounceMs": "\u8F93\u5165\u505C\u987F",
        "settings.debounceMsHint": "\u5355\u8BCD\u8865\u5168\u7B49\u4F60\u505C\u624B\u8FD9\u4E48\u4E45\u624D\u53D1\u8BF7\u6C42\u3002",
        "settings.timeoutMs": "\u8D85\u65F6",
        "settings.timeoutMsHint": "\u8D85\u65F6\u540E\u9759\u9ED8\u4E22\u5F03\uFF0C\u4E0D\u6253\u6270\u8F93\u5165\u3002\u5355\u6B21\u6A21\u578B\u8C03\u7528\u7684\u4E0A\u9650\u3002",
        "settings.maxInputChars": "\u4E0A\u4E0B\u6587\u4E0A\u9650",
        "settings.maxInputCharsHint": "\u53D1\u7ED9\u9884\u6D4B\u6A21\u578B\u7684\u6700\u8FD1\u5BF9\u8BDD\u957F\u5EA6\u3002",
        "settings.minConfidence": "\u7F6E\u4FE1\u5EA6\u95E8\u69DB",
        "settings.minConfidenceHint": "\u4F4E\u4E8E\u6B64\u503C\u7684\u9884\u6D4B\u4F1A\u88AB\u4E22\u5F03\uFF1B0 \u8868\u793A\u5168\u90E8\u4FDD\u7559\uFF0C\u53EA\u5728\u5EFA\u8BAE\u680F\u6807\u6CE8\u7F6E\u4FE1\u5EA6\u3002",
        "settings.costNote": "\u6BCF\u6B21\u9884\u6D4B\u90FD\u662F\u4E00\u6B21\u771F\u5B9E\u8BA1\u8D39\u7684\u6A21\u578B\u8C03\u7528\uFF1B\u5173\u6389\u5F00\u5173\u5373\u53EF\u5B8C\u5168\u505C\u6B62\u3002",
        "settings.saveFailed": "\u8BBE\u7F6E\u4FDD\u5B58\u5931\u8D25",
        "settings.noModels": "\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u6A21\u578B\uFF0C\u8BF7\u5148\u5728\u300C\u6A21\u578B\u300D\u8BBE\u7F6E\u91CC\u914D\u7F6E\u3002",
        "settings.catalogFailed": "\u8BFB\u53D6\u6A21\u578B\u76EE\u5F55\u5931\u8D25\uFF1A",
        "settings.open": "\u8F93\u5165\u6846\u9884\u6D4B\u8BBE\u7F6E",
        "settings.close": "\u5173\u95ED",
        "settings.subagentNote": "\u5B50\u667A\u80FD\u4F53\u53EF\u7528\u7684\u6A21\u578B\u7531 DSH \u539F\u751F\u300C\u5B50\u667A\u80FD\u4F53\u6A21\u578B\u9009\u62E9\u8BBE\u7F6E\u300D\u7BA1\u7406\uFF0C\u4E0D\u5728\u672C\u63D2\u4EF6\u91CC\u6539\u3002"
      };
      const en = {
        "strip.next": "Predicted input",
        "strip.complete": "Draft continuation",
        "strip.accept": "Tab to accept",
        "strip.acceptHint": "Tab to accept (\u2190/\u2192 to cycle)",
        "strip.preview": "Preview \xB7 not inserted",
        "strip.cycle": "\u2190/\u2192 switch candidates",
        "strip.dismiss": "Dismiss",
        "strip.draftChanged": "Draft changed; predict again",
        "strip.confidence": "confidence",
        "strip.picked": "ticked",
        "strip.candidates": "Candidate suggestions",
        "strip.rowLabel": "Candidate {n} of {total}",
        "strip.confidenceHigh": "high",
        "strip.confidenceMedium": "medium",
        "strip.confidenceLow": "low",
        "strip.thinking": "Generating\u2026",
        "strip.failed": "Generation failed",
        "predict.again": "Predict input again",
        "predict.short": "Predict",
        "predict.title": "Predict input",
        "predict.busy": "Predicting\u2026",
        "polish.short": "Polish",
        "polish.title": "Polish prompt",
        "polish.busy": "Polishing\u2026",
        "polish.failed": "Polish failed",
        "assist.title": "Polish or predict the composer",
        "assist.more": "More actions and settings",
        "settings.title": "Composer prediction",
        "settings.nav": "Prediction",
        "settings.restore": "Restore defaults",
        "settings.restoreHint": "Resets these numbers to the plugin defaults; leaves switches and model choice alone.",
        "settings.description": "Predict what you are about to type, complete a draft, or polish it with \u2728.",
        "settings.enabled": "Enabled",
        "settings.learn": "Acceptance learning",
        "settings.learnHint": "Remember what you accept and dismiss to tune later predictions. Off by default.",
        "settings.reset": "Clear stats",
        "settings.resetHint": "Erase the recorded accept/dismiss counters.",
        "settings.resetFailed": "Could not clear the stats",
        "settings.mode": "Mode",
        "settings.mode.auto": "Auto (after a reply)",
        "settings.mode.word": "Word completion (while typing)",
        "settings.mode.both": "Both",
        "settings.mode.off": "Manual only",
        "settings.display": "Where it shows",
        "settings.displayHint": "Bar is its own row above the composer (recommended); Inline draws it inside.",
        "settings.display.bar": "Bar above the composer (recommended)",
        "settings.display.inline": "Inside the composer",
        "settings.model": "Prediction model",
        "settings.model.inherit": "Follow this session",
        "settings.enabledHint": "Off behaves exactly like the plugin not being installed.",
        "settings.modeHint": "Auto = once after each reply; Word = continue the draft while typing.",
        "settings.modelHint": "Empty follows the model this session actually used last.",
        "settings.model.search": "Search models or providers",
        "settings.model.noMatch": "No matching model",
        "settings.model.loading": "Loading models\u2026",
        "settings.model.routeMissing": "Cannot read models: the Host route is not ready; restart DSH and retry",
        "settings.model.badResponse": "The Host returned an unreadable model list",
        "settings.group.behavior": "Behaviour",
        "settings.group.budget": "Limits and cost",
        "settings.summary.on": "On",
        "settings.group.learning": "Learning",
        "settings.summary.off": "Off",
        "settings.maxOutputTokens": "Output cap",
        "settings.maxOutputTokensHint": "Reasoning models spend budget on reasoning first; a small cap yields an empty suggestion.",
        "settings.debounceMs": "Typing pause",
        "settings.debounceMsHint": "How long the draft must stay still before completion is requested.",
        "settings.timeoutMs": "Timeout",
        "settings.timeoutMsHint": "A timeout drops the request silently and never blocks typing.",
        "settings.maxInputChars": "Context cap",
        "settings.maxInputCharsHint": "How much recent conversation is sent to the prediction model.",
        "settings.minConfidence": "Confidence bar",
        "settings.minConfidenceHint": "Predictions below this are dropped; 0 keeps them and only shows the confidence badge.",
        "settings.costNote": "Every prediction is a real billed model call; switch this off to stop it entirely.",
        "settings.saveFailed": "Could not save settings",
        "settings.noModels": "No models are available; configure one under Models first.",
        "settings.catalogFailed": "Could not read the model catalog: ",
        "settings.open": "Composer prediction settings",
        "settings.close": "Close",
        "settings.subagentNote": 'Which models subagents may use is owned by the native "Subagent model selection" setting, not by this plugin.'
      };
      Object.assign(zh, {
        "timing.queue": "\u6392\u961F",
        "timing.prepare": "\u51C6\u5907",
        "timing.model": "\u6A21\u578B",
        "timing.validate": "\u6821\u9A8C",
        "timing.waiting": "\u7B49\u5F85\u670D\u52A1\u7AEF\u9636\u6BB5\u6570\u636E",
        "timing.total": "\u603B\u8017\u65F6",
        "timing.elapsed": "\u5DF2\u7B49\u5F85",
        "timing.complete": "\u5DF2\u5B8C\u6210",
        "timing.timeout": "\u8D85\u65F6",
        "timing.failed": "\u8BF7\u6C42\u5931\u8D25",
        "timing.stale-source": "\u7ED3\u679C\u5DF2\u8FC7\u671F",
        "timing.low-confidence": "\u4F4E\u4E8E\u7F6E\u4FE1\u5EA6\u95E8\u69DB",
        "timing.empty-transcript": "\u7F3A\u5C11\u5BF9\u8BDD\u4E0A\u4E0B\u6587",
        "timing.empty-input": "\u8349\u7A3F\u4E3A\u7A7A",
        "timing.model-empty": "\u65E0\u5019\u9009\u7ED3\u679C",
        "timing.note": "\u6392\u961F=\u7B49\u5F85\u4E0A\u4E00\u8C03\u7528\u9000\u51FA\uFF1B\u51C6\u5907=\u4E0A\u4E0B\u6587\u4E0E\u6A21\u578B\u51C6\u5907\uFF1B\u6A21\u578B\u542B\u4F9B\u5E94\u5546\u53CA\u7F51\u7EDC\u7B49\u5F85\uFF1B\u6821\u9A8C\u542B\u54CD\u5E94\u89E3\u6790\u548C\u6765\u6E90\u6838\u5BF9\u3002\u5206\u6BB5\u4E0D\u542B\u5168\u90E8\u4F20\u8F93/\u9875\u9762\u5F00\u9500\uFF1B\u2014\u8868\u793A\u672A\u53D6\u5F97\u6570\u636E\u3002\u4EC5\u5F53\u524D\u9875\u9762\u5185\u5B58\u4FDD\u7559\u6700\u8FD18\u4E2A\u4F1A\u8BDD\u7684\u6700\u65B0\u8BF7\u6C42\u7EDF\u8BA1\uFF0C\u4E0D\u8BB0\u5F55\u6B63\u6587\u3002"
      });
      Object.assign(en, {
        "timing.queue": "Queue",
        "timing.prepare": "Prepare",
        "timing.model": "Model",
        "timing.validate": "Validate",
        "timing.waiting": "Waiting for server timing",
        "timing.total": "Total",
        "timing.elapsed": "Elapsed",
        "timing.complete": "Complete",
        "timing.timeout": "Timed out",
        "timing.failed": "Request failed",
        "timing.stale-source": "Stale result",
        "timing.low-confidence": "Below confidence threshold",
        "timing.empty-transcript": "No conversation context",
        "timing.empty-input": "Empty draft",
        "timing.model-empty": "No candidate",
        "timing.note": "Queue waits for an earlier call; prepare includes context and model preparation; model includes provider/network wait; validation includes response parsing and source checks. Segments exclude some transport/page overhead; \u2014 means unavailable. Only the latest request for 8 sessions is retained in page memory; no prompt text."
      });
      const settingsStore = {
        value: null,
        listeners: /* @__PURE__ */ new Set(),
        set(next) {
          this.value = next;
          for (const listener of this.listeners) listener();
        },
        subscribe(listener) {
          this.listeners.add(listener);
          return () => {
            this.listeners.delete(listener);
          };
        }
      };
      async function readSettings() {
        try {
          const response = await fetch(`${API}/settings`);
          const body = await readJsonResponse(response, "settings");
          if (body.ok !== true) throw new ResponseShapeError("settings: request was refused");
          if (body.settings === null || typeof body.settings !== "object" || Array.isArray(body.settings)) {
            throw new ResponseShapeError('settings: "settings" is not an object');
          }
          settingsStore.error = void 0;
          if (body.defaults !== void 0) settingsStore.defaults = body.defaults;
          settingsStore.set(body.settings);
          return body.settings;
        } catch (failure) {
          settingsStore.error = failure instanceof Error ? failure.message : String(failure);
          return void 0;
        }
      }
      async function saveSettings(patch) {
        const response = await fetch(`${API}/settings`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch)
        });
        const body = await response.json();
        if (body?.settings !== void 0) settingsStore.set(body.settings);
        return body;
      }
      async function withTimeout(work, milliseconds) {
        const abort = new AbortController();
        let timer;
        try {
          return await Promise.race([
            new Promise((_, reject) => {
              timer = setTimeout(() => {
                const error = new DOMException("Suggestion timed out", "TimeoutError");
                abort.abort(error);
                reject(error);
              }, milliseconds);
            }),
            work(abort.signal)
          ]);
        } finally {
          clearTimeout(timer);
        }
      }
      const timingBySession = /* @__PURE__ */ new Map();
      const ignoredUntil = /* @__PURE__ */ new Map();
      class ResponseShapeError extends Error {
      }
      async function readJsonResponse(response, what) {
        const raw = typeof response.text === "function" ? await response.text() : JSON.stringify(await response.json());
        let body;
        try {
          body = JSON.parse(raw);
        } catch {
          throw new ResponseShapeError(response.ok ? `${what}: response is not JSON` : `${what}: HTTP ${response.status}${raw === "" ? "" : ` (${raw.slice(0, 80)})`}`);
        }
        if (body === null || typeof body !== "object" || Array.isArray(body)) {
          throw new ResponseShapeError(`${what}: response is not an object`);
        }
        return body;
      }
      const isPositiveInt = (value) => Number.isSafeInteger(value) && value >= 0;
      function requireString(body, key, what) {
        if (typeof body[key] !== "string") throw new ResponseShapeError(`${what}: "${key}" is not a string`);
        return body[key];
      }
      function requireFinite(body, key, what) {
        if (!Number.isFinite(body[key]) || body[key] < 0) {
          throw new ResponseShapeError(`${what}: "${key}" is not a non-negative number`);
        }
        return body[key];
      }
      async function request(kind, sessionId, draft, revision, source, cause) {
        const configured = settingsStore.value?.timeoutMs;
        const deadline = Number.isFinite(configured) ? Math.max(2e3, Math.min(12e4, configured)) : 2e4;
        const id = currentRequestId(sessionId);
        const timing = { kind, started: performance.now(), pending: true, stage: "waiting", host: null };
        timingBySession.delete(sessionId);
        timingBySession.set(sessionId, timing);
        while (timingBySession.size > 8) timingBySession.delete(timingBySession.keys().next().value);
        notifyStore();
        try {
          const result = await withTimeout(async (signal) => {
            const response = await fetch(`${API}/suggest`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ kind, sessionId, draft, revision, source, cause }),
              signal
            });
            signal.throwIfAborted();
            timing.stage = "validate";
            timing.receivedAt = performance.now();
            if (timingBySession.get(sessionId) === timing) notifyStore();
            const body = await readJsonResponse(response, `suggest(${kind})`);
            signal.throwIfAborted();
            if (typeof body.ok !== "boolean") throw new ResponseShapeError('suggest: "ok" is not a boolean');
            if (body.ok !== true) {
              if (typeof body.error !== "string" || body.error === "") {
                throw new ResponseShapeError("suggest: failure without an error message");
              }
              throw new Error(body.error);
            }
            const owned = body.sessionId === sessionId && body.revision === revision && typeof body.source === "string";
            const phases = ["queue", "prepare", "model", "validate"];
            if (owned && phases.includes(body.timing?.phase) && phases.every((key) => Number.isFinite(body.timing[key]) && body.timing[key] >= 0)) {
              timing.host = { phase: body.timing.phase, ...Object.fromEntries(phases.map((key) => [key, body.timing[key]])) };
            }
            if (!owned) {
              reportProbe({
                phase: "not-owned",
                reason: "not-owned",
                sameSession: body?.sessionId === sessionId,
                revisionMatches: body?.revision === revision,
                hasSource: typeof body?.source === "string",
                source: body?.source,
                sourceBound: body?.sourceBound,
                sourceBefore: body?.sourceBefore,
                sourceAfter: body?.sourceAfter,
                hostReason: body?.reason
              });
              return { text: "", candidates: [], confidence: null, reason: "stale-source" };
            }
            const text = typeof body.text === "string" ? body.text : "";
            if (text === "" && body.reason !== void 0) {
              reportProbe({ phase: "empty-result", reason: body.reason, transcriptChars: body.transcriptChars });
              return { text: "", candidates: [], confidence: null, reason: body.reason };
            }
            signal.throwIfAborted();
            const candidates = Array.isArray(body.candidates) ? body.candidates.filter((item) => typeof item === "string" && item.trim() !== "").slice(0, 3) : [];
            if (candidates.length === 0 && text !== "") candidates.push(text);
            const confidence = Number.isFinite(body.confidence) && body.confidence >= 0 && body.confidence <= 1 ? body.confidence : null;
            return { text: candidates[0] ?? "", candidates, confidence, source: body.source };
          }, deadline + 1e3);
          timing.status = id !== currentRequestId(sessionId) || draftBySession.get(sessionId)?.revision !== revision ? "stale-source" : ["timeout", "stale-source", "low-confidence", "empty-transcript", "empty-input", "model-empty"].includes(result.reason) ? result.reason : result.text === "" ? "model-empty" : "complete";
          return result;
        } catch (error) {
          timing.status = error?.name === "TimeoutError" ? "timeout" : "failed";
          throw error;
        } finally {
          timing.pending = false;
          timing.total = performance.now() - timing.started;
          timing.clientValidation = timing.receivedAt === void 0 ? 0 : performance.now() - timing.receivedAt;
          if (timingBySession.get(sessionId) === timing) notifyStore();
        }
      }
      async function recordFeedback(action, text) {
        try {
          const response = await fetch(`${API}/feedback`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action, text, kind: "next" })
          });
          return await response.json();
        } catch {
          return void 0;
        }
      }
      const GHOST_CLASS = "composer-assist-ghost";
      const GHOST_STYLE_ID = "composer-assist-ghost-style";
      function ensureGhostStyle() {
        if (typeof document === "undefined" || document.getElementById(GHOST_STYLE_ID) !== null) return;
        const style = document.createElement("style");
        style.id = GHOST_STYLE_ID;
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
`;
        document.head.appendChild(style);
      }
      function composerInputElement() {
        if (typeof document === "undefined") return void 0;
        return document.querySelector("[data-composer-card] [data-composer-input]") ?? document.querySelector('[data-composer-card] [contenteditable="true"]') ?? void 0;
      }
      function ghostHostFor(element) {
        const grow = element?.parentElement;
        return grow === null || grow === void 0 ? void 0 : grow;
      }
      function ghostSpanFor(element) {
        const host = ghostHostFor(element);
        if (host === void 0) return void 0;
        let span = host.querySelector(`.${GHOST_CLASS}`);
        if (span === null) {
          span = document.createElement("span");
          span.className = GHOST_CLASS;
          span.setAttribute("aria-hidden", "true");
          span.hidden = true;
          host.appendChild(span);
        }
        return span;
      }
      const ownedHints = /* @__PURE__ */ new Map();
      function paintGhost(element, text, continuation = false) {
        clearGhosts();
        if (element === void 0 || text === "") return;
        const existing = getComputedStyle(element).getPropertyValue("--dsh-composer-hint").trim();
        if (existing !== "" && existing !== '""') return;
        if (continuation) {
          const value = `"${CSS.escape(text)}"`;
          ownedHints.set(element, {
            value,
            previous: element.style.getPropertyValue("--dsh-composer-hint"),
            priority: element.style.getPropertyPriority("--dsh-composer-hint")
          });
          element.style.setProperty("--dsh-composer-hint", value);
          element.setAttribute("data-composer-assist-continuation", "");
          return;
        }
        const span = ghostSpanFor(element);
        if (span === void 0 || span === null) return;
        span.textContent = text;
        span.hidden = false;
      }
      function measureAlignment() {
        try {
          if (typeof document === "undefined") return void 0;
          const card = document.querySelector("[data-composer-card]");
          const bar = document.querySelector("[data-composer-assist-bar]");
          if (card === null || bar === null) return { present: false };
          const c = card.getBoundingClientRect(), b = bar.getBoundingClientRect();
          return {
            present: true,
            cardLeft: Math.round(c.left),
            cardRight: Math.round(c.right),
            barLeft: Math.round(b.left),
            barRight: Math.round(b.right),
            deltaLeft: Math.round(b.left - c.left),
            deltaRight: Math.round(b.right - c.right)
          };
        } catch {
          return void 0;
        }
      }
      function reportProbe(extra) {
        try {
          const input = composerInputElement();
          const span = typeof document === "undefined" ? null : document.querySelector(`.${GHOST_CLASS}`);
          const box = input?.getBoundingClientRect();
          const rect = span?.getBoundingClientRect();
          const style = span === null || span === void 0 ? null : getComputedStyle(span);
          const placeholder = typeof document === "undefined" ? null : document.querySelector("[data-composer-card] [data-composer-placeholder]");
          const placeholderStyle = placeholder === null ? null : getComputedStyle(placeholder);
          const report = {
            at: Date.now(),
            ghostPresent: span !== null && span !== void 0,
            ghostText: span?.textContent ?? "",
            ghostHidden: span?.hidden ?? null,
            ghostDisplay: style?.display ?? null,
            ghostFontSize: style?.fontSize ?? null,
            placeholderPresent: placeholder !== null,
            placeholderDisplay: placeholderStyle?.display ?? null,
            placeholderVisible: placeholder !== null && placeholderStyle?.display !== "none" && placeholderStyle?.visibility !== "hidden",
            ghostColor: style?.color ?? null,
            insideComposer: box !== void 0 && rect !== void 0 && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1 && rect.left >= box.left - 1 && rect.right <= box.right + 1,
            composerBox: box === void 0 ? null : { top: box.top, bottom: box.bottom, left: box.left, right: box.right },
            ghostBox: rect === void 0 ? null : { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
            ...extra
          };
          void fetch(`${API}/probe`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(report)
          }).catch(() => {
          });
          return report;
        } catch {
          return void 0;
        }
      }
      function clearGhosts() {
        if (typeof document === "undefined") return;
        for (const [element, hint] of ownedHints) {
          element.removeAttribute("data-composer-assist-continuation");
          if (element.style.getPropertyValue("--dsh-composer-hint") === hint.value) {
            if (hint.previous !== "") element.style.setProperty("--dsh-composer-hint", hint.previous, hint.priority);
            else element.style.removeProperty("--dsh-composer-hint");
          }
        }
        ownedHints.clear();
        for (const span of document.querySelectorAll(`.${GHOST_CLASS}`)) {
          span.hidden = true;
          span.textContent = "";
        }
      }
      function disposeGhosts() {
        if (typeof document === "undefined") return;
        clearGhosts();
        for (const span of document.querySelectorAll(`.${GHOST_CLASS}`)) span.remove();
        document.getElementById(GHOST_STYLE_ID)?.remove();
      }
      const manualRequest = {
        current: void 0,
        /** Whether a suggestion is on screen right now (read by the tool-row button). */
        hasSuggestion: void 0,
        /** Subscribe to that boolean so the button label follows it. */
        subscribe: void 0
      };
      const listeners = /* @__PURE__ */ new Set();
      function runRequest(kind, sessionId, draft, cause, source) {
        if (kind === "complete" && hasDraftRequest(sessionId, draft)) return Promise.resolve(null);
        const id = nextRequestId(sessionId);
        const revision = trackDraft(sessionId, draft).revision;
        const token = {};
        pendingBySession.set(sessionId, { id, token, draft, revision, bounded: true });
        publishStore();
        reportProbe({ phase: "begin", trace: `req-${id}`, owner: sessionId, kind, cause });
        return request(kind, sessionId, draft, revision, source, cause).then((result) => {
          const idMoved = id !== currentRequestId(sessionId);
          const draftMoved = draftBySession.get(sessionId)?.revision !== revision;
          const stale = idMoved || draftMoved;
          reportProbe({
            phase: "result",
            trace: `req-${id}`,
            kind,
            textLength: result.text.length,
            stale,
            idMoved,
            draftMoved,
            owner: sessionId,
            confidence: result.confidence
          });
          if (stale || result.text === "") return null;
          const record = {
            kind,
            text: result.text,
            draftAt: draft,
            source: result.source,
            candidates: result.candidates,
            confidence: result.confidence
          };
          if (kind !== "polish") rememberSuggestion(sessionId, record);
          return record;
        }).catch(() => null).finally(() => {
          if (pendingBySession.get(sessionId)?.token === token) pendingBySession.delete(sessionId);
          publishStore();
        });
      }
      const sessionStorageKey = "dsh.composer-assist.predictions.v2";
      function restoreSessionState() {
        const state = {
          requests: /* @__PURE__ */ new Map(),
          suggestions: /* @__PURE__ */ new Map(),
          candidates: /* @__PURE__ */ new Map(),
          drafts: /* @__PURE__ */ new Map(),
          pending: /* @__PURE__ */ new Map(),
          listeners: /* @__PURE__ */ new Set()
        };
        try {
          const entries = JSON.parse(sessionStorage.getItem(sessionStorageKey) ?? "[]");
          if (!Array.isArray(entries)) return state;
          for (const entry of entries.slice(-8)) {
            if (!Array.isArray(entry)) continue;
            const [id, record, index] = entry;
            if (typeof id !== "string" || record === null || typeof record !== "object" || !["next", "complete"].includes(record.kind) || typeof record.text !== "string" || record.text === "" || typeof record.draftAt !== "string" || typeof record.source !== "string") continue;
            const candidates = Array.isArray(record.candidates) ? record.candidates.filter((text) => typeof text === "string" && text !== "").slice(0, 3) : [];
            state.suggestions.set(id, {
              kind: record.kind,
              text: record.text,
              draftAt: record.draftAt,
              candidates,
              source: record.source,
              confidence: Number.isFinite(record.confidence) && record.confidence >= 0 && record.confidence <= 1 ? record.confidence : null
            });
            state.candidates.set(id, Number.isSafeInteger(index) && index >= 0 ? Math.min(index, Math.max(1, candidates.length) - 1) : 0);
          }
        } catch {
        }
        return state;
      }
      const sessionStateKey = Symbol.for("dsh.composer-assist.session-state.v2");
      const sessionState = window[sessionStateKey] ??= restoreSessionState();
      const requestSeqBySession = sessionState.requests;
      const draftBySession = sessionState.drafts;
      function trackDraft(sessionId, draft) {
        let state = draftBySession.get(sessionId);
        if (state === void 0 || state.draft !== draft) {
          state = { draft, revision: (state?.revision ?? 0) + 1 };
          draftBySession.set(sessionId, state);
        }
        return state;
      }
      function hasDraftRequest(sessionId, draft) {
        const active = pendingBySession.get(sessionId);
        return active?.draft === draft && active.revision === draftBySession.get(sessionId)?.revision;
      }
      async function sourceMatches(sessionId, source) {
        return withTimeout(async (signal) => {
          const response = await fetch(`${API}/turn?sessionId=${encodeURIComponent(sessionId)}`, { signal });
          const body = await readJsonResponse(response, "turn");
          signal.throwIfAborted();
          return body.ok === true && typeof source === "string" && body.source === source;
        }, 5e3);
      }
      function nextRequestId(sessionId) {
        const next = (requestSeqBySession.get(sessionId) ?? 0) + 1;
        requestSeqBySession.set(sessionId, next);
        if (requestSeqBySession.size > 32) requestSeqBySession.delete(requestSeqBySession.keys().next().value);
        return next;
      }
      function currentRequestId(sessionId) {
        return requestSeqBySession.get(sessionId) ?? 0;
      }
      const suggestionBySession = sessionState.suggestions;
      const candidateIndexBySession = sessionState.candidates;
      let instanceSeq = 0;
      const pendingBySession = sessionState.pending;
      for (const [owner, active] of pendingBySession) {
        if (active?.bounded === true) continue;
        nextRequestId(owner);
        pendingBySession.delete(owner);
      }
      const storeListeners = sessionState.listeners;
      function onStoreChange(listener) {
        storeListeners.add(listener);
        return () => {
          storeListeners.delete(listener);
        };
      }
      function publishStore() {
        try {
          sessionStorage.setItem(sessionStorageKey, JSON.stringify(
            [...suggestionBySession].map(([id, record]) => [id, record, candidateIndexBySession.get(id) ?? 0])
          ));
        } catch {
        }
        notifyStore();
      }
      function notifyStore() {
        for (const listener of [...storeListeners]) {
          try {
            listener();
          } catch {
          }
        }
      }
      function rememberSuggestion(sessionId, value) {
        if (sessionId === void 0) return;
        if (value === null) {
          suggestionBySession.delete(sessionId);
          candidateIndexBySession.delete(sessionId);
          pickedBySession.delete(sessionId);
        } else {
          suggestionBySession.delete(sessionId);
          suggestionBySession.set(sessionId, value);
          candidateIndexBySession.set(sessionId, 0);
        }
        while (suggestionBySession.size > 8) suggestionBySession.delete(suggestionBySession.keys().next().value);
        publishStore();
      }
      const acceptedBySession = /* @__PURE__ */ new Map();
      function candidateIndex(sessionId) {
        return candidateIndexBySession.get(sessionId) ?? 0;
      }
      function candidateTotal(sessionId) {
        const record = suggestionBySession.get(sessionId);
        if (record === null || record === void 0) return 0;
        return Array.isArray(record.candidates) && record.candidates.length > 0 ? record.candidates.length : 1;
      }
      const pickedBySession = /* @__PURE__ */ new Map();
      function togglePicked(sessionId, index) {
        const total = candidateTotal(sessionId);
        if (total <= 1) return false;
        const set = pickedBySession.get(sessionId) ?? /* @__PURE__ */ new Set();
        if (set.has(index)) set.delete(index);
        else set.add(index);
        if (set.size === 0) pickedBySession.delete(sessionId);
        else pickedBySession.set(sessionId, set);
        publishStore();
        return set.has(index);
      }
      function pickedText(sessionId) {
        const set = pickedBySession.get(sessionId);
        if (set === void 0 || set.size === 0) return "";
        const record = suggestionBySession.get(sessionId);
        if (record === null || record === void 0) return "";
        const list = Array.isArray(record.candidates) && record.candidates.length > 0 ? record.candidates : [record.text];
        return [...set].sort((a, b) => a - b).map((index) => String(list[index] ?? "")).filter((text) => text !== "").join("\n");
      }
      function currentCandidate(sessionId) {
        const record = suggestionBySession.get(sessionId);
        if (record === null || record === void 0) return "";
        const total = candidateTotal(sessionId);
        const index = Math.min(candidateIndex(sessionId), total - 1);
        if (Array.isArray(record.candidates) && record.candidates.length > 0) {
          return String(record.candidates[index] ?? "");
        }
        return record.text;
      }
      function cycleCandidate(sessionId, delta) {
        const total = candidateTotal(sessionId);
        if (total <= 1) return false;
        const next = (candidateIndex(sessionId) + delta + total) % total;
        candidateIndexBySession.set(sessionId, next);
        publishStore();
        return true;
      }
      const acceptRef = { current: void 0 };
      const stripStyle = {
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        // Align with the composer card: same cap and side clearances the host uses for
        // its own dock cards, centred in the stack. This slot is a sibling of the input
        // bar, whose wrapper carries `padding: 0 <side-clearance>`; without the same
        // inset the bar is one clearance too wide on each side.
        boxSizing: "border-box",
        width: "calc(100% - 2 * var(--dsh-composer-side-clearance, 16px))",
        maxWidth: "var(--dsh-composer-card-max-width)",
        margin: "0 auto 8px",
        padding: "10px 12px",
        borderRadius: "12px",
        border: "1px solid var(--dsw-alias-border-l1)",
        // A faint brand wash plus the card layer: distinct from the composer below
        // without the heavy accent bar the design brief rejected.
        background: "color-mix(in srgb, var(--dsw-alias-brand-primary) 3%, var(--dsw-alias-bg-layer-1))",
        color: "var(--dsw-alias-label-primary)",
        fontSize: "13px",
        lineHeight: "1.5"
      };
      const stripBadge = {
        flex: "0 0 auto",
        fontSize: "11px",
        fontWeight: "650",
        lineHeight: "1.6",
        color: "var(--dsw-alias-brand-primary)",
        whiteSpace: "nowrap"
      };
      const stripText = {
        flex: "1 1 auto",
        minWidth: 0,
        color: "var(--dsw-alias-label-primary)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      };
      const stripActions = { flex: "0 0 auto", display: "flex", alignItems: "center", gap: "6px" };
      const candidateRow = {
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        boxSizing: "border-box",
        padding: "8px 12px",
        marginTop: "6px",
        borderRadius: "8px",
        cursor: "pointer",
        border: "1px solid var(--dsw-alias-border-l1)",
        background: "var(--dsw-alias-bg-layer-2)",
        color: "var(--dsw-alias-label-primary)",
        textAlign: "left"
      };
      const candidateRowShown = {
        ...candidateRow,
        border: "2px solid var(--dsw-alias-brand-primary)",
        padding: "7px 11px",
        background: "var(--dsw-alias-bg-layer-1)"
      };
      const candidateRowPicked = {
        ...candidateRow,
        border: "1px solid var(--dsw-alias-brand-primary)",
        background: "var(--dsw-alias-brand-primary)",
        color: "var(--dsw-alias-bg-base)"
      };
      const candidateTextPicked = {
        flex: "1 1 auto",
        minWidth: 0,
        color: "var(--dsw-alias-bg-base)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      };
      const candidateIndexLabel = {
        flex: "0 0 auto",
        width: "14px",
        textAlign: "right",
        fontSize: "10px",
        fontWeight: "650",
        lineHeight: "1.6",
        color: "var(--dsw-alias-label-secondary)"
      };
      function SuggestionStrip({ sessionId, useInput, useSession, inputActions, settings, t }) {
        const draft = useInput((state) => state.draft);
        trackDraft(sessionId, draft);
        const phase = useInput((state) => state.phase);
        const phaseRef = useRef(phase);
        phaseRef.current = phase;
        const blank = useSession((session) => session.blank);
        const running = useSession((session) => session.running);
        const [pending, setPending] = useState(null);
        const [busy, setBusy] = useState(false);
        const [failed, setFailed] = useState(false);
        const askRef = useRef(void 0);
        const sessionIdRef = useRef(sessionId);
        sessionIdRef.current = sessionId;
        const pendingRef = useRef(null);
        const draftRef = useRef(draft);
        draftRef.current = draft;
        const enabled = settings !== null && settings.enabled === true;
        const mode = settings?.mode ?? "auto";
        const instanceId = useRef(void 0);
        if (instanceId.current === void 0) instanceId.current = `i${++instanceSeq}`;
        useEffect(() => {
          reportProbe({ phase: "mount", instanceId: instanceId.current, sessionId });
          return () => {
            reportProbe({ phase: "unmount", instanceId: instanceId.current, sessionId: sessionIdRef.current });
          };
        }, []);
        useEffect(() => {
          const apply = () => {
            const restored = suggestionBySession.get(sessionId) ?? null;
            setPending(restored === null ? null : { ...restored });
            setBusy(pendingBySession.has(sessionId));
          };
          apply();
          reportProbe({
            phase: "restore",
            instanceId: instanceId.current,
            sessionId,
            hasStored: suggestionBySession.get(sessionId) != null,
            storedSize: suggestionBySession.size,
            keys: [...suggestionBySession.keys()].map((k) => k.slice(-6))
          });
          setFailed(false);
          return onStoreChange(apply);
        }, [sessionId]);
        useEffect(() => {
          if (!enabled) return void 0;
          let stopped = false;
          const verify = async () => {
            const stored2 = suggestionBySession.get(sessionId);
            if (stored2 === void 0) return;
            try {
              const matches = await sourceMatches(sessionId, stored2.source);
              if (!stopped && !matches && suggestionBySession.get(sessionId) === stored2) rememberSuggestion(sessionId, null);
            } catch {
            }
          };
          void verify();
          const timer = setInterval(() => {
            void verify();
          }, 5e3);
          return () => {
            stopped = true;
            clearInterval(timer);
          };
        }, [sessionId, enabled, running, pending?.source]);
        const clear = (via) => {
          reportProbe({
            phase: "clear",
            via: via ?? "unknown",
            instanceId: instanceId.current,
            sessionId,
            hadPending: pending !== null
          });
          if (via !== "hide") nextRequestId(sessionId);
          if (via !== "hide") rememberSuggestion(sessionId, null);
          setPending(null);
          setBusy(false);
          setFailed(false);
          for (const listener of listeners) listener();
        };
        const ask = async (kind, at, cause, source) => {
          const owner = sessionId;
          const automatic = cause !== "manual";
          if (automatic && pendingBySession.has(owner)) return;
          reportProbe({ phase: "request", kind, cause: cause ?? "unknown", draft: at, owner });
          setFailed(false);
          await runRequest(kind, owner, at, cause, source);
          if (sessionIdRef.current === owner) {
            const stored2 = suggestionBySession.get(owner);
            setPending(stored2 === void 0 ? null : { ...stored2 });
            setBusy(pendingBySession.has(owner));
            for (const listener of listeners) listener();
          }
        };
        const lastDraft = useRef({ sessionId, draft });
        useEffect(() => {
          const previous = lastDraft.current;
          lastDraft.current = { sessionId, draft };
          const sameSession = previous.sessionId === sessionId;
          const sent = sameSession && previous.draft.trim() !== "" && draft === "";
          if (!sent) return;
          clear("send");
          ignoredUntil.set(sessionId, Date.now());
        }, [draft, sessionId]);
        useEffect(() => {
          if (!enabled || mode !== "auto" && mode !== "both") return void 0;
          let stopped = false;
          const poll = async () => {
            if (stopped) return;
            try {
              const peek = await fetch(`${API}/turn?sessionId=${encodeURIComponent(sessionId)}`);
              const seen = await readJsonResponse(peek, "turn");
              const since = ignoredUntil.get(sessionId) ?? 0;
              const muted = seen.auto !== null && seen.auto !== void 0 && typeof seen.auto.at === "number" && seen.auto.at <= since;
              if (seen.auto !== null && seen.auto !== void 0 && !muted && suggestionBySession.get(sessionId) === void 0) {
                if (seen.turn !== null && seen.turn !== void 0) {
                  void fetch(`${API}/turn?sessionId=${encodeURIComponent(sessionId)}&consume=1`);
                }
                reportProbe({ phase: "adopt-host", sessionId, count: Array.isArray(seen.auto.candidates) ? seen.auto.candidates.length : 1 });
                rememberSuggestion(sessionId, {
                  kind: "next",
                  text: seen.auto.text,
                  draftAt: "",
                  source: seen.auto.source,
                  candidates: seen.auto.candidates,
                  confidence: seen.auto.confidence
                });
                return;
              }
              if (stopped || seen.turn === null || seen.turn === void 0) return;
              if (draftRef.current !== "") return;
              if (running === true) return;
              const claim = await fetch(`${API}/turn?sessionId=${encodeURIComponent(sessionId)}&consume=1`);
              const claimed = await readJsonResponse(claim, "turn");
              if (claimed.turn === null || claimed.turn === void 0) return;
              if (blank || draftRef.current !== "") return;
            } catch {
            }
          };
          void poll();
          const timers = [];
          if (running) {
            timers.push(setInterval(() => {
              void poll();
            }, 1e3));
          } else {
            timers.push(setTimeout(() => {
              void poll();
            }, 900), setTimeout(() => {
              void poll();
            }, 2200));
            timers.push(setInterval(() => {
              void poll();
            }, 5e3));
          }
          return () => {
            stopped = true;
            timers.forEach((t2) => {
              clearInterval(t2);
              clearTimeout(t2);
            });
          };
        }, [enabled, mode, blank, sessionId, running]);
        useEffect(() => {
          if (!enabled || mode !== "word" && mode !== "both") return;
          if (draft.trim() === "" || hasDraftRequest(sessionId, draft)) return;
          if (suggestionBySession.get(sessionId)?.draftAt === draft) return;
          const timer = setTimeout(() => {
            if (draftRef.current === draft && !hasDraftRequest(sessionId, draft)) void ask("complete", draft, "typing");
          }, settings?.debounceMs ?? 600);
          return () => {
            clearTimeout(timer);
          };
        }, [draft, enabled, mode, sessionId, settings?.debounceMs]);
        askRef.current = ask;
        pendingRef.current = pending;
        manualRequest.current = (kind) => {
          reportProbe({ phase: "manual-fire", kind: kind ?? "next", hasAsk: askRef.current !== void 0, enabled });
          pendingBySession.set(sessionId, { id: currentRequestId(sessionId) + 1, token: {}, bounded: true });
          publishStore();
          void askRef.current?.(kind ?? "next", draftRef.current, "manual");
        };
        manualRequest.hasSuggestion = () => pendingRef.current !== null;
        manualRequest.isBusy = () => pendingBySession.has(sessionId);
        manualRequest.subscribe = (listener) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        };
        useEffect(() => {
          for (const listener of listeners) listener();
        }, [pending, failed]);
        useEffect(() => {
          if (pending === null && !busy && !failed) return void 0;
          const timer = setTimeout(() => {
            const measured = measureAlignment();
            if (measured !== void 0) reportProbe({ phase: "align", ...measured });
          }, 60);
          return () => {
            clearTimeout(timer);
          };
        }, [pending, busy, failed, sessionId]);
        useEffect(() => {
          let accepting = false;
          const accept = () => {
            const stored2 = suggestionBySession.get(sessionId);
            if (pending === null || stored2 === void 0 || stored2.draftAt !== draftRef.current || phaseRef.current !== "plain" || accepting) return false;
            const revision = draftBySession.get(sessionId)?.revision;
            const picked = pickedText(sessionId);
            const text2 = picked !== "" ? picked : currentCandidate(sessionId);
            accepting = true;
            inputActions.setDraft(stored2.kind === "complete" ? `${stored2.draftAt}${text2}` : text2);
            void (async () => {
              try {
                void recordFeedback("accept", text2);
                if (stored2.kind === "next") acceptedBySession.set(sessionId, stored2);
                else acceptedBySession.delete(sessionId);
                clear("accept");
              } catch {
              } finally {
                accepting = false;
              }
            })();
            return true;
          };
          acceptRef.current = accept;
          return () => {
            if (acceptRef.current === accept) acceptRef.current = void 0;
          };
        }, [pending, inputActions]);
        useEffect(() => {
          const onKey = (event) => {
            if (pending === null) return;
            const target = event.target;
            const insideComposer = target instanceof Element && target.closest("[data-composer-card]") !== null;
            if (!insideComposer) return;
            if (event.isComposing === true || event.keyCode === 229) return;
            if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
            if (event.defaultPrevented) return;
            if (draftRef.current === "") {
              const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
              if (step !== 0 && cycleCandidate(sessionId, step)) {
                event.preventDefault();
                return;
              }
            }
            if (event.key === " ") {
              if (draftRef.current === "" && candidateTotal(sessionId) > 1) {
                togglePicked(sessionId, candidateIndex(sessionId));
                event.preventDefault();
                return;
              }
            }
            if (event.key === "Escape") clear("hide");
          };
          window.addEventListener("keydown", onKey);
          return () => {
            window.removeEventListener("keydown", onKey);
          };
        }, [pending]);
        useEffect(() => {
          if (!enabled || draft !== "") return;
          if (suggestionBySession.get(sessionId) !== void 0 || pendingBySession.has(sessionId)) return;
          const saved = acceptedBySession.get(sessionId);
          if (saved === void 0) return;
          acceptedBySession.delete(sessionId);
          rememberSuggestion(sessionId, saved);
          setPending(saved);
        }, [enabled, draft, sessionId]);
        const inline = settings?.display === "inline";
        const continuation = pending?.kind === "complete" && pending.draftAt === draft && draft !== "";
        const ghost = enabled && pending !== null && (pending.kind === "next" && draft === "" || continuation) ? currentCandidate(sessionId) : "";
        useEffect(() => {
          if (!inline) {
            clearGhosts();
            return void 0;
          }
          ensureGhostStyle();
          const element = composerInputElement();
          if (element === void 0) return void 0;
          paintGhost(element, ghost, continuation);
          reportProbe({ phase: "paint", ghost });
          return void 0;
        }, [ghost, inline, sessionId, continuation]);
        useEffect(() => () => {
          clearGhosts();
        }, []);
        reportProbe({
          phase: "render",
          instanceId: instanceId.current,
          sessionId,
          enabled,
          inline,
          hasPending: pending !== null,
          busy,
          failed,
          willRender: enabled && (pending !== null || busy || failed)
        });
        if (!enabled) return null;
        if (inline && pending === null && !busy && !failed) return null;
        if (!inline && pending === null && !busy && !failed) return null;
        const badge = busy ? t("strip.thinking") : failed ? t("strip.failed") : t(pending?.kind === "complete" ? "strip.complete" : "strip.next");
        const stored = pending !== null ? suggestionBySession.get(sessionId) : null;
        const text = currentCandidate(sessionId);
        const total = candidateTotal(sessionId);
        const candidateList = Array.isArray(stored?.candidates) && stored.candidates.length > 0 ? stored.candidates : stored === null ? [] : [stored.text];
        const pickedForSession = pickedBySession.get(sessionId);
        const confidence = stored?.confidence;
        const pickedCount = pickedForSession === void 0 ? 0 : pickedForSession.size;
        const counter = total > 1 ? `${candidateIndex(sessionId) + 1}/${total}${pickedCount > 0 ? ` \xB7 ${pickedCount} ${t("strip.picked")}` : ""}` : "";
        const confidenceText = typeof confidence === "number" ? `${t("strip.confidence")} ${confidence >= 0.7 ? t("strip.confidenceHigh") : confidence >= 0.4 ? t("strip.confidenceMedium") : t("strip.confidenceLow")}` : null;
        const current = pending !== null && pending.draftAt === draft;
        const listed = total > 1 && current;
        const rootStyle = inline ? { ...stripStyle, padding: "2px 4px", marginBottom: "4px", border: "none", borderRadius: 0, background: "transparent" } : listed ? { ...stripStyle, flexDirection: "column", alignItems: "stretch", gap: "0" } : stripStyle;
        const acceptButton = pending !== null && h("button", {
          type: "button",
          onClick: () => {
            acceptRef.current?.();
          },
          disabled: pending.draftAt !== draft,
          title: pending.draftAt !== draft ? t("strip.draftChanged") : total > 1 && draft === "" ? t("strip.acceptHint") : t("strip.accept"),
          style: {
            opacity: pending.draftAt !== draft ? "0.45" : "1",
            cursor: pending.draftAt !== draft ? "not-allowed" : "pointer",
            border: "none",
            background: "var(--dsw-alias-brand-primary)",
            color: "var(--dsw-alias-bg-base)",
            borderRadius: "8px",
            padding: "3px 12px",
            fontSize: "12px",
            fontWeight: "600",
            lineHeight: "1.6",
            whiteSpace: "nowrap"
          }
        }, t("strip.accept"));
        const dismissButton = pending !== null && h("button", {
          type: "button",
          onClick: () => {
            void recordFeedback("dismiss", currentCandidate(sessionId));
            clear("dismiss");
          },
          title: t("strip.dismiss"),
          style: {
            cursor: "pointer",
            border: "1px solid var(--dsw-alias-border-l1)",
            background: "transparent",
            color: "var(--dsw-alias-label-secondary)",
            borderRadius: "8px",
            padding: "3px 10px",
            fontSize: "12px",
            lineHeight: "1.6",
            whiteSpace: "nowrap"
          }
        }, t("strip.dismiss"));
        const header = h(
          "div",
          {
            style: { display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }
          },
          h("span", { style: stripBadge }, inline && ghost !== "" ? t("strip.preview") : badge),
          // Everything that qualifies the suggestion sits in one muted run, separated by a
          // middot, so the header reads as a sentence instead of a row of competing chips.
          h("span", {
            style: {
              flex: "0 0 auto",
              minWidth: 0,
              overflow: "hidden",
              fontSize: "11px",
              lineHeight: "1.6",
              color: "var(--dsw-alias-label-secondary)",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis"
            }
          }, [confidenceText, counter, inline && total > 1 && draft === "" ? t("strip.cycle") : null].filter((part) => part !== null && part !== "").join(" \xB7 ")),
          h("span", { style: { flex: "1 1 auto" } }),
          h("span", { style: stripActions }, acceptButton, dismissButton)
        );
        const list = listed ? h(
          "div",
          {
            style: { display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" },
            role: "group",
            "aria-label": t("strip.candidates")
          },
          [...Array(total).keys()].map((index) => h(
            "button",
            {
              key: index,
              type: "button",
              "aria-pressed": pickedForSession?.has(index) === true,
              "aria-label": t("strip.rowLabel").replace("{n}", String(index + 1)).replace("{total}", String(total)),
              onClick: () => {
                candidateIndexBySession.set(sessionId, index);
                togglePicked(sessionId, index);
              },
              style: pickedForSession?.has(index) === true ? candidateRowPicked : index === candidateIndex(sessionId) ? candidateRowShown : candidateRow
            },
            h("span", {
              // On the filled row the numeral has to invert too, or it disappears.
              style: pickedForSession?.has(index) === true ? { ...candidateIndexLabel, color: "var(--dsw-alias-bg-base)" } : candidateIndexLabel
            }, `${index + 1}`),
            h("span", {
              style: pickedForSession?.has(index) === true ? candidateTextPicked : stripText
            }, String(candidateList[index] ?? ""))
          ))
        ) : h("span", { style: inline && ghost !== "" ? {
          ...stripText,
          position: "absolute",
          width: "1px",
          height: "1px",
          overflow: "hidden",
          clipPath: "inset(50%)"
        } : { ...stripText, paddingTop: "2px" } }, pending !== null ? text : "");
        return h("div", {
          style: rootStyle,
          role: "status",
          "aria-live": "polite",
          "data-composer-assist-bar": ""
        }, header, list);
      }
      function RequestTiming({ sessionId, settings, t }) {
        const [, redraw] = useState(0);
        const timing = timingBySession.get(sessionId);
        useEffect(() => {
          const off = onStoreChange(() => redraw((value) => value + 1));
          redraw((value) => value + 1);
          return off;
        }, [sessionId]);
        useEffect(() => {
          if (!settings?.enabled || !timing?.pending) return;
          const timer = setInterval(() => redraw((value) => value + 1), 500);
          return () => clearInterval(timer);
        }, [sessionId, settings?.enabled, timing?.pending]);
        if (!settings?.enabled || timing === void 0) return null;
        const elapsed = timing.pending ? performance.now() - timing.started : timing.total;
        const validation = timing.receivedAt === void 0 ? 0 : timing.pending ? performance.now() - timing.receivedAt : timing.clientValidation;
        const format = (ms) => ms === void 0 ? "\u2014" : ms < 1e3 ? `${Math.round(ms)}ms` : `${(ms / 1e3).toFixed(1)}s`;
        const values = ["queue", "prepare", "model"].map((key) => `${t(`timing.${key}`)} ${format(timing.host?.[key])}`);
        values.push(`${t("timing.validate")} ${timing.host !== null ? format(timing.host.validate + validation) : timing.receivedAt === void 0 ? "\u2014" : `\u2265${format(validation)}`}`);
        const stage = timing.host?.phase ?? timing.stage;
        const label = timing.pending ? timing.stage === "waiting" ? t("timing.waiting") : `${t("timing.validate")}\u2026` : ["timeout", "failed"].includes(timing.status) ? `${t(`timing.${timing.status}`)} \xB7 ${t(`timing.${stage}`)}` : t(`timing.${timing.status}`);
        return h("div", {
          "data-composer-timing": true,
          title: t("timing.note"),
          style: {
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 10px",
            alignItems: "center",
            boxSizing: stripStyle.boxSizing,
            width: stripStyle.width,
            maxWidth: stripStyle.maxWidth,
            margin: "0 auto",
            padding: "2px 0 4px",
            fontSize: "11px",
            lineHeight: "1.5",
            color: "var(--dsw-alias-label-secondary)"
          }
        }, [
          h("span", { key: "status", role: "status", "aria-live": "polite" }, `${t(timing.kind === "polish" ? "polish.short" : timing.kind === "complete" ? "strip.complete" : "predict.short")} \xB7 ${label}`),
          h("span", { key: "elapsed" }, `${t(timing.pending ? "timing.elapsed" : "timing.total")} ${format(elapsed)}`),
          h("span", { key: "segments" }, values.join(" \xB7 "))
        ]);
      }
      function AssistButton({ sessionId, useInput, inputActions, t, loadCatalog }) {
        const draft = useInput((state) => state.draft);
        const phase = useInput((state) => state.phase);
        trackDraft(sessionId, draft);
        const live = useRef({ sessionId, draft, phase });
        live.current = { sessionId, draft, phase };
        const mounted = useRef(true);
        useEffect(() => {
          mounted.current = true;
          return () => {
            mounted.current = false;
          };
        }, []);
        const [polishBusy, setPolishBusy] = useState(false);
        const [polishFailed, setPolishFailed] = useState(false);
        const polishIdle = draft.trim() !== "" && phase === "plain" && !polishBusy;
        const [predictBusy, setPredictBusy] = useState(false);
        const [hasSuggestion, setHasSuggestion] = useState(false);
        const busyTimer = useRef(void 0);
        useEffect(() => {
          const read = () => {
            setHasSuggestion(manualRequest.hasSuggestion?.() === true);
          };
          read();
          const timer = setInterval(read, 1e3);
          const off = manualRequest.subscribe?.(read);
          return () => {
            clearInterval(timer);
            off?.();
            clearTimeout(busyTimer.current);
          };
        }, []);
        const [open, setOpen] = useState(false);
        const [showSettings, setShowSettings] = useState(false);
        const box = useRef(null);
        const button = useRef(null);
        const menuAnchor = useRef(null);
        const [anchor, setAnchor] = useState(null);
        const openMenu = () => {
          const rect = menuAnchor.current?.getBoundingClientRect();
          if (rect !== void 0 && rect !== null) setAnchor({ left: rect.left, bottom: window.innerHeight - rect.top });
          setOpen(true);
        };
        useEffect(() => {
          if (!open) return;
          const onKey = (event) => {
            if (event.key === "Escape") {
              setShowSettings(false);
              setOpen(false);
            }
          };
          const onDown = (event) => {
            const target = event.target;
            if (box.current?.contains(target) === true || menuAnchor.current?.contains(target) === true) return;
            setShowSettings(false);
            setOpen(false);
          };
          document.addEventListener("keydown", onKey);
          document.addEventListener("mousedown", onDown);
          return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onDown);
          };
        }, [open]);
        const runPolish = async () => {
          setOpen(false);
          if (!polishIdle) return;
          setPolishBusy(true);
          setPolishFailed(false);
          try {
            const result = await runRequest("polish", sessionId, draft, "manual");
            const stillMine = () => mounted.current && live.current.sessionId === sessionId && live.current.draft === draft && live.current.phase === "plain";
            const text = result?.text ?? "";
            if (text !== "" && stillMine()) inputActions.setDraft(text);
            else if (text === "" && stillMine()) setPolishFailed(true);
          } catch {
            if (mounted.current) setPolishFailed(true);
          } finally {
            if (mounted.current) setPolishBusy(false);
          }
        };
        const runPredict = () => {
          setOpen(false);
          const fire = manualRequest.current;
          if (fire === void 0) {
            reportProbe({ phase: "click-miss", reason: "no-channel" });
            return;
          }
          if (manualRequest.isBusy?.() === true) return;
          setPredictBusy(true);
          reportProbe({ phase: "manual-fire", cause: "click" });
          try {
            fire("next");
          } catch {
          }
          const poll = () => {
            if (mounted.current !== true) return;
            if (manualRequest.isBusy?.() === true) {
              busyTimer.current = setTimeout(poll, 250);
              return;
            }
            busyTimer.current = void 0;
            setPredictBusy(false);
          };
          busyTimer.current = setTimeout(poll, 250);
        };
        const busy = polishBusy || predictBusy;
        const polishLabel = polishFailed ? t("polish.failed") : polishBusy ? t("polish.busy") : t("polish.title");
        const predictLabel = predictBusy ? t("predict.busy") : hasSuggestion ? t("predict.again") : t("predict.title");
        const item = {
          display: "flex",
          alignItems: "center",
          gap: "6px",
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          border: "none",
          background: "transparent",
          color: "var(--dsw-alias-label-primary)",
          borderRadius: "6px",
          padding: "6px 8px",
          fontSize: "12px",
          lineHeight: "1.5"
        };
        const inert = { ...item, cursor: "default", color: "var(--dsw-alias-label-secondary)", opacity: "0.6" };
        const primary = draft.trim() === "" ? "predict" : "polish";
        const primaryLabel = primary === "polish" ? polishLabel : predictLabel;
        const primaryBusy = primary === "polish" ? polishBusy : predictBusy;
        const primaryEnabled = primary === "polish" ? polishIdle : !predictBusy;
        const runPrimary = () => {
          if (primary === "polish") void runPolish();
          else runPredict();
        };
        return h(
          "div",
          { style: { position: "relative", display: "inline-flex" } },
          h(
            "div",
            {
              ref: menuAnchor,
              style: {
                display: "inline-flex",
                alignItems: "stretch",
                border: open || polishIdle ? "1px solid var(--dsw-alias-brand-primary)" : "1px solid var(--dsw-alias-border-l1)",
                background: open || polishIdle ? "var(--dsw-alias-bg-layer-1)" : "transparent",
                borderRadius: "6px",
                overflow: "hidden",
                opacity: busy ? "0.6" : "1"
              }
            },
            h("button", {
              ref: button,
              type: "button",
              onClick: runPrimary,
              // Never disabled: a stuck busy state must not make the menu unreachable.
              "aria-disabled": busy || void 0,
              title: polishFailed ? t("polish.failed") : primaryLabel,
              "aria-label": primaryLabel,
              "data-composer-assist": true,
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                cursor: primaryEnabled && !busy ? "pointer" : "default",
                border: "none",
                background: "transparent",
                color: polishFailed ? "var(--dsw-alias-state-error-primary)" : polishIdle || primary === "predict" ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-label-secondary)",
                padding: "2px 6px",
                minHeight: "24px",
                fontSize: "12px",
                fontWeight: "600",
                lineHeight: "1.5",
                whiteSpace: "nowrap"
              }
            }, [
              h("span", { key: "icon", "aria-hidden": true }, primaryBusy ? "\u22EF" : primary === "polish" ? "\u2728" : "\u2192"),
              h("span", { key: "label" }, t(primary === "polish" ? "polish.short" : "predict.short"))
            ]),
            h("button", {
              type: "button",
              onClick: () => {
                if (open) {
                  setShowSettings(false);
                  setOpen(false);
                } else openMenu();
              },
              "aria-haspopup": "menu",
              "aria-expanded": open,
              title: t("assist.more"),
              "aria-label": t("assist.more"),
              "data-composer-assist-more": true,
              style: {
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                border: "none",
                borderLeft: "1px solid var(--dsw-alias-border-l1)",
                background: open ? "var(--dsw-alias-bg-layer-2)" : "transparent",
                color: open ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-label-secondary)",
                padding: "2px 6px",
                minHeight: "24px",
                minWidth: "24px",
                fontSize: "12px",
                lineHeight: "1.5"
              }
            }, h("span", { "aria-hidden": true }, "\u2699"))
          ),
          open && h(
            "div",
            {
              ref: box,
              role: "menu",
              "aria-label": t("assist.more"),
              "data-composer-assist-menu": true,
              style: {
                position: "fixed",
                zIndex: 60,
                left: `${anchor?.left ?? 0}px`,
                bottom: `${anchor?.bottom ?? 0}px`,
                minWidth: showSettings ? "min(440px, calc(100vw - 32px))" : "180px",
                maxWidth: "calc(100vw - 24px)",
                boxSizing: "border-box",
                padding: "4px",
                maxHeight: "min(70vh, 560px)",
                overflowY: "auto",
                border: "1px solid var(--dsw-alias-border-l1)",
                borderRadius: "10px",
                background: "var(--dsw-alias-bg-layer-1)",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)"
              }
            },
            h("button", {
              type: "button",
              role: "menuitem",
              disabled: !polishIdle,
              onClick: () => {
                void runPolish();
              },
              title: polishLabel,
              style: polishIdle ? item : inert
            }, [
              h("span", { key: "icon", "aria-hidden": true }, polishBusy ? "\u22EF" : "\u2728"),
              h("span", { key: "label" }, polishLabel)
            ]),
            h("button", {
              type: "button",
              role: "menuitem",
              "aria-disabled": predictBusy || void 0,
              onClick: runPredict,
              title: predictLabel,
              style: predictBusy ? inert : item
            }, [
              h("span", { key: "icon", "aria-hidden": true }, predictBusy ? "\u22EF" : "\u2192"),
              h("span", { key: "label" }, predictLabel)
            ]),
            h(
              "div",
              { style: { borderTop: "1px solid var(--dsw-alias-border-l1)", margin: "4px 0 0", paddingTop: "4px" } },
              h("button", {
                type: "button",
                role: "menuitem",
                "aria-expanded": showSettings,
                onClick: () => setShowSettings((value) => !value),
                title: t("settings.title"),
                style: item
              }, [
                h("span", { key: "icon", "aria-hidden": true }, "\u2699"),
                h("span", { key: "label" }, t("settings.title"))
              ]),
              showSettings && h(
                "div",
                { style: { padding: "4px 4px 8px" } },
                h(SettingsSection, { t, loadCatalog, embedded: true })
              )
            )
          )
        );
      }
      function ModelPicker({ catalog, value, t, loading, error, onOpen, onPick }) {
        const [open, setOpen] = useState(false);
        const [query, setQuery] = useState("");
        const box = useRef(null);
        const field = useRef(null);
        useEffect(() => {
          if (!open) return;
          const onDown = (event) => {
            if (box.current?.contains(event.target) === true) return;
            setOpen(false);
          };
          const onKey = (event) => {
            if (event.key === "Escape") setOpen(false);
          };
          document.addEventListener("mousedown", onDown);
          document.addEventListener("keydown", onKey);
          return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
          };
        }, [open]);
        const selected = catalog.find((entry) => `${entry.provider}\0${entry.id}` === value);
        const label = selected === void 0 ? value === "" ? t("settings.model.inherit") : value.replace("\0", " \xB7 ") : `${selected.provider} \xB7 ${selected.name}`;
        const needle = query.trim().toLowerCase();
        const pickerField = {
          background: "var(--dsw-alias-bg-layer-2)",
          color: "var(--dsw-alias-label-primary)",
          border: "1px solid var(--dsw-alias-border-l1)",
          borderRadius: "8px",
          padding: "6px 10px",
          fontSize: "13px"
        };
        const matches = needle === "" ? catalog : catalog.filter((entry) => `${entry.provider} ${entry.id} ${entry.name}`.toLowerCase().includes(needle));
        const option = {
          display: "flex",
          alignItems: "baseline",
          gap: "8px",
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          border: "none",
          background: "transparent",
          color: "var(--dsw-alias-label-primary)",
          borderRadius: "6px",
          padding: "6px 8px",
          fontSize: "12px",
          lineHeight: "1.5"
        };
        return h(
          "div",
          { ref: box, style: { position: "relative", minWidth: "260px" } },
          h(
            "button",
            {
              type: "button",
              "aria-haspopup": "listbox",
              "aria-expanded": open,
              "data-model-picker": true,
              title: label,
              onClick: () => {
                const next = !open;
                setOpen(next);
                if (next) {
                  setQuery("");
                  onOpen?.();
                  field.current?.focus();
                }
              },
              style: {
                ...pickerField,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                cursor: "pointer",
                textAlign: "left"
              }
            },
            h("span", { style: { flex: "1 1 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label),
            h("span", { "aria-hidden": true, style: { color: "var(--dsw-alias-label-secondary)" } }, "\u25BE")
          ),
          open && h(
            "div",
            {
              style: {
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                zIndex: 40,
                width: "min(360px, 80vw)",
                boxSizing: "border-box",
                padding: "6px",
                border: "1px solid var(--dsw-alias-border-l1)",
                borderRadius: "10px",
                background: "var(--dsw-alias-bg-layer-1)"
              }
            },
            h("input", {
              ref: field,
              type: "search",
              value: query,
              placeholder: t("settings.model.search"),
              "aria-label": t("settings.model.search"),
              onChange: (event) => setQuery(event.target.value),
              style: { ...pickerField, width: "100%", minWidth: 0, marginBottom: "6px", boxSizing: "border-box" }
            }),
            h(
              "div",
              { role: "listbox", style: { maxHeight: "240px", overflowY: "auto" } },
              h("button", {
                type: "button",
                role: "option",
                "aria-selected": value === "",
                onClick: () => {
                  onPick?.(null);
                  setOpen(false);
                },
                style: option
              }, t("settings.model.inherit")),
              matches.map((entry) => h(
                "button",
                {
                  key: `${entry.provider}\0${entry.id}`,
                  type: "button",
                  role: "option",
                  "aria-selected": `${entry.provider}\0${entry.id}` === value,
                  onClick: () => {
                    onPick?.(entry);
                    setOpen(false);
                  },
                  style: `${entry.provider}\0${entry.id}` === value ? { ...option, background: "var(--dsw-alias-bg-layer-2)" } : option
                },
                h("span", { style: { flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" } }, entry.name),
                h("span", { style: { flex: "0 0 auto", fontSize: "11px", color: "var(--dsw-alias-label-secondary)" } }, entry.provider)
              )),
              // Say which of the three reasons applies: a failed read, a slow one, or a
              // filter that simply matched nothing. They need different user actions.
              matches.length === 0 && h("div", {
                style: {
                  padding: "8px",
                  fontSize: "12px",
                  lineHeight: "1.5",
                  color: error !== "" ? "var(--dsw-alias-state-error-primary)" : "var(--dsw-alias-label-secondary)",
                  wordBreak: "break-word"
                }
              }, error !== "" ? error : loading ? t("settings.model.loading") : t("settings.model.noMatch"))
            )
          )
        );
      }
      function SettingsSection({ t, loadCatalog, embedded = false }) {
        const [settings, setSettings] = useState(settingsStore.value);
        const [catalog, setCatalog] = useState([]);
        const [error, setError] = useState("");
        useEffect(() => {
          if (settingsStore.value === null) void readSettings();
          return settingsStore.subscribe(() => {
            setSettings(settingsStore.value);
          });
        }, []);
        useEffect(() => {
          if (settingsStore.value !== null) void refreshCatalog();
        }, [settings !== null]);
        const save = async (patch) => {
          setError("");
          const body = await saveSettings(patch);
          if (body?.ok !== true) setError(t("settings.saveFailed"));
        };
        const [catalogState, setCatalogState] = useState("idle");
        const [catalogError, setCatalogError] = useState("");
        const refreshCatalog = async () => {
          if (catalog.length > 0 || catalogState === "loading") return;
          setCatalogState("loading");
          setCatalogError("");
          try {
            const rows = await loadCatalog();
            setCatalog(Array.isArray(rows) ? rows : []);
            setCatalogState("done");
          } catch (failure) {
            setCatalogError(failure instanceof Error ? failure.message : String(failure));
            setCatalogState("failed");
          }
        };
        const current = settings;
        const labelStyle = { fontSize: "13px", fontWeight: "600", lineHeight: "1.5", color: "var(--dsw-alias-label-primary)" };
        const hintStyle = { fontSize: "12px", lineHeight: "1.5", color: "var(--dsw-alias-label-secondary)", marginTop: "1px" };
        const selectStyle = {
          background: "var(--dsw-alias-bg-layer-2)",
          color: "var(--dsw-alias-label-primary)",
          border: "1px solid var(--dsw-alias-border-l1)",
          borderRadius: "8px",
          padding: "6px 10px",
          fontSize: "13px",
          lineHeight: "1.5",
          // Sized to its own longest option, not a fixed width: a hard 200px clipped
          // "输入框上方的建议栏（推荐）" mid-word.
          boxSizing: "border-box",
          width: "auto",
          minWidth: "210px",
          maxWidth: "300px"
        };
        const value = current?.provider !== void 0 && current?.provider !== "" ? `${current.provider}\0${current.model}` : "";
        const number = (key, min, max) => h("input", {
          type: "number",
          min,
          max,
          value: current?.[key] ?? "",
          onChange: (event) => {
            const parsed = Number(event.target.value);
            if (Number.isFinite(parsed)) void save({ [key]: parsed });
          },
          style: { ...selectStyle, minWidth: "120px" }
        });
        const sectionHeading = (title) => h("div", {
          style: {
            fontSize: "12px",
            fontWeight: "600",
            lineHeight: "1.5",
            color: "var(--dsw-alias-label-secondary)",
            margin: "20px 0 2px"
          }
        }, title);
        const control = {
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "10px"
        };
        const settingRow = (label, hint, node, { top = true } = {}) => h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "24px",
              padding: "11px 0",
              borderTop: top ? "1px solid var(--dsw-alias-border-l1)" : "none"
            }
          },
          h(
            "div",
            { style: { minWidth: 0 } },
            h("div", { style: labelStyle }, label),
            h("div", { style: hintStyle }, hint)
          ),
          h("div", { style: control }, node)
        );
        const toggle = (key, checked) => h("input", {
          type: "checkbox",
          checked,
          onChange: (event) => {
            void save({ [key]: event.target.checked });
          }
        });
        const modeValue = current?.mode ?? "auto";
        const displayValue = current?.display === "inline" ? "inline" : "bar";
        const unit = (key, bounds, suffix, per = 1) => {
          const stored = current?.[key];
          const shown = Number.isFinite(stored) ? stored / per : "";
          return h(
            "div",
            {
              style: { display: "flex", alignItems: "center", gap: "8px" }
            },
            h("input", {
              type: "number",
              step: per === 1 ? 1 : 0.5,
              min: bounds[0] / per,
              max: bounds[1] / per,
              value: shown,
              onChange: (event) => {
                const parsed = Number(event.target.value);
                if (!Number.isFinite(parsed)) return;
                void save({ [key]: Math.round(parsed * per) });
              },
              style: { ...selectStyle, width: "110px", minWidth: "110px", textAlign: "right" }
            }),
            h("span", {
              style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)", minWidth: "26px" }
            }, suffix)
          );
        };
        return h(
          "div",
          { style: { padding: embedded ? "0" : "4px 0 32px", maxWidth: "680px" } },
          // No heading at all. The settings nav already labels this page, and the popover
          // is opened from a menu item that names it — a third copy was pure repetition.
          h("p", {
            style: {
              fontSize: "12px",
              lineHeight: "1.6",
              margin: "0 0 2px",
              color: "var(--dsw-alias-label-secondary)"
            }
          }, t("settings.description")),
          sectionHeading(t("settings.group.behavior")),
          h(
            "div",
            null,
            settingRow(
              t("settings.enabled"),
              t("settings.enabledHint"),
              toggle("enabled", current?.enabled === true),
              { top: false }
            ),
            settingRow(
              t("settings.mode"),
              t("settings.modeHint"),
              h("select", {
                style: selectStyle,
                value: modeValue,
                onChange: (event) => {
                  void save({ mode: event.target.value });
                }
              }, ["auto", "word", "both", "off"].map((mode) => h("option", { key: mode, value: mode }, t(`settings.mode.${mode}`))))
            ),
            settingRow(
              t("settings.display"),
              t("settings.displayHint"),
              h("select", {
                style: selectStyle,
                value: displayValue,
                onChange: (event) => {
                  void save({ display: event.target.value });
                }
              }, ["bar", "inline"].map((display) => h("option", { key: display, value: display }, t(`settings.display.${display}`))))
            ),
            settingRow(
              t("settings.model"),
              t("settings.modelHint"),
              h(ModelPicker, {
                catalog,
                value,
                t,
                loading: catalogState === "loading",
                error: catalogState === "failed" ? catalogError : "",
                onOpen: () => {
                  void refreshCatalog();
                },
                onPick: (entry) => {
                  void save(entry === null ? { provider: "", model: "" } : { provider: entry.provider, model: entry.id });
                }
              })
            )
          ),
          sectionHeading(t("settings.group.budget")),
          h(
            "div",
            null,
            settingRow(
              t("settings.maxOutputTokens"),
              t("settings.maxOutputTokensHint"),
              unit("maxOutputTokens", [100, 4e3], "tok"),
              { top: false }
            ),
            settingRow(
              t("settings.debounceMs"),
              t("settings.debounceMsHint"),
              unit("debounceMs", [200, 5e3], "s", 1e3)
            ),
            settingRow(
              t("settings.timeoutMs"),
              t("settings.timeoutMsHint"),
              unit("timeoutMs", [2e3, 12e4], "s", 1e3)
            ),
            settingRow(
              t("settings.maxInputChars"),
              t("settings.maxInputCharsHint"),
              unit("maxInputChars", [1e3, 1e5], "chars")
            ),
            settingRow(
              t("settings.minConfidence"),
              t("settings.minConfidenceHint"),
              unit("minConfidence", [0, 1], "0\u20131", 0.1)
            )
          ),
          // One way back: a mistyped budget or timeout had no undo except remembering the
          // old number. Values come from the Host's own DEFAULTS, not a client copy.
          h(
            "div",
            { style: { display: "flex", justifyContent: "flex-end", padding: "10px 0 0" } },
            h("button", {
              type: "button",
              onClick: async () => {
                const d = settingsStore.defaults;
                if (d === void 0) return;
                setError("");
                const patch = {};
                for (const key of ["maxOutputTokens", "debounceMs", "timeoutMs", "maxInputChars", "minConfidence"]) {
                  if (d[key] !== void 0) patch[key] = d[key];
                }
                const body = await saveSettings(patch);
                if (body?.ok !== true) setError(t("settings.saveFailed"));
              },
              title: t("settings.restoreHint"),
              style: {
                cursor: "pointer",
                border: "none",
                background: "transparent",
                color: "var(--dsw-alias-label-secondary)",
                padding: "2px 4px",
                fontSize: "12px",
                textDecoration: "underline"
              }
            }, t("settings.restore"))
          ),
          sectionHeading(t("settings.group.learning")),
          h(
            "div",
            null,
            settingRow(
              t("settings.learn"),
              t("settings.learnHint"),
              h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: "10px" } },
                toggle("learn", current?.learn === true),
                h("button", {
                  type: "button",
                  onClick: async () => {
                    setError("");
                    const body = await recordFeedback("reset", "");
                    if (body?.ok !== true) setError(t("settings.resetFailed"));
                    await readSettings();
                  },
                  title: t("settings.resetHint"),
                  style: {
                    cursor: "pointer",
                    border: "1px solid var(--dsw-alias-border-l1)",
                    background: "transparent",
                    color: "var(--dsw-alias-label-secondary)",
                    borderRadius: "8px",
                    padding: "5px 12px",
                    fontSize: "12px"
                  }
                }, t("settings.reset"))
              ),
              { top: false }
            )
          ),
          h("p", {
            style: {
              fontSize: "12px",
              lineHeight: "1.6",
              margin: "20px 0 0",
              color: "var(--dsw-alias-label-secondary)"
            }
          }, t("settings.costNote")),
          h("p", {
            style: {
              fontSize: "12px",
              lineHeight: "1.6",
              margin: "8px 0 0",
              color: "var(--dsw-alias-label-secondary)"
            }
          }, t("settings.subagentNote")),
          error !== "" && h("p", { style: { fontSize: "12px", color: "var(--dsw-alias-state-error-primary)", marginTop: "12px" } }, error)
        );
      }
      return {
        inject: ["slots", "locale", "shortcuts", "remote", "remote.session"],
        apply(ctx) {
          ctx.effect(() => ctx.locale.register(NS, { zh, en }), "composer-assist: dictionaries");
          void readSettings();
          const t = ctx.locale.bind(NS);
          const loadCatalog = async () => {
            const response = await fetch(`${API}/models`);
            let body;
            try {
              body = await readJsonResponse(response, "models");
            } catch (failure) {
              if (!response.ok) throw new Error(`${t("settings.model.routeMissing")} (HTTP ${response.status})`);
              throw new Error(`${t("settings.model.badResponse")}: ${failure.message}`);
            }
            if (body.ok !== true) throw new Error(body.error ?? body.reason ?? t("settings.model.badResponse"));
            if (!Array.isArray(body.models)) throw new Error(t("settings.model.badResponse"));
            const rows = [];
            for (const entry of body.models) {
              if (entry === null || typeof entry !== "object") continue;
              if (typeof entry.provider !== "string" || typeof entry.id !== "string") continue;
              rows.push({
                provider: entry.provider,
                id: entry.id,
                name: typeof entry.name === "string" && entry.name !== "" ? entry.name : entry.id
              });
            }
            return rows;
          };
          const useSettings = () => {
            const [value, setValue] = useState(settingsStore.value);
            useEffect(() => {
              setValue(settingsStore.value);
              return settingsStore.subscribe(() => {
                setValue(settingsStore.value);
              });
            }, []);
            return value;
          };
          function StripSlot(props) {
            const settings = useSettings();
            return h(
              React.Fragment,
              null,
              h(SuggestionStrip, { ...props, settings, t }),
              h(RequestTiming, { sessionId: props.sessionId, settings, t })
            );
          }
          ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
            name: "conversation.input.dock",
            id: "composer-assist",
            order: 10,
            locale: NS
          }, StripSlot));
          ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
            name: "conversation.input.left",
            id: "composer-assist-assist",
            order: 10,
            locale: NS,
            inject: () => ({ loadCatalog })
          }, AssistButton));
          ctx.slots.inject("settings.section", () => ctx.slots.register({
            name: "settings.section",
            id: "composer-assist",
            order: 35,
            locale: NS,
            // Short label: this is a nav row, and the full name lives in the menu item.
            label: () => t("settings.nav"),
            inject: () => ({ loadCatalog })
          }, SettingsSection));
          ctx.effect(() => () => {
            disposeGhosts();
          }, "composer-assist: release inline ghost");
          ctx.effect(() => ctx.shortcuts.observeFixedInput((input) => {
            if (input.type !== "keydown") return;
            if (input.gesture.code !== "Tab") return;
            if (input.gesture.shift || input.gesture.control || input.gesture.alt || input.gesture.meta) return;
            if (input.gesture.composing || input.gesture.defaultPrevented) return;
            if (input.context.region !== "editable" || input.context.modal !== null) return;
            const focused = document.activeElement;
            if (!(focused instanceof Element) || focused.closest("[data-composer-input]") === null) return;
            if (acceptRef.current?.() !== true) return;
            input.consume();
          }), "composer-assist: Tab accepts a prediction");
        }
      };
    }
  });
})();
