'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchCompleteAllegroOrders } = require('../connectors/allegro/baseOrdersAdapter');

const order = {
  order_id: 42, order_source: 'allegro', order_source_id: 2,
  order_status_id: 3, confirmed: true, date_confirmed: 1763200000,
  currency: 'PLN', delivery_price: 0,
  products: [{ price_brutto: 12.34, quantity: 1 }],
  commissions: []
};
const run = orders => fetchCompleteAllegroOrders({
  organizationId: 'synthetic-company', token: 'FAKE', sinceUnix: 1,
  fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'SUCCESS', orders }) })
});

test('rejects provider page exceeding documented 100 order limit', async () => {
  await assert.rejects(run(Array.from({ length: 101 }, (_, i) => ({ ...order, order_id: i + 1 }))), /base_page_limit_exceeded/);
});

test('rejects entire provider page when later Allegro record is malformed', async () => {
  await assert.rejects(run([order, { ...order, order_id: 43, currency: 'INVALID' }]), /base_invalid_currency/);
});

test('does not disclose buyer PII in normalized order summaries', async () => {
  const result = await run([{ ...order, email: 'buyer@example.invalid', phone: '000000000', delivery_address: 'SECRET' }]);
  assert.equal(result.orders.length, 1);
  assert.equal(result.orders[0].organizationId, 'synthetic-company');
  assert.ok(!JSON.stringify(result).includes('buyer@example.invalid'));
  assert.ok(!JSON.stringify(result).includes('SECRET'));
});
