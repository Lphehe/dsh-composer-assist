import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const addon = join(root, 'packages/dsh-composer-fusion')
const dist = join(addon, 'dist')

function runNode(script) {
  const result = spawnSync(process.execPath, [script], { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(script + ' failed with exit ' + result.status)
}

rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

// Generated upstream declarations and JS are needed to bundle both ESM entries.
// This never changes the published prediction package's client bundle.
runNode(join(root, 'scripts/build-workflow.mjs'))

// The vendored TypeScript compiler is CommonJS and uses require('fs') at module
// initialization. Preserve a real Node require in the ESM bundle instead of
// esbuild's throwing dynamic-require shim. Keep this Node-only banner OUT of the
// browser client bundle.
const nodeBanner = { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" }
const common = { bundle: true, logLevel: 'info', legalComments: 'eof' }
await build({
  ...common,
  entryPoints: [join(root, 'workflow/plugin.js')],
  outfile: join(dist, 'index.js'),
  format: 'esm', platform: 'node', target: 'node22', banner: nodeBanner,
})
// compiler worker is a separate Node Worker script, referenced by the Host
// through new URL('./compiler-worker.js', import.meta.url).
await build({
  ...common,
  entryPoints: [join(root, 'workflow/host/compiler-worker.js')],
  outfile: join(dist, 'compiler-worker.js'),
  format: 'esm', platform: 'node', target: 'node22',
})
await build({
  ...common,
  entryPoints: [join(addon, 'client-entry.js')],
  outfile: join(dist, 'client.js'),
  format: 'iife', platform: 'browser', target: 'es2022',
})

const legalOut = join(dist, 'licenses')
mkdirSync(legalOut, { recursive: true })
for (const filename of ['LICENSE', 'NOTICE.md', 'THIRD-PARTY-NOTICES.md', 'TYPESCRIPT-LICENSE.txt', 'TYPESCRIPT-NOTICES.txt']) {
  copyFileSync(join(root, 'vendor/zcode', filename), join(legalOut, filename))
}
console.log('Standalone Fusion addon bundled: Host + compiler Worker + Client + upstream notices.')
