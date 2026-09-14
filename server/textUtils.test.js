const test = require('node:test');
const assert = require('node:assert/strict');
const { splitPdfTextIntoChunks } = require('./textUtils');

test('splitPdfTextIntoChunks keeps the chunk count bounded while preserving content coverage', () => {
  const text = Array.from({ length: 40 }, (_, i) => `Paragraph ${i + 1}: ${'word '.repeat(200)}`).join('\n\n');

  const chunks = splitPdfTextIntoChunks(text, 1200, 8);

  assert.ok(chunks.length <= 8, `Expected at most 8 chunks, got ${chunks.length}`);
  assert.ok(chunks.length > 0, 'Expected at least one chunk');
  assert.ok(chunks.every(chunk => chunk.length > 0), 'Each chunk should contain content');
  assert.ok(chunks.join(' ').includes('Paragraph 1'));
  assert.ok(chunks.join(' ').includes('Paragraph 40'));
});
