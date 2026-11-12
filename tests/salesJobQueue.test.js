'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSalesJobQueue } = require('../salesJobQueue');

test('queued job searches, deduplicates and produces drafts without sending', async () => {
  let calls = 0;
  const q = createSalesJobQueue({ searchPublicLeads: async ({ companyId }) => {
    calls++;
    return [
      { companyId, name: 'Firma A', website: 'https://a.example', category: 'instalacje' },
      { companyId, name: 'Firma A2', website: 'https://www.a.example', category: 'HVAC' }
    ];
  } });
  const id = q.enqueue({ companyId: 'kaldeva', actorId: 'owner', query: 'instalatorzy' });
  assert.equal(q.get(id, { companyId: 'kaldeva', actorId: 'owner' }).status, 'queued');
  const done = await q.runNext();
  assert.equal(done.status, 'completed');
  assert.equal(done.report.accepted.length, 1);
  assert.equal(done.report.rejected.length, 1);
  assert.equal(done.report.requiresApprovalBeforeSending, true);
  assert.equal(calls, 1);
});
test('company and actor isolation', () => {
  const q = createSalesJobQueue({ searchPublicLeads: async () => [] });
  const id = q.enqueue({ companyId: 'kaldeva', actorId: 'owner', query: 'x' });
  assert.equal(q.get(id, { companyId: 'dekonica', actorId: 'owner' }), null);
  assert.equal(q.get(id, { companyId: 'kaldeva', actorId: 'other' }), null);
  assert.throws(() => q.enqueue({ companyId: '', actorId: 'owner', query: 'x' }));
});
test('failed search is reported, not silently completed', async () => {
  const q = createSalesJobQueue({ searchPublicLeads: async () => { throw new Error('source_unavailable'); } });
  q.enqueue({ companyId: 'kaldeva', actorId: 'owner', query: 'x' });
  assert.equal((await q.runNext()).status, 'failed');
  assert.equal(await q.runNext(), null);
});
test('rejects oversized and invalid search responses', async () => {
  const q = createSalesJobQueue({ searchPublicLeads: async () => [{}, {}], maxLeads: 1 });
  q.enqueue({ companyId: 'kaldeva', actorId: 'owner', query: 'x' });
  assert.equal((await q.runNext()).status, 'failed');
  assert.throws(() => q.enqueue({ companyId: 'kaldeva', actorId: 'owner', query: ' ' }));
});
