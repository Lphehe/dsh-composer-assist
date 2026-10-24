// Committed bundles must match a fresh build: a source edit without a rebuild
// ships stale code to every install while selfcheck still passes on the source.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const tracked = ['dist/client.js', 'dist/workflow-host.js', 'dist/compiler-worker.js'];
const before = new Map(tracked.map(file => [file, readFileSync(join(root, file))]));

// Build into a copy so a mismatch cannot overwrite the committed artifact here.
const staging = mkdtempSync(join(tmpdir(), 'bundle-freshness-'));
try {
  for (const file of tracked) copyFileSync(join(root, file), join(staging, file.replaceAll('/', '_')));
  execFileSync(process.execPath, [join(root, 'scripts/build-client.mjs')], { cwd: root, stdio: 'ignore' });
  for (const file of tracked) {
    const after = readFileSync(join(root, file));
    assert.ok(before.get(file).equals(after), file + ' is stale: rebuild and commit it (node scripts/build-client.mjs)');
  }
  console.log('bundle freshness selfcheck passed: committed bundles match a fresh build');
} finally {
  // Restore the committed bytes regardless of outcome.
  for (const file of tracked) copyFileSync(join(staging, file.replaceAll('/', '_')), join(root, file));
  rmSync(staging, { recursive: true, force: true });
}
