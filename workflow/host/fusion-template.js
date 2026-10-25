/**
 * Opt-in Fusion recipe for the isolated ZCode workflow host.
 *
 * This module prepares a draft only. Execution still requires the existing
 * first-launch confirmation and DSH's tool/sandbox permissions.
 */
const cleanText = (value, name, limit) => {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || value.includes('\0')) {
    throw new TypeError(name + ' must be a non-empty string of at most ' + limit + ' characters')
  }
  return value.trim()
}

const modelName = (value, name) => {
  if (value === undefined || value === null || value === '') return undefined
  const model = cleanText(value, name, 160)
  if (/[\r\n]/.test(model)) throw new TypeError(name + ' cannot contain newlines')
  return model
}

const actor = (variable, title, system, model) =>
  'const ' + variable + ' = agent(' + JSON.stringify(title) +
  ', { system: ' + JSON.stringify(system) +
  (model === undefined ? '' : ', model: ' + JSON.stringify(model)) + ' });'

/**
 * Compile-free recipe generator. User task text stays in structured run args
 * instead of being interpolated into the TypeScript program.
 *
 * The caller must route the returned script through manager.prepare(); it
 * must never call manager.launch() without the existing human launch gate.
 */
export function createFusionDraft(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Fusion options must be an object')
  }
  const task = cleanText(input.task, 'task', 12000)
  const name = input.name === undefined ? 'Fusion · 协作修复' : cleanText(input.name, 'name', 120)
  const maxRounds = input.maxRounds ?? 2
  if (!Number.isInteger(maxRounds) || maxRounds < 1 || maxRounds > 3) {
    throw new RangeError('maxRounds must be 1–3')
  }
  const testScript = input.testScript ?? 'selfcheck'
  if (typeof testScript !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(testScript)) {
    throw new TypeError('testScript must be a single npm script name')
  }
  const timeoutMs = input.timeoutMs ?? 180000
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) {
    throw new RangeError('timeoutMs must be between 1000 and 300000')
  }
  const leadModel = modelName(input.leadModel, 'leadModel')
  const sidekickModel = modelName(input.sidekickModel, 'sidekickModel')
  const reviewModel = modelName(input.reviewModel, 'reviewModel')

  // Actors own independent DSH sessions. A model reference, if specified, is
  // checked against the parent session's approved routes by resolveRoutes().
  const lines = [
    'interface FusionPlan { steps: string[]; acceptance: string[]; risks: string[] }',
    'interface FusionChange { summary: string; files: string[]; notes: string }',
    'interface FusionReview { approved: boolean; blockingIssues: string[]; notes: string }',
    'interface FusionSignoff { approved: boolean; summary: string; residualRisks: string[] }',
    actor('lead', 'Fusion Lead',
      'Plan the engineering work. Define testable acceptance criteria. Review the independent verification evidence before sign-off. Do not claim completion without proof.',
      leadModel),
    actor('builder', 'Fusion Sidekick',
      'Implement the assigned change in the current workspace with minimal diffs. Use the inherited DSH tools and permissions. Return the files changed. Do not merge, push or deploy.',
      sidekickModel),
    actor('reviewer', 'Fusion Reviewer',
      '[fusion-review-only:v1] Independently inspect the implementation and Git changes. Use read-only tools; do not edit, deploy or approve without evidence. Report concrete blocking issues as structured data.',
      reviewModel),
    'const cfg = args as { task: string; maxRounds: number; testScript: string; timeoutMs: number };',
    'phase("计划");',
    'const plan = await lead.ask<FusionPlan>(JSON.stringify({ task: cfg.task, objective: "produce a tested patch" }));',
    'phase("实现、验证与独立审查");',
    'let accepted = false;',
    'let lastChange: FusionChange | null = null;',
    'let lastTest: { exitCode: number; stdout: string; stderr: string } | null = null;',
    'let lastReview: FusionReview | null = null;',
    'let rounds = 0;',
    'for (let attempt = 1; attempt <= cfg.maxRounds; attempt++) {',
    '  rounds = attempt;',
    '  lastChange = await builder.ask<FusionChange>(JSON.stringify({ task: cfg.task, plan, attempt, priorTest: lastTest, priorReview: lastReview }));',
    '  // This uses the DSH native Bash tool; first launch remains human-confirmed.',
    '  // Non-zero exit codes are observed, never overwritten by an LLM judgment.',
    '  lastTest = await world.run("pnpm", ["run", cfg.testScript], { timeoutMs: cfg.timeoutMs });',
    '  const diff = await git.diff();',
    '  lastReview = await reviewer.ask<FusionReview>(JSON.stringify({ task: cfg.task, plan, change: lastChange, test: { exitCode: lastTest.exitCode, stdout: lastTest.stdout.slice(-6000), stderr: lastTest.stderr.slice(-6000) }, diff: String(diff).slice(0, 16000), attempt }));',
    '  if (lastTest.exitCode === 0 && lastReview.approved && lastReview.blockingIssues.length === 0) {',
    '    accepted = true;',
    '    break;',
    '  }',
    '}',
    'phase("最终签收");',
    'const signoff = await lead.ask<FusionSignoff>(JSON.stringify({ task: cfg.task, plan, accepted, rounds, change: lastChange, testExitCode: lastTest?.exitCode, review: lastReview }));',
    'const success = accepted && signoff.approved;',
    'return { success, rounds, plan, change: lastChange, test: lastTest, review: lastReview, signoff };',
  ]
  return {
    name,
    script: lines.join('\n') + '\n',
    args: { task, maxRounds, testScript, timeoutMs },
    concurrency: 3,
  }
}
