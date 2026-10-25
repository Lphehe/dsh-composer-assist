import assert from 'node:assert/strict'
import { fusionTerminalSnapshot, createFusionTerminalView } from './fusion-terminal.js'

const blank = fusionTerminalSnapshot({ args: { preset: 'fusion.v1', maxRounds: 3 }, status: 'draft' })
assert.equal(blank.tokens, null, 'no invented token count')
assert.equal(blank.rounds, null, 'no invented attempt count')
assert.equal(blank.logs.length, 0)
assert.equal(blank.tests, 'pending')
assert.equal(blank.models.lead, null)
const run = {
  id: 'run123',
  status: 'running',
  spentTokens: 248,
  args: { preset: 'fusion.v1', maxRounds: 3, testScript: 'selfcheck', models: { lead: 'p/high', sidekick: 'p/fast', reviewer: 'p/audit' } },
  actors: [
    { name: 'Fusion Lead', siteId: 'actor#1' }, { name: 'Fusion Sidekick', siteId: 'actor#2' }, { name: 'Fusion Reviewer', siteId: 'actor#3' },
  ],
  nodes: [
    { kind: 'ask', actorSiteId: 'actor#1', status: 'completed' },
    { kind: 'ask', actorSiteId: 'actor#2', status: 'running' },
    { kind: 'ask', actorSiteId: 'actor#3', status: 'completed' },
  ],
  reports: [
    { item: { preset: 'fusion.v1', rounds: 1, test: { exitCode: 1 } } },
    { item: { preset: 'fusion.v1', rounds: 1, test: { exitCode: 1 }, review: { approved: false, blockingIssues: ['Must cover negative numbers'] } } },
  ],
  events: [ { sequence: 7, event: { type: 'node-settled', message: 'Checked test outputs' } } ],
}
const evidence = fusionTerminalSnapshot(run)
assert.equal(evidence.tests, 'failed')
assert.equal(evidence.testExit, 1)
assert.equal(evidence.review, 'failed')
assert.equal(evidence.rounds, 1)
assert.equal(evidence.models.sidekick, 'p/fast')
assert.equal(evidence.actors.sidekick, 'running')
assert.equal(evidence.logs[0].seq, 7)
assert.equal(evidence.blockers[0], 'Must cover negative numbers')
assert.equal(evidence.signoff, 'pending')
const contradictory = fusionTerminalSnapshot({ ...run, reports: [{ item: { preset: 'fusion.v1', rounds: 2, test: { exitCode: 0 }, review: { approved: true, blockingIssues: ['Still blocked'] } } }] })
assert.equal(contradictory.review, 'failed', 'open blocking issues override approval')
const done = fusionTerminalSnapshot({ ...run, status: 'completed', result: { rounds: 2, success: true, test: { exitCode: 0 }, review: { approved: true, blockingIssues: [] } } })
assert.equal(done.tests, 'completed')
assert.equal(done.review, 'completed')
assert.equal(done.signoff, 'completed')
assert.equal(done.rounds, 2)

const React={createElement:(type,props,...children)=>({type,props:props??{},children})}
const t=key=>key
const button=(label,onClick,disabled,primary,extra)=>React.createElement('button',{onClick,disabled,...extra},label)
const { FusionTerminal }=createFusionTerminalView(React,{t,button})
const flatten=node=>Array.isArray(node)?node.flatMap(flatten):!node||typeof node!=='object'?[]:[node,...(node.children??[]).flatMap(flatten)]
assert.equal(FusionTerminal({run:{args:{}}}),null)
const screen=flatten(FusionTerminal({run,onLogs:()=>{}}))
assert(screen.some(el=>el.props['data-fusion-terminal']===''))
assert(screen.some(el=>el.props['data-status']==='running'))
assert(screen.some(el=>el.type==='code'&&el.children.includes('node-settled')))
assert(screen.some(el=>el.type==='span'&&el.children.includes('#7')))
assert(screen.some(el=>el.type==='div'&&el.props.className==='tty-alert'))
assert(screen.some(el=>el.type==='span'&&el.children.includes('tokens: 248')))
const stopped=flatten(FusionTerminal({run:{...run,status:'stopped'},onLogs:()=>{}}))
assert(stopped.some(el=>el.props['data-fusion-terminal']===''&&el.props['data-status']==='stopped'))
console.log('Fusion live terminal topology snapshot/UI selfcheck passed')
