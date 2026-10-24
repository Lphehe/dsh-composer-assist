import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
await build({
  stdin: { contents: 'export * from "./apply.ts"; export * from "./spec.ts";', resolveDir: directory, sourcefile: 'index.ts', loader: 'ts' },
  outfile: fileURLToPath(new URL('./index.js', import.meta.url)),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  banner: { js: '// Generated from vendored ZCode sources; run node vendor/zcode/ui-presets/build.mjs.' },
})
