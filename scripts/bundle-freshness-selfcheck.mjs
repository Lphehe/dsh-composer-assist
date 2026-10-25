// Verify the bundles produced for this development preview are reproducible.
// Run 'pnpm run build' first; a second build must leave every generated file
// unchanged. Release packaging must build before packing, not trust old dist/.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// The composer Client, separate workflow Host and worker must all be present.
const tracked = ['dist/client.js', 'dist/workflow-host.js', 'dist/compiler-worker.js'];
const before = new Map(tracked.map(file => [file, readFileSync(join(root, file))]));

// Preserve the committed bundle before rebuilding so this check can restore it
// even when a stale bundle is detected or the build fails.
const staging = mkdtempSync(join(tmpdir(), 'bundle-freshness-'));
try {
  for (const file of tracked) copyFileSync(join(root, file), join(staging, file.replaceAll('/', '_')));
  execFileSync(process.execPath, [join(root, 'scripts/build-client.mjs')], { cwd: root, stdio: 'ignore' });
  for (const file of tracked) {
    const after = readFileSync(join(root, file));
    assert.ok(before.get(file).equals(after), file + ' is stale: rebuild and commit it (node scripts/build-client.mjs)');
  }
  console.log('preview bundle reproducibility selfcheck passed: generated bundles match a fresh build');
} finally {
  // Restore the committed bytes regardless of outcome.
  for (const file of tracked) copyFileSync(join(staging, file.replaceAll('/', '_')), join(root, file));
  rmSync(staging, { recursive: true, force: true });
}
