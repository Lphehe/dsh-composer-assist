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
    contents: `${source}`,
    resolveDir: root, sourcefile: 'composer-assist-client.js', loader: 'js',
  },
  bundle: true, format: 'iife', platform: 'browser', target: 'es2022',
  outfile: resolve(root, 'dist/client.js'), legalComments: 'eof',
})
// The ZCode workflow host is kept in the tree but no longer built or shipped:
// see workflow/README-ISOLATED.md. Building it here would put an unused bundle
// back into dist and re-couple the prediction package to the workflow deps.
console.log('Built composer prediction Client.')
