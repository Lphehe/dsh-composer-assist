// Test the actual development-preview tarball, not just files in the source checkout.
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const cwd = new URL('../', import.meta.url).pathname
const root = mkdtempSync(join(tmpdir(), 'dsh-fusion-pack-'))
try {
  execFileSync('pnpm', ['pack', '--pack-destination', root], { cwd, stdio: 'pipe' })
  const archive = readdirSync(root).find(name => name.endsWith('.tgz'))
  assert(archive, 'pnpm pack did not produce a tarball')
  const tar = join(root, archive)
  const entries = execFileSync('tar', ['-tzf', tar], { encoding: 'utf8' }).trim().split('\n')
  const required = [
    'package/index.js',
    'package/dist/client.js',
    'package/dist/workflow-host.js',
    'package/dist/compiler-worker.js',
    'package/node_modules/@zcode/dynamic-workflow/dist/index.js',
    'package/node_modules/@zcode/dynamic-workflow-runtime/dist/index.js',
    'package/node_modules/typescript/lib/typescript.js',
  ]
  for (const path of required) assert(entries.includes(path), 'Missing preview package asset: ' + path)
  execFileSync('tar', ['-xzf', tar, '-C', root], { stdio: 'pipe' })
  const pkgDir = join(root, 'package')
  const host = await import(pathToFileURL(join(pkgDir, 'dist/workflow-host.js')).href)
  assert.equal(typeof host.apply, 'function', 'packed Cordis Host must export apply(ctx)')
  const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  assert.equal(manifest.exports['./workflow'], './dist/workflow-host.js')
  assert.equal(manifest.private, true, 'unverified preview must not be publishable accidentally')
  assert(existsSync(join(pkgDir, 'cordis.patch.yml')))
  const patch = readFileSync(join(pkgDir, 'cordis.patch.yml'), 'utf8')
  assert(patch.includes("name: 'dsh-composer-assist/workflow'"))
  const client = readFileSync(join(pkgDir, 'dist/client.js'), 'utf8')
  assert(client.includes('fusion_create') || client.includes('fusionOpen'), 'packed Client missing Fusion view')
  console.log('Fusion preview package smoke passed: packed Cordis Host imports, Client and both bundled ZCode runtimes are present')
} finally {
  rmSync(root, { recursive: true, force: true })
}
