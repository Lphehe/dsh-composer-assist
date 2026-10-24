import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { createWorkflowManager } from './manager.js'
import { openJournal } from './journal.js'
import { InMemoryJournalStore } from '@zcode/dynamic-workflow'
import { nodeState, phaseModel } from '../client/graph.js'

const filename = fileURLToPath(import.meta.url)
const script = `interface Answer { value: number }
const worker = agent("worker");
phase("First");
const first = await worker.ask<Answer>("first");
report(first);
phase("Second");
const second = await worker.ask<Answer>("pause");
report(second);
return {first, second};`
const context = () => {
  const parent = { id: 'selfcheck-parent', session: { header: { cwd: tmpdir() } } }
  const ctx = { agents: { get: id => id === parent.id ? parent : undefined }, logger: { warn: message => console.error(message) } }
  parent.ctx = ctx
  return { parent, ctx }
}
function fakeFactory(directory, allowPause) {
  return (_parent, config) => {
    const { journal, runId, sink, emit, askQuestion } = config
    const sessions = new Map()
    const countersFile = join(directory, 'counts.json')
    return {
      journal, emit,
      async createActorSession(actor, persona, seed) {
        const id = `${runId}:${actor.siteId}:${actor.ordinal}`
        const row = journal.getActor(runId, actor.siteId, actor.ordinal)
        journal.putActor({ ...row, runId, ...actor, name: persona.name, persona, sessionId: id })
        sessions.set(id, { actor, seed })
        if (seed) writeFileSync(join(directory, 'observed-seed.json'), JSON.stringify(seed))
        return { id }
      },
      startAsk(session, instance, message) {
        const counts = (() => { try { return JSON.parse(readFileSync(countersFile, 'utf8')) } catch { return {} } })()
        counts[message.instructions] = (counts[message.instructions] ?? 0) + 1
        writeFileSync(countersFile, JSON.stringify(counts))
        if (message.instructions === 'pause' && !allowPause) return
        queueMicrotask(async () => {
          if (message.instructions === 'question') {
            const result = await askQuestion({ actor: sessions.get(session.id).actor, question: 'Choose a value' }, config.signal).catch(() => undefined)
            if (result === undefined) return
            sink.askTurnEnded(instance, result)
          } else if (message.typed) sink.askSubmitAttempted(instance, { value: message.instructions === 'first' ? 1 : 2 })
          else sink.askTurnEnded(instance, message.instructions)
          const row = journal.getNode(runId, instance.siteId, instance.ordinal)
          if (row?.status === 'completed') journal.putNode({ ...row, messageBoundary: (row.actorSeq ?? 0) + 1 })
        })
      },
      respondToSubmit() {},
      cancelAsk(instance) {
        const node = journal.getNode(runId, instance.siteId, instance.ordinal)
        const actor = node && journal.getActor(runId, node.actorSiteId, node.actorOrdinal)
        if (actor?.sessionId) {
          const checkpoint = { sessionId: actor.sessionId, messageCount: (node.actorSeq ?? 0) + 1, eventCount: ((node.actorSeq ?? 0) + 1) * 2 }
          journal.putDocument(`transcript:${actor.sessionId}:${checkpoint.messageCount}`, 'selfcheck-parent', 'transcript', checkpoint)
          journal.putDocument(`transcript-latest:${actor.sessionId}`, 'selfcheck-parent', 'transcript', checkpoint)
        }
      },
      async executeWorldRead(op, args) {
        if (op !== 'run') return ['file.ts']
        const pending = config.recordEffect(op, args)
        if (!allowPause) { config.settleEffect(pending.id, undefined, new Error('unknown process outcome')); throw new Error('unknown process outcome') }
        const result = { exitCode: 0, stdout: 'ok', stderr: '' }
        config.settleEffect(pending.id, result)
        return result
      },
      async executeArtifactPublish(request) {
        const bytes = Buffer.from(request.content)
        const record = { id: request.id, kind: request.op, version: request.version, contentType: 'text/markdown', bytes: bytes.length }
        journal.putArtifact(runId, request.id, request.version, bytes, record)
        return record
      },
      dispose() {}, async quiesce() {},
    }
  }
}
const settings = (storeDir, allowPause) => ({ storeDir, resolveRoutes: () => ({ base: { provider: 'fake', model: 'fake' }, bindings: {} }), driverFactory: fakeFactory(storeDir, allowPause) })
async function until(manager, parent, id, predicate) {
  for (let i = 0; i < 400; i++) { const run = await manager.get(parent, id); if (predicate(run)) return run; await delay(10) }
  throw new Error('selfcheck timed out')
}

