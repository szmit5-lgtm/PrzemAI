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

test('queue limit prevents unbounded in-memory growth', () => {
  const q = createSalesJobQueue({ searchPublicLeads: async () => [], maxJobs: 1 });
  q.enqueue({ companyId: 'kaldeva', actorId: 'owner', query: 'a' });
  assert.throws(() => q.enqueue({ companyId: 'kaldeva', actorId: 'owner', query: 'b' }), /sales_queue_full/);
  assert.throws(() => createSalesJobQueue({ searchPublicLeads: async () => [], maxJobs: 0 }), /invalid_job_limit/);
});
test('only the owner can cancel a queued job and cancelled jobs do not run', async () => {
  let calls = 0;
  const q = createSalesJobQueue({ searchPublicLeads: async () => { calls++; return []; } });
  const id = q.enqueue({ companyId: 'kaldeva', actorId: 'owner', query: 'a' });
  assert.equal(q.cancel(id, { companyId: 'kaldeva', actorId: 'other' }), false);
  assert.equal(q.cancel(id, { companyId: 'dekonica', actorId: 'owner' }), false);
  assert.equal(q.cancel(id, { companyId: 'kaldeva', actorId: 'owner' }), true);
  assert.equal(q.cancel(id, { companyId: 'kaldeva', actorId: 'owner' }), false);
  assert.equal(q.get(id, { companyId: 'kaldeva', actorId: 'owner' }).status, 'cancelled');
  assert.equal(await q.runNext(), null);
  assert.equal(calls, 0);
});
