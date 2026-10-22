import assert from 'node:assert/strict'
import { __test as check } from './index.js'

assert.deepEqual(check.parseCandidates('1. first\n2. second\nCONFIDENCE: 0.6'), {
  candidates: ['first', 'second'], confidence: 0.6,
})
assert.deepEqual(check.parseCandidates('plain\nCONFIDENCE: 0.5'), {
  candidates: ['plain'], confidence: 0.5,
})
assert.deepEqual(check.parseCandidates('CONFIDENCE: 0.9').candidates, [])
for (const value of ['-1', '1.9', '85', 'NaN']) {
  assert.equal(check.parseCandidates(`1. first\nCONFIDENCE: ${value}`).confidence, null)
}
assert.deepEqual(check.statsOf({ accepted: Infinity, dismissed: -1 }), {
  accepted: 0, dismissed: 0, acceptedChars: 0, dismissedChars: 0,
})
assert.equal(check.learnHint({ accepted: 1, dismissed: 1, acceptedChars: 2, dismissedChars: 200 }), '')
assert.match(check.learnHint({ accepted: 5, dismissed: 5, acceptedChars: 20, dismissedChars: 200 }), /shorter/)
let reads = 0
assert.equal(await check.workspaceContext({ fs: {
  async resolve() { reads++; throw new Error('denied') },
}}, '/unavailable'), '')
assert.equal(reads, 1)
assert.equal(await check.workspaceContext({}, '/unavailable'), '')
console.log('Composer parser, learning and context fallback checks passed')