if (process.argv[2] === '--stage') {
  const directory = process.argv[4]
  const { parent, ctx } = context()
  const manager = await createWorkflowManager(ctx, settings(directory, process.argv[3] === 'resume'))
  if (process.argv[3] === 'seed') {
    const draft = await manager.prepare(parent, { name: 'Persistent', script })
    assert.equal(draft.status, 'draft')
    const listed = await manager.list(parent)
    assert.equal(listed.length, 1)
    assert.deepEqual(listed, JSON.parse(JSON.stringify(listed)), 'model tool outputs must be lossless JSON')
    const run = await manager.launch(parent, draft.id)
    await until(manager, parent, run.id, value => value.nodes.some(node => node.siteId === 'ask#2' && node.status === 'running'))
    const stopped = await manager.stop(parent, run.id)
    assert.equal(stopped.status, 'stopped')
    assert.equal(stopped.reports.length, 1)
    assert.equal(stopped.nodes.find(node => node.siteId === 'ask#2').status, 'cancelled', 'stopped ask must not display as running')
    assert.equal(nodeState(stopped.siteStates, 'ask#2'), 'cancelled')
    assert.equal(phaseModel(stopped).find(phase => phase.name === 'Second').status, 'cancelled')
    const checkpoint = await openJournal(directory)
    assert.equal(checkpoint.getNode(run.id, 'ask#2', 1).status, 'running', 'display status must not change the resumable checkpoint')
    checkpoint.close()
    const page = await manager.nodes(parent, { id: run.id })
    assert.equal(page.nodes.find(node => node.siteId === 'ask#2').status, 'cancelled')
    assert.deepEqual(page, JSON.parse(JSON.stringify(page)), 'node pages with absent native links must remain lossless JSON')
    writeFileSync(join(directory, 'fixture.json'), JSON.stringify({ id: run.id }))
  } else {
    const { id } = JSON.parse(readFileSync(join(directory, 'fixture.json'), 'utf8'))
    assert.equal((await manager.get(parent, id)).status, 'stopped')
    await manager.resume(parent, id)
    const completed = await manager.wait(parent, id)
    assert.equal(completed.status, 'completed')
    assert.deepEqual(completed.result, { first: { value: 1 }, second: { value: 2 } })
    assert.equal(completed.reports.length, 2)
    const counts = JSON.parse(readFileSync(join(directory, 'counts.json'), 'utf8'))
    assert.equal(counts.first, 1, 'completed ask must not run again after process restart')
    const amended = await manager.amend(parent, { id, script: script.replace('return {first, second};', 'const third = await worker.ask<Answer>("third"); return {first, second, third};') })
    const final = await manager.wait(parent, amended.id)
    assert.equal(final.status, 'completed')
    assert.equal(final.result.third.value, 2)
    const after = JSON.parse(readFileSync(join(directory, 'counts.json'), 'utf8'))
    assert.equal(after.first, 1, 'amend must import completed named actor prefix')
    assert.equal(after.pause, 2)
    assert.equal(after.third, 1)
  }
  await manager.dispose()
  console.log(`stage ${process.argv[3]} passed`)
} else {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-workflow-host-'))
  for (const stage of ['seed', 'resume']) {
    const result = spawnSync(process.execPath, [filename, '--stage', stage, directory], { encoding: 'utf8', timeout: 30000 })
    assert.equal(result.status, 0, `${stage}: ${result.stdout}\n${result.stderr}`)
    console.log(result.stdout.trim())
  }
  const { parent, ctx } = context()
  const storeDir = join(directory, 'features')
  const manager = await createWorkflowManager(ctx, settings(storeDir, true))
  const bad = await manager.analyze('const = ???')
  assert.equal(bad.ok, false)
  assert.ok(bad.diagnostics.length)
  const typed = await manager.analyze('interface A { n: number }; return await agent("a").ask<A>("a");')
  assert.deepEqual(typed.schemas['ask#1'].required, ['n'])
  await assert.rejects(manager.create({ ...parent }, { script: 'return 1;' }), /精确/)
  const streams = await manager.create(parent, { script: 'const c = channel<number>("c"); const sender = future(async () => { c.send(1); c.send(2); c.close(); }); let total=0; for await (const n of c) total += n; await sender; return total;' })
  assert.equal((await manager.wait(parent, streams.id)).result, 3)
  const hole = await manager.create(parent, { script: 'const x = 7; const y = await hole<number>("choice", "Choose"); return x + y;' })
  const waiting = await until(manager, parent, hole.id, run => run.holes.length === 1)
  await manager.fillHole(parent, { id: hole.id, holeId: waiting.holes[0].id, body: 'return x * 2;' })
  assert.equal((await manager.wait(parent, hole.id)).result, 21)
  await manager.save(parent, { name: 'Saved', script: 'return args.value;', scope: 'project' })
  assert.equal((await manager.listSaved(parent)).length, 1)
  const saved = await manager.runSaved(parent, { name: 'Saved', args: { value: 99 } })
  assert.equal((await manager.wait(parent, saved.id)).result, 99)
  const artifacts = await manager.create(parent, { script: 'artifact.table("rows", { columns: [{field:"value",label:"Value"}] }); report({value:1}, "rows"); await artifact.markdown("notes", "# Done"); return 1;' })
  const published = await manager.wait(parent, artifacts.id)
  assert.equal(published.status, 'completed', JSON.stringify(published.error))
  assert.equal(published.artifacts.length, 2)
  assert.equal(published.artifacts.find(row => row.kind === 'markdown').content, '# Done')
  const bytes = await manager.getArtifact(parent, { id: artifacts.id, artifactId: 'notes', version: 1 })
  assert.equal(Buffer.from(bytes.bytes).toString(), '# Done')
  const question = await manager.create(parent, { script: 'return await agent("asker").ask("question");' })
  const asked = await until(manager, parent, question.id, run => run.questions.length === 1)
  await manager.answer(parent, { id: question.id, questionId: asked.questions[0].id, answer: '42' })
  assert.equal((await manager.wait(parent, question.id)).result, '42')
  const many = await manager.create(parent, { script: 'artifact.table("many", {columns:[{field:"i",label:"Index"}]}); for (let i=0;i<300;i++) report({i}, "many"); return 300;' })
  const manyRun = await manager.wait(parent, many.id)
  assert.equal(manyRun.siteStates.reduce((sum, row) => sum + row.count, 0), manyRun.counts.nodes, 'reports and artifacts must not count as execution steps')
  assert.equal(manyRun.reports.length, 256)
  assert.equal(manyRun.reportsPage.hasMore, true)
  const allReports = []
  let reportCursor = 0
  for (;;) { const page = await manager.reports(parent, { id: many.id, after: reportCursor, limit: 100, artifactId: 'many' }); allReports.push(...page.reports); reportCursor = page.nextCursor; if (!page.hasMore) break }
  assert.equal(allReports.length, 300)
  assert.equal(allReports.at(-1).item.i, 299)
  const eventPage = await manager.events(parent, { id: artifacts.id, limit: 2 })
  assert.equal(eventPage.length, 2)
  assert.ok((await manager.events(parent, { id: artifacts.id, afterSequence: eventPage.at(-1).sequence, limit: 2 }))[0].sequence > eventPage.at(-1).sequence)
  await manager.dispose()
  const unknownDirectory = join(directory, 'unknown')
  const unknownManager = await createWorkflowManager(ctx, settings(unknownDirectory, false))
  const uncertain = await unknownManager.create(parent, { script: 'return await world.run("node", ["-e", "process.exit(0)"]);' })
  const held = await unknownManager.wait(parent, uncertain.id)
  assert.equal(held.status, 'errored')
  assert.equal(held.holds.length, 1)
  await assert.rejects(unknownManager.resume(parent, held.id))
  const accepted = { exitCode: 0, stdout: 'verified externally', stderr: '' }
  await unknownManager.resolveHold(parent, { id: held.id, nodeId: held.holds[0].nodeId, resolution: 'accept', value: accepted })
  await unknownManager.resume(parent, held.id)
  assert.deepEqual((await unknownManager.wait(parent, held.id)).result, accepted, 'accepted unknown effect must replay its journal result, never dispatch again')
  const retried = await unknownManager.create(parent, { script: 'return await world.run("node", ["-e", "process.exit(1)"]);' })
  const retryHeld = await unknownManager.wait(parent, retried.id)
  await unknownManager.resolveHold(parent, { id: retryHeld.id, nodeId: retryHeld.holds[0].nodeId, resolution: 'retry' })
  await unknownManager.dispose()
  const recoveredManager = await createWorkflowManager(ctx, settings(unknownDirectory, true))
  await recoveredManager.resume(parent, retried.id)
  assert.equal((await recoveredManager.wait(parent, retried.id)).result.stdout, 'ok')
  await recoveredManager.dispose()
  const partialDirectory = join(directory, 'partial')
  const partialManager = await createWorkflowManager(ctx, settings(partialDirectory, false))
  const partial = await partialManager.create(parent, { script: 'return await agent("partial").ask("pause");' })
  await until(partialManager, parent, partial.id, run => run.nodes.some(node => node.status === 'running'))
  await partialManager.stop(parent, partial.id)
  await partialManager.dispose()
  const continuedManager = await createWorkflowManager(ctx, settings(partialDirectory, true))
  const continued = await continuedManager.amend(parent, { id: partial.id, script: 'const worker=agent("partial"); const value=await worker.ask("pause"); return value+"!";' })
  assert.equal((await continuedManager.wait(parent, continued.id)).result, 'pause!')
  assert.equal(JSON.parse(readFileSync(join(partialDirectory, 'observed-seed.json'), 'utf8')).messageCount, 1)
  await continuedManager.dispose()
  const journal = await openJournal(join(directory, 'journal'))
  const memory = new InMemoryJournalStore()
  const runRecord = { runId: 'contract', parentSessionId: parent.id, status: 'pending', caps: { maxConcurrency: 2 }, spentTokens: 0 }
  for (const store of [journal, memory]) {
    store.createRun(runRecord)
    store.updateRunStatus('contract', 'stopped', { stopReason: 'user', failure: { code: 'Interrupted', message: 'x' } })
    store.updateRunStatus('contract', 'running')
    store.putNode({ runId: 'contract', siteId: 'report#1', ordinal: 1, kind: 'report', status: 'completed', inputHash: 'a', result: '中' })
    store.appendEvent('contract', { type: 'report', instance: { siteId: 'report#1', ordinal: 1 }, item: '中' })
  }
  assert.deepEqual(journal.getRun('contract'), memory.getRun('contract'))
  assert.equal(journal.sumResultBytes('contract', 'report'), memory.sumResultBytes('contract', 'report'))
  assert.deepEqual(journal.listNodes('contract', { kinds: 'all', withResult: false }), memory.listNodes('contract', { kinds: 'all', withResult: false }))
  assert.deepEqual(journal.listEvents('contract', { types: 'all', reportItems: { limit: 0 } }).map(row => row.event), memory.listEvents('contract', { types: 'all', reportItems: { limit: 0 } }).map(row => row.event))
  const pendingAsk = { runId: 'contract', siteId: 'ask#1', ordinal: 1, kind: 'ask', status: 'running', inputHash: 'a' }
  journal.putNode(pendingAsk)
  journal.putNode({ ...pendingAsk, ordinal: 2 })
  const cancelledAsk = { type: 'node-settled', instance: { siteId: 'ask#1', ordinal: 1 }, outcome: 'cancelled' }
  journal.appendEvent('contract', cancelledAsk)
  for (let i = 0; i < 1001; i++) journal.appendEvent('contract', { type: 'log', message: 'later' })
  assert.deepEqual(journal.pageNodes('contract').nodes.map(node => node.status), ['cancelled', 'running'], 'cancellation is instance-specific and not limited to the latest event page')
  assert.equal(journal.siteStates('contract').find(row => row.status === 'cancelled').count, 1)
  assert.deepEqual(journal.getNode('contract', 'ask#1', 1), pendingAsk, 'display reads must not mutate recovery data')
  assert.equal(journal.pageNodes('contract', { kinds: ['report'] }).nodes[0].result, '中')
  journal.updateRunStatus('contract', 'stopped', { stopReason: 'superseded', supersededBy: 'next' })
  assert.deepEqual(journal.pageNodes('contract').nodes.map(node => node.status), ['cancelled', 'stopped'], 'a stopped run cannot display an active ask even without a cancellation event')
  assert.equal(nodeState(journal.siteStates('contract'), 'ask#1'), 'cancelled')
  assert.equal(journal.getNode('contract', 'ask#1', 2).status, 'running')
  journal.updateRunStatus('contract', 'running')
  for (const type of ['node-queued', 'node-dispatched']) {
    journal.appendEvent('contract', { type, instance: cancelledAsk.instance, kind: 'ask' })
    assert.equal(journal.pageNodes('contract').nodes[0].status, 'running', 'resuming clears stale cancellation display')
    assert.deepEqual(journal.siteStates('contract').map(row => [row.status, row.count]), [['running', 2]])
    journal.appendEvent('contract', cancelledAsk)
  }
  journal.putNode({ ...pendingAsk, status: 'completed', result: 'done' })
  assert.equal(journal.pageNodes('contract').nodes[0].status, 'completed', 'a completed checkpoint takes precedence over old cancellation')
  journal.close()
  console.log(`host selfcheck passed; evidence: ${directory}`)
}
