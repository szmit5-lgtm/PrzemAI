'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createKaldevSalesWorkflow } = require('./kaldevSalesWorkflow');

test('queued public search yields a deduplicated scoped report and drafts', async () => {
  let calls = 0;
  const workflow = createKaldevSalesWorkflow({
    search: async (query, options) => {
      calls++;
      assert.equal(query, 'instalatorzy pomp ciepła');
      assert.equal(options.limit, 20);
      return [
        { title: 'Instalacje ABC', url: 'https://abc.example/oferta', snippet: 'instalacje i pompy ciepła' },
        { title: 'ABC duplicate', url: 'https://www.abc.example/kontakt', snippet: 'ogrzewanie' },
        { title: 'Private', url: 'http://127.0.0.1/admin', snippet: 'internal' },
        { title: 'OZE XYZ', url: 'https://xyz.example', snippet: 'oze' }
      ];
    }
  });
  const scope = { companyId: 'kaldeva', actorId: 'owner' };
  const id = workflow.enqueue({ ...scope, query: 'instalatorzy pomp ciepła' });
  assert.equal(workflow.get(id, scope).status, 'queued');
  assert.equal(workflow.get(id, { ...scope, actorId: 'other' }), null);
  const result = await workflow.runNext();
  assert.equal(result.status, 'completed');
  assert.equal(result.report.scanned, 2);
  assert.equal(result.report.accepted.length, 2);
  assert.equal(result.report.requiresApprovalBeforeSending, true);
  assert.match(result.report.accepted[0].draft, /Dzień dobry/);
  assert.equal(calls, 1);
});

test('failed search remains failed without inventing leads', async () => {
  const workflow = createKaldevSalesWorkflow({ search: async () => { throw new Error('search_offline'); } });
  const scope = { companyId: 'kaldeva', actorId: 'owner' };
  workflow.enqueue({ ...scope, query: 'pompy ciepła' });
  const result = await workflow.runNext();
  assert.equal(result.status, 'failed');
  assert.equal(result.error, 'search_offline');
  assert.equal(result.report, null);
});

test('rejects missing adapter and too-long search query', () => {
  assert.throws(() => createKaldevSalesWorkflow(), /search_adapter_required/);
  const workflow = createKaldevSalesWorkflow({ search: async () => [] });
  assert.throws(() => workflow.enqueue({ companyId: 'kaldeva', actorId: 'owner', query: 'x'.repeat(201) }), /invalid_query/);
});
