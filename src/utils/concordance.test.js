// src/utils/concordance.test.js
// Run with: node src/utils/concordance.test.js
const assert = require('assert');
const {findMatchingBlockIndices} = require('./concordance');

// Finds other blocks containing the text, excludes the originating block
assert.deepStrictEqual(
  findMatchingBlockIndices('cache', ['The cache layer is fast.', 'No mention here.', 'A cache miss is slow.'], 0),
  [2],
);

// Case-insensitive
assert.deepStrictEqual(
  findMatchingBlockIndices('Cache', ['lowercase cache here'], -1),
  [0],
);

// No matches other than itself -> empty array
assert.deepStrictEqual(
  findMatchingBlockIndices('unique', ['unique term appears once'], 0),
  [],
);

// Selection shorter than 3 characters -> no-op, empty array, regardless of content
assert.deepStrictEqual(
  findMatchingBlockIndices('ab', ['ab appears here', 'and ab here too'], -1),
  [],
);

// Selection longer than 200 characters -> no-op, empty array
assert.deepStrictEqual(
  findMatchingBlockIndices('x'.repeat(201), ['x'.repeat(201) + ' appears here'], -1),
  [],
);

// Selection spanning what would have been multiple blocks is just a string -> matches normally
assert.deepStrictEqual(
  findMatchingBlockIndices('fast reliable', ['fast reliable systems win', 'slow systems lose'], -1),
  [0],
);

console.log('All concordance tests passed.');
