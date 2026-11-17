'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchCompleteAllegroOrders, fetchAllegroOrdersPage } = require('../connectors/allegro/baseOrdersAdapter');

const order = (id, source) => ({
  order_id: id, order_source: source, order_source_id: 1,
  order_status_id: 1, confirmed: true, date_confirmed: 1763200000,
  currency: 'PLN', delivery_price: 0, products: [{ price_brutto: 10, quantity: 1 }]
});

test('mixed marketplace capped page never reports complete Allegro sales', async () => {
  const raw = Array.from({ length: 100 }, (_, i) => order(i + 1, i === 0 ? 'allegro' : 'ebay'));
  let calls = 0;
  const options = {
    organizationId: 'synthetic-tenant', token: 'FAKE', sinceUnix: 1,
    fetchImpl: async () => {
      calls++;
      return { ok: true, json: async () => ({ status: 'SUCCESS', orders: raw }) };
    }
  };
  const page = await fetchAllegroOrdersPage(options);
  assert.equal(page.orders.length, 1);
  assert.equal(page.pageSize, 100);
  assert.equal(page.complete, false);
  assert.equal(page.morePagesPossible, true);
  await assert.rejects(fetchCompleteAllegroOrders(options), /base_incomplete_page_requires_safe_pagination/);
  assert.equal(calls, 2);
});

test('provider returning more than documented cap fails closed', async () => {
  const raw = Array.from({ length: 101 }, (_, i) => order(i + 1, 'allegro'));
  await assert.rejects(fetchCompleteAllegroOrders({
    organizationId: 'synthetic-tenant', token: 'FAKE', sinceUnix: 1,
    fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'SUCCESS', orders: raw }) })
  }), /base_page_limit_exceeded/);
});
