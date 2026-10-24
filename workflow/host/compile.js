import { Worker } from 'node:worker_threads'

const queue = []
let running = false
const invalid = message => Object.assign(new Error(message), { code: 'WorkflowAnalysisLimit' })
const checkSource = script => { if (typeof script !== 'string' || !script.trim() || Buffer.byteLength(script) > 512 * 1024) throw invalid('工作流脚本必须是非空 TypeScript，且不超过 512 KiB') }

/** Analysis is synchronous upstream; a terminated worker is the actual wall-clock boundary. */
function runWorker(data, signal, timeoutMs = 10000) {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./compiler-worker.js', import.meta.url), { workerData: data, execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 384, stackSizeMb: 4 } })
    let settled = false
    const finish = (error, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      worker.terminate().catch(() => {}).then(() => error ? reject(error) : resolve(value))
    }
    const abort = () => finish(signal.reason instanceof Error ? signal.reason : new Error('工作流分析已取消'))
    const timer = setTimeout(() => finish(invalid('工作流分析超过 10 秒，请缩小流程规模或减少辅助函数展开')), timeoutMs)
    timer.unref()
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) { abort(); return }
    worker.once('message', response => {
      if (response.ok) finish(undefined, response.value)
      else finish(Object.assign(new Error(response.error.message), { code: response.error.code, diagnostics: response.error.diagnostics }))
    })
    worker.once('error', error => finish(Object.assign(error, { code: error.code === 'ERR_WORKER_OUT_OF_MEMORY' ? 'WorkflowAnalysisLimit' : error.code })))
    worker.once('exit', code => { if (!settled) finish(invalid(`工作流分析进程在返回结果前退出（${code}）`)) })
  })
}
function pump() {
  if (running || !queue.length) return
  running = true
  const job = queue.shift()
  job.signal.removeEventListener('abort', job.abort)
  Promise.resolve().then(() => runWorker(job.data, job.signal)).then(job.resolve, job.reject).finally(() => { running = false; pump() })
}
function schedule(data, signal) {
  signal.throwIfAborted()
  if (queue.length + Number(running) >= 8) return Promise.reject(invalid('工作流分析队列已满，请等待当前分析完成'))
  return new Promise((resolve, reject) => {
    const job = { data, signal, resolve, reject, abort: undefined }
    job.abort = () => { const index = queue.indexOf(job); if (index >= 0) { queue.splice(index, 1); reject(signal.reason ?? new Error('工作流分析已取消')) } }
    signal.addEventListener('abort', job.abort, { once: true })
    queue.push(job)
    pump()
  })
}

export function createCompilerScope() {
  const abort = new AbortController()
  const cache = new Map()
  const tasks = new Set()
  const track = promise => { tasks.add(promise); promise.finally(() => tasks.delete(promise)).catch(() => {}); return promise }
  const remember = (script, promise) => { if (cache.size >= 8) cache.delete(cache.keys().next().value); cache.set(script, promise); promise.catch(() => { if (cache.get(script) === promise) cache.delete(script) }); return promise }
  const compiler = {
    compile(script) {
      checkSource(script)
      abort.signal.throwIfAborted()
      if (cache.has(script)) return cache.get(script)
      return remember(script, track(schedule({ kind: 'compile', script }, abort.signal)))
    },
    async requireCompiled(script) {
      const compiled = await compiler.compile(script)
      if (!compiled.analysis.ok) {
        const error = new Error(compiled.analysis.diagnostics.map(d => `${d.line}:${d.column} ${d.message}`).join('\n'))
        Object.assign(error, { code: 'WorkflowCompileError', diagnostics: compiled.analysis.diagnostics })
        throw error
      }
      return compiled
    },
    async compileHole(script, siteId, body) {
      checkSource(script)
      if (typeof body !== 'string' || !body.trim() || Buffer.byteLength(body) > 512 * 1024) throw invalid('留白补全代码必须是非空且不超过 512 KiB 的 TypeScript')
      const result = await track(schedule({ kind: 'hole', script, siteId, body }, abort.signal))
      remember(result.script, Promise.resolve(result.compiled))
      return result
    },
    async dispose() { abort.abort(new Error('工作流编译器已关闭')); await Promise.allSettled([...tasks]); cache.clear() },
  }
  return compiler
}
const defaultCompiler = createCompilerScope()
export const compile = script => defaultCompiler.compile(script)
export const requireCompiled = script => defaultCompiler.requireCompiled(script)
export const compileHole = (script, siteId, body) => defaultCompiler.compileHole(script, siteId, body)
export const __test = { runWorker }
