import { spawnSync } from 'node:child_process'
import { cpSync, realpathSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'package.json'))
const tsc = require.resolve('typescript/bin/tsc')

function run(script, args, cwd) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const vendor = join(root, 'vendor/zcode')
const core = join(vendor, 'dynamic-workflow')
run(join(core, 'scripts/generate-libs.mjs'), [], core)

for (const name of ['dynamic-workflow', 'dynamic-workflow-runtime']) {
  const source = join(vendor, name)
  run(tsc, ['-p', join(source, 'tsconfig.json')], root)
  // pnpm file: dependencies are copies; refresh their generated output for local consumers.
  const installed = realpathSync(join(root, 'node_modules/@zcode', name))
  if (installed !== realpathSync(source)) {
    // pnpm file: deps are copies; Node 26 can reject overwriting generated
    // declarations with ERR_FS_CP_EEXIST. Refresh only the generated dist.
    rmSync(join(installed, 'dist'), { recursive: true, force: true })
    cpSync(join(source, 'dist'), join(installed, 'dist'), { recursive: true })
  }
}
