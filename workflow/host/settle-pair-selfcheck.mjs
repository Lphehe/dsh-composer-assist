// Regression: a completed node and its node-settled event are one settlement.
// A crash between the two writes must not leave a node that claims completed
// while the event that proves its replay order is missing.
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createWorkflowManager} from './manager.js';
import {openJournal} from './journal.js';

const filename = fileURLToPath(import.meta.url);

function context() {
  const parent = { id: 'settle-pair-parent', session: { header: { cwd: tmpdir() } } };
  const ctx = { agents: { get: id => (id === parent.id ? parent : undefined) }, logger: { warn: () => {} } };
  parent.ctx = ctx;
  return { parent, ctx };
}

const script = `
const worker = agent('worker');
const a = await worker.ask('first');
const b = await worker.ask('second');
report(a + ':' + b);
`;

function settings(root, killAt) {
  return {
    storeDir: root,
    resolveRoutes: () => ({ base: { provider: 'fake', model: 'fake' }, bindings: {} }),
    driverFactory: (_parent, config) => {
      const journal = config.journal;
      const originalAppend = journal.appendEvent.bind(journal);
      journal.appendEvent = (runId, event) => {
        if (process.env.SETTLE_TRACE) console.error('EVENT', event.type, killAt ?? 'none');
        if (killAt === 'before-settle-event' && event.type === 'node-settled') process.kill(process.pid, 'SIGKILL');
        return originalAppend(runId, event);
      };
      return {
        journal, emit: config.emit,
        async createActorSession(actor, persona) {
          const row = journal.getActor(config.runId, actor.siteId, actor.ordinal);
          journal.putActor({ ...row, runId: config.runId, ...actor, name: persona.name, persona, sessionId: `${config.runId}:${actor.siteId}` });
          return { id: `${config.runId}:${actor.siteId}` };
        },
        startAsk(session, instance, message) {
          queueMicrotask(() => {
            config.sink.askTurnEnded(instance, `done:${message.instructions}`);
          });
        },
        respondToSubmit() {},
        cancelAsk() {},
        async executeWorldRead() { throw new Error('not used'); },
        dispose() {}, async quiesce() {},
      };
    },
  };
}

if (process.argv[2] === '--seed') {
  const root = process.argv[3];
  const { parent, ctx } = context();
  const manager = await createWorkflowManager(ctx, settings(root, 'before-settle-event'));
  const draft = await manager.prepare(parent, { name: 'settle pair', script });
  fs.writeFileSync(join(root, 'run-id'), draft.id);
  await manager.launch(parent, draft.id);
  await manager.wait(parent, draft.id);
  throw new Error('kill point not reached');
}

const root = fs.mkdtempSync(join(tmpdir(), 'workflow-settle-pair-'));
const killed = spawnSync(process.execPath, [filename, '--seed', root], { encoding: 'utf8', timeout: 30000 });
assert.equal(killed.signal, 'SIGKILL', (killed.stdout ?? '') + (killed.stderr ?? ''));
const id = fs.readFileSync(join(root, 'run-id'), 'utf8');
const journal = await openJournal(root);
const nodes = journal.listNodes(id, { kinds: 'all', withResult: true });
const events = journal.listEvents(id, { types: ['node-settled'], limit: -1, reportItems: { limit: 0 } });
jjournalNoop: {
  // Every node the journal calls completed must already carry its settle event.
  const settledSites = new Set(events.map(row => `${row.event.instance.siteId}@${row.event.instance.ordinal}`));
  const completed = nodes.filter(node => node.status === 'completed');
  const orphan = completed.filter(node => !settledSites.has(`${node.siteId}@${node.ordinal}`));
  assert.deepEqual(orphan.map(node => node.siteId), [], 'completed node must not exist without its node-settled event');
}
journal.close();
const { parent, ctx } = context();
const manager = await createWorkflowManager(ctx, settings(root, undefined));
const resumed = await manager.resume(parent, id);
const final = await manager.wait(parent, id);
assert.ok(['completed', 'stopped', 'errored'].includes(final.status), final.status);
await manager.dispose();
console.log(JSON.stringify({ completedNodes: nodes.filter(n => n.status === 'completed').length, settleEvents: events.length, resumed: resumed.status, final: final.status }, null, 2));
