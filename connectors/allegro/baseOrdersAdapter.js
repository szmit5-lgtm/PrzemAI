'use strict';

// PrzemAI Allegro via the official Base.com read-only API.
// NEVER persist/send buyer PII in this summary adapter.
const BASE_API_URL = 'https://api.base.com/connector.php';

const isMoney = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
function cents(n) {
  const value = Math.round((n + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(value)) throw new Error('base_amount_out_of_range');
  return value;
}
const MAX_UNIX_SECONDS = 8640000000000000 / 1000;
function normalizeAllegroOrder(organizationId, order) {
  if (!order || order.order_source !== 'allegro' || order.confirmed !== true) return null;
  if (!Number.isSafeInteger(order.order_id) || order.order_id <= 0) throw new Error('base_invalid_order_id');
  if (!Number.isSafeInteger(order.order_source_id) || order.order_source_id < 0) throw new Error('base_invalid_source_id');
  if (!Number.isSafeInteger(order.order_status_id) || order.order_status_id < 0) throw new Error('base_invalid_status_id');
  if (!Number.isSafeInteger(order.date_confirmed) || order.date_confirmed < 0 || order.date_confirmed > MAX_UNIX_SECONDS) throw new Error('base_invalid_confirmation_date');
  if (!/^[A-Z]{3}$/.test(order.currency || '')) throw new Error('base_invalid_currency');
  if (!Array.isArray(order.products)) throw new Error('base_invalid_products');
  if (!isMoney(order.delivery_price)) throw new Error('base_invalid_delivery');
  let totalItemCents = 0;
  for (const p of order.products) {
    if (!isMoney(p.price_brutto) || !Number.isSafeInteger(p.quantity) || p.quantity <= 0) throw new Error('base_invalid_line_amount');
    const amount = Math.round(cents(p.price_brutto) * p.quantity);
    if (!Number.isSafeInteger(amount)) throw new Error('base_amount_out_of_range');
    totalItemCents += amount;
    if (!Number.isSafeInteger(totalItemCents)) throw new Error('base_amount_out_of_range');
  }
  let commissionGross = null;
  if (Array.isArray(order.commissions) && order.commissions.every(c => isMoney(c.cost_brutto) && c.cost_currency === order.currency)) {
    const total = order.commissions.reduce((sum, c) => sum + cents(c.cost_brutto), 0);
    if (!Number.isSafeInteger(total)) throw new Error('base_commission_out_of_range');
    commissionGross = total / 100;
  }
  // Intentionally excludes buyer address, email, phone, comments and credentials.
  // Do not infer profit before purchase costs, discounts, taxes and shipping costs are reconciled.
  return Object.freeze({
    organizationId, provider: 'base.com', marketplace: 'allegro',
    orderId: String(order.order_id), sourceId: String(order.order_source_id),
    statusId: String(order.order_status_id),
    confirmedAt: new Date(order.date_confirmed * 1000).toISOString(),
    currency: order.currency,
    itemsGross: totalItemCents / 100,
    deliveryGross: cents(order.delivery_price) / 100,
    commissionGross,
    profit: null, profitVerified: false
  });
}

async function fetchAllegroOrdersPage({ organizationId, token, sinceUnix, fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  if (typeof organizationId !== 'string' || !organizationId.trim()) throw new Error('company_scope_required');
  if (typeof token !== 'string' || !token.trim()) throw new Error('base_token_required');
  if (!Number.isSafeInteger(sinceUnix) || sinceUnix < 0 || sinceUnix > MAX_UNIX_SECONDS) throw new Error('base_invalid_cursor');
  if (typeof fetchImpl !== 'function') throw new Error('base_fetch_unavailable');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) throw new Error('base_invalid_timeout');
  const body = new URLSearchParams({
    method: 'getOrders',
    parameters: JSON.stringify({ date_confirmed_from: sinceUnix, get_unconfirmed_orders: false })
  });
  const response = await fetchImpl(BASE_API_URL, {
    method: 'POST',
    headers: { 'X-BLToken': token, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response || !response.ok) throw new Error('base_http_error');
  const payload = await response.json();
  if (!payload || payload.status !== 'SUCCESS' || !Array.isArray(payload.orders)) throw new Error('base_invalid_response');
  if (payload.orders.length > 100) throw new Error('base_page_limit_exceeded');
  // Validate entire page before publishing even one entry.
  const orders = payload.orders.map(order => normalizeAllegroOrder(organizationId, order)).filter(Boolean);
  // A provider response outside the requested lower bound must not enter a dated report.
  // Reject the whole page instead of silently accepting a mismatched time window.
  if (orders.some(order => Date.parse(order.confirmedAt) / 1000 < sinceUnix)) {
    throw new Error('base_order_before_cursor');
  }
  // Duplicate IDs would inflate totals and make an apparently complete report unsafe.
  if (new Set(orders.map(order => order.orderId)).size !== orders.length) {
    throw new Error('base_duplicate_order_id');
  }
  return Object.freeze({
    organizationId,
    orders,
    pageSize: payload.orders.length,
    // Exactly 100 is NOT proof that all orders were fetched. Journal/cursor pagination is a separate milestone.
    morePagesPossible: payload.orders.length === 100,
    complete: payload.orders.length < 100
  });
}

// Do not publish a partial sales report when Base.com may have truncated the response.
// Safe cursor pagination needs a provider-verified continuation contract; advancing
// by timestamp alone can silently skip orders confirmed in the same second.
async function fetchCompleteAllegroOrders(options) {
  const page = await fetchAllegroOrdersPage(options);
  if (!page.complete) throw new Error('base_incomplete_page_requires_safe_pagination');
  return page;
}

module.exports = { BASE_API_URL, normalizeAllegroOrder, fetchAllegroOrdersPage, fetchCompleteAllegroOrders };
