import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const addon = join(root, 'packages/dsh-composer-fusion')
const pkg = JSON.parse(readFileSync(join(addon, 'package.json'), 'utf8'))
assert.equal(pkg.private, true, 'experimental addon must not auto-publish to npm')
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
assert.equal(pkg.exports['.'], './dist/index.js')
assert.equal(pkg.exports['./client'], './dist/client.js')
assert(!Object.values(pkg.exports).some(x => /vendor|node_modules/.test(x)))
const files = ['dist/index.js', 'dist/client.js', 'dist/compiler-worker.js',
  'dist/licenses/LICENSE', 'dist/licenses/NOTICE.md',
  'dist/licenses/THIRD-PARTY-NOTICES.md',
  'dist/licenses/TYPESCRIPT-LICENSE.txt', 'dist/licenses/TYPESCRIPT-NOTICES.txt']
for (const file of files) {
  const full = join(addon, file)
  assert(existsSync(full) && statSync(full).size > 0, 'missing generated package file ' + file)
  if (file.endsWith('.js')) {
    const checked = spawnSync(process.execPath, ['--check', full], { encoding: 'utf8' })
    assert.equal(checked.status, 0, checked.stderr || file + ' failed syntax check')
  }
}
const host = readFileSync(join(addon, 'dist/index.js'), 'utf8')
const client = readFileSync(join(addon, 'dist/client.js'), 'utf8')
assert(host.includes('zcode_workflow'), 'Host tool not bundled')
assert(host.includes('/api/composer-assist/workflow'), 'Host authenticated route not bundled')
assert(host.includes('fusion_create'), 'Fusion Host action not bundled')
assert(client.includes('conversation.view'), 'workflow UI slot missing')
assert(client.includes('Fusion'), 'Fusion form not bundled')
const result = spawnSync('npm', ['pack', '--ignore-scripts', '--dry-run', '--json'], {
  cwd: addon, encoding: 'utf8',
})
if (result.error) throw result.error
assert.equal(result.status, 0, result.stderr || 'npm pack dry-run failed')
const packages = JSON.parse(result.stdout)
assert.equal(packages.length, 1)
const packed = new Set(packages[0].files.map(f => f.path))
for (const file of files) assert(packed.has(file), 'npm package omits ' + file)
assert(packed.has('cordis.patch.yml'), 'DSH Host installation patch omitted')
assert(packed.has('NOTICE.md'), 'provenance notice omitted')
assert(![...packed].some(f => f.startsWith('src/') || f.startsWith('node_modules/') || f.includes('.env')),
  'source tree, dependencies or credentials included unexpectedly')
const hostEntry = await import(join(addon, 'dist/index.js'))
assert.equal(typeof hostEntry.apply, 'function')
assert(Array.isArray(hostEntry.inject))
console.log('Fusion addon package contract passed: standalone Host, Worker, UI, license and npm file inventory.')
