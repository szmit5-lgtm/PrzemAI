'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderOpportunityReport } = require('../allegroDailyReport');

test('empty report does not claim real offers', () => {
  const report = renderOpportunityReport([], '2026-11-12');
  assert.match(report, /Brak pobranych ofert/);
  assert.match(report, /kandydaci: 0/);
});
test('unverified prices remain in verification section', () => {
  const report = renderOpportunityReport([{store:'Action',product:'Lampka',sourceUrl:'https://example.org',checkedAt:'2026-11-12'}], '2026-11-12');
  assert.match(report, /Wymagają weryfikacji/);
  assert.match(report, /unverified_prices/);
  assert.match(report, /kandydaci: 0/);
});
test('rejects invalid report date', () => {
  assert.throws(() => renderOpportunityReport([], 'today'), /invalid_report_input/);
});
