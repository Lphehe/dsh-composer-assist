import {
  analyzeWorkflowScript, createWorkflowProgram, collectSites, synthesizeAskSchemas,
  buildAskSpecs, lowerWorkflow, collectSitePhases, collectPhaseNames, inputHash,
  spliceHoleBody, checkSiteStability,
} from '@zcode/dynamic-workflow'

const cache = new Map()
const plain = value => JSON.parse(JSON.stringify(value, (_key, item) => item instanceof Map ? Object.fromEntries(item) : item instanceof Set ? [...item] : item))

/** Only the bounded compiler worker imports this synchronous upstream pipeline. */
export function compile(script) {
  if (typeof script !== 'string' || !script.trim() || Buffer.byteLength(script) > 512 * 1024) throw new Error('工作流脚本必须是非空 TypeScript，且不超过 512 KiB')
  if (cache.has(script)) return cache.get(script)
  const analysis = analyzeWorkflowScript(script)
  const program = createWorkflowProgram(script)
  const table = collectSites(program)
  const synthesis = synthesizeAskSchemas(program, table)
  const diagnostics = [...analysis.diagnostics, ...synthesis.diagnostics]
  const publicAnalysis = plain({ ...analysis, core: undefined, diagnostics, ok: analysis.ok && synthesis.diagnostics.length === 0, schemas: synthesis.schemas, phases: collectPhaseNames(analysis.flow) })
  const lowered = publicAnalysis.ok ? lowerWorkflow(program, table) : undefined
  const compiled = { analysis: publicAnalysis, table, askSpecs: buildAskSpecs(table, synthesis.schemas), lowered, sitePhases: analysis.core ? collectSitePhases(analysis.core) : new Map(), hash: inputHash(script) }
  cache.set(script, compiled)
  return compiled
}

export function requireCompiled(script) {
  const compiled = compile(script)
  if (!compiled.analysis.ok) {
    const error = new Error(compiled.analysis.diagnostics.map(d => `${d.line}:${d.column} ${d.message}`).join('\n'))
    error.code = 'WorkflowCompileError'
    error.diagnostics = compiled.analysis.diagnostics
    throw error
  }
  return compiled
}

export function compileHole(script, siteId, body) {
  if (typeof body !== 'string' || !body.trim()) throw new Error('留白补全代码不能为空')
  const before = requireCompiled(script)
  const splice = spliceHoleBody(script, before.table, siteId, body)
  if (!splice) throw new Error('该留白不存在或已经补全')
  const next = requireCompiled(splice.text)
  const stable = checkSiteStability(before.table, next.table, siteId, splice.insertedAtLine, splice.insertedLines)
  if (!stable.ok) throw new Error(stable.detail)
  return { script: splice.text, compiled: next }
}
