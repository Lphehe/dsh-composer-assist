import { parentPort, workerData } from 'node:worker_threads'
import { compile, compileHole } from './compile-sync.js'

const pack = ({ table: _table, ...compiled }) => compiled
try {
  const value = workerData.kind === 'hole'
    ? (() => { const result = compileHole(workerData.script, workerData.siteId, workerData.body); return { script: result.script, compiled: pack(result.compiled) } })()
    : pack(compile(workerData.script))
  const serialized = JSON.stringify(value, (_key, item) => item instanceof Map ? Object.fromEntries(item) : item)
  if (Buffer.byteLength(serialized) > 8 * 1024 * 1024) throw Object.assign(new Error('工作流分析产物超过 8 MiB，请缩小流程规模或减少展开的辅助函数'), { code: 'WorkflowAnalysisLimit' })
  parentPort.postMessage({ ok: true, value })
} catch (error) {
  parentPort.postMessage({ ok: false, error: { message: error.message, code: error.code ?? 'WorkflowCompileError', diagnostics: error.diagnostics } })
}
