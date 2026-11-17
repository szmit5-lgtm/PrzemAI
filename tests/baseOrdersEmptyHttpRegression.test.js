'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchAllegroOrdersPage, fetchCompleteAllegroOrders } = require('../connectors/allegro/baseOrdersAdapter');

const params = { organizationId: 'synthetic-tenant', token: 'SYNTHETIC_ONLY', sinceUnix: 1 };

test('empty successful provider page is complete and contains no orders', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ status: 'SUCCESS', orders: [] }) });
  const page = await fetchAllegroOrdersPage({ ...params, fetchImpl });
  assert.deepEqual(page.orders, []);
  assert.equal(page.complete, true);
  assert.equal(page.morePagesPossible, false);
  const complete = await fetchCompleteAllegroOrders({ ...params, fetchImpl });
  assert.deepEqual(complete.orders, []);
  assert.equal(complete.complete, true);
});

test('HTTP transport failure never produces a successful empty report', async () => {
  await assert.rejects(
    fetchCompleteAllegroOrders({
      ...params,
      fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ status: 'SUCCESS', orders: [] }) })
    })
  );
});
