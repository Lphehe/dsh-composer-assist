import assert from 'node:assert/strict'
import { createCompilerScope } from './compile.js'
import { createFusionDraft } from './fusion-template.js'

const compiler = createCompilerScope()
try {
  const draft = createFusionDraft({
    task: '修复一个稳定复现的 Bug',
    leadModel: 'provider/lead',
    sidekickModel: 'provider/sidekick',
    reviewModel: 'provider/reviewer',
    maxRounds: 2,
    testScript: 'selfcheck',
  })
  const compiled = await compiler.requireCompiled(draft.script)
  assert.equal(compiled.analysis.ok, true)
  assert((compiled.analysis.phases ?? []).length > 0 || compiled.analysis.phases !== undefined)
  const references = compiled.analysis.modelReferences ?? []
  for (const id of ['provider/lead', 'provider/sidekick', 'provider/reviewer']) {
    assert(references.some(row => row.name === id || row.model === id), 'missing model binding ' + id)
  }
  console.log('Fusion ZCode compiler selfcheck passed')
} finally {
  await compiler.dispose()
}
