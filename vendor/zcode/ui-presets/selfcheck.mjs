import assert from 'node:assert/strict'
import { applyArtifactItems, parseArtifactPresetSpec, readArtifactField } from './index.js'

const entries = items => items.map((item, index) => ({ sequence: index, siteId: 'report#1', ordinal: index + 1, item }))
const table = applyArtifactItems('table', { key: 'id', columns: [{ field: 'value' }] }, entries([{ id: 'a', value: 1 }, { id: 'b', value: 2 }, { id: 'a', value: 3 }]))
assert.deepEqual(table.rows.map(row => [row.id, row.cells]), [['a', ['3']], ['b', ['2']]])
const metrics = applyArtifactItems('metrics', { metrics: [{ field: 'latency' }, { field: 'stage' }] }, entries([{ latency: 12 }, { stage: 'done' }, { latency: null }]))
assert.deepEqual(metrics.metrics.map(tile => tile.raw), [12, 'done'])
const board = applyArtifactItems('board', { key: 'id', status: 'state', columns: ['todo', 'done'] }, entries([{ id: 'a', state: 'todo' }, { id: 'a', state: 'done' }]))
assert.equal(board.cardCount, 1)
assert.deepEqual(board.columns.map(column => column.cards.length), [0, 1])
const chart = applyArtifactItems('chart', { x: { field: 'x' }, y: { field: 'y' }, scale: 'log', baseline: { field: 'baseline' } }, entries([{ x: 2, y: -1, baseline: 10 }, { x: 1, y: 3 }]))
assert.deepEqual(chart.points.map(point => [point.x, point.y0]), [[1, 3], [2, null]])
assert.equal(chart.baseline.value, 10)
assert.equal(readArtifactField({ rounds: [{ ms: 7 }] }, 'rounds.0.ms'), 7)
assert.equal(parseArtifactPresetSpec('table', {}), undefined)
console.log('Upstream preset reducer smoke passed: table upsert, per-field metrics, board moves, log chart/baseline, nested fields')
