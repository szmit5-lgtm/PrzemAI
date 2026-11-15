'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAllegroOrder, fetchAllegroOrdersPage, BASE_API_URL } = require('../connectors/allegro/baseOrdersAdapter');

const sample = {
  order_id: 1234, order_source: 'allegro', order_source_id: 50, order_status_id: 7,
  confirmed: true, date_confirmed: 1763200000, currency: 'PLN',
  delivery_price: 11.25, products: [{ price_brutto: 9.99, quantity: 2 }],
  commissions: [{ cost_brutto: 1.5, cost_currency: 'PLN' }],
  email: 'private@example.invalid', phone: '123456789', delivery_address: 'PRIVATE'
};

test('normalizes only confirmed Allegro orders, excludes PII and unverified profit', () => {
  const order = normalizeAllegroOrder('dekonica-synthetic', sample);
  assert.equal(order.itemsGross, 19.98);
  assert.equal(order.deliveryGross, 11.25);
  assert.equal(order.commissionGross, 1.5);
  assert.equal(order.profit, null);
  assert.equal(order.profitVerified, false);
  assert.equal(order.organizationId, 'dekonica-synthetic');
  assert.equal('email' in order, false);
  assert.equal('phone' in order, false);
  assert.equal('delivery_address' in order, false);
  assert.equal(normalizeAllegroOrder('test', { ...sample, order_source: 'ebay' }), null);
  assert.equal(normalizeAllegroOrder('test', { ...sample, confirmed: false }), null);
});

test('uses documented read-only API, token header, tenant scope and confirmed-only query', async () => {
  let calls = 0;
  const result = await fetchAllegroOrdersPage({
    organizationId: 'company-1', token: 'SYNTHETIC_TEST_TOKEN', sinceUnix: 1700000000,
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(url, BASE_API_URL);
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['X-BLToken'], 'SYNTHETIC_TEST_TOKEN');
      const form = new URLSearchParams(options.body);
      assert.equal(form.get('method'), 'getOrders');
      assert.deepEqual(JSON.parse(form.get('parameters')), { date_confirmed_from: 1700000000, get_unconfirmed_orders: false });
      assert.ok(!options.body.includes('SYNTHETIC_TEST_TOKEN'));
      return { ok: true, json: async () => ({ status: 'SUCCESS', orders: [sample, { ...sample, order_source: 'ebay' }] }) };
    }
  });
  assert.equal(calls, 1);
  assert.equal(result.orders.length, 1);
  assert.equal(result.complete, true);
  assert.equal(result.morePagesPossible, false);
  assert.ok(!JSON.stringify(result).includes('private@example.invalid'));
});

test('fails closed for missing credentials, invalid values and provider errors', async () => {
  await assert.rejects(fetchAllegroOrdersPage({ organizationId: 'test', sinceUnix: 1 }), /base_token_required/);
  await assert.rejects(fetchAllegroOrdersPage({ token: 'x', sinceUnix: 1 }), /company_scope_required/);
  await assert.rejects(fetchAllegroOrdersPage({ organizationId: 'test', token: 'x', sinceUnix: -1 }), /base_invalid_cursor/);
  await assert.rejects(fetchAllegroOrdersPage({ organizationId: 'test', token: 'x', sinceUnix: 1, fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'ERROR', error_message: 'secret response' }) }) }), /base_invalid_response/);
  assert.throws(() => normalizeAllegroOrder('test', { ...sample, products: [{ price_brutto: -5, quantity: 1 }] }), /base_invalid_line_amount/);
});

test('reports possible truncation on exactly 100 orders rather than silently claiming full sync', async () => {
  const orders = Array.from({ length: 100 }, (_, index) => ({ ...sample, order_id: index + 1 }));
  const result = await fetchAllegroOrdersPage({
    organizationId: 'company-1', token: 'SYNTHETIC_TEST_TOKEN', sinceUnix: 1,
    fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'SUCCESS', orders }) })
  });
  assert.equal(result.orders.length, 100);
  assert.equal(result.complete, false);
  assert.equal(result.morePagesPossible, true);
});
