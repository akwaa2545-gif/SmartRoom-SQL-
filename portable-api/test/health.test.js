const assert = require('node:assert/strict');
const test = require('node:test');

const { createHealthResponse } = require('../src/health');

test('reports the deployment revision in the health response', () => {
  assert.deepEqual(createHealthResponse('abc123'), {
    success: true,
    data: { status: 'ok', revision: 'abc123' },
  });
});

test('uses unknown for a manually started API', () => {
  assert.equal(createHealthResponse().data.revision, 'unknown');
});
