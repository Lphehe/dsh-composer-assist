import { readFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const source = (await readFile(resolve(root, 'client.js'), 'utf8')).replace("id: '@local/composer-assist'", `id: '${manifest.name}'`)
const marker = '      apply(ctx) {'
if (source.split(marker).length !== 2) throw new Error('Composer Client activation marker changed; update the build integration.')
await mkdir(resolve(root, 'dist'), { recursive: true })
await build({
  stdin: {
    contents: `import { installWorkflowUI } from './workflow/client/ui.js';\n${source.replace(marker, `${marker}\n        installWorkflowUI(ctx, React)`)}`,
    resolveDir: root, sourcefile: 'composer-assist-client.js', loader: 'js',
  },
  bundle: true, format: 'iife', platform: 'browser', target: 'es2022',
  outfile: resolve(root, 'dist/client.js'), legalComments: 'eof',
})
await build({
  entryPoints: [resolve(root, 'workflow/plugin.js')], bundle: true, format: 'esm', platform: 'node', target: 'node22',
  external: ['@zcode/dynamic-workflow', '@zcode/dynamic-workflow-runtime'],
  outfile: resolve(root, manifest.exports['./workflow']), legalComments: 'eof',
})
await build({
  entryPoints: [resolve(root, 'workflow/host/compiler-worker.js')], bundle: true, format: 'esm', platform: 'node', target: 'node22',
  external: ['@zcode/dynamic-workflow'], outfile: resolve(root, 'dist/compiler-worker.js'), legalComments: 'eof',
})
console.log('Built composer prediction and opt-in Fusion workflow Client, Host and compiler worker.')
