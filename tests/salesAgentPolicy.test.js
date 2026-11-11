'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateSalesAction } = require('../salesAgentPolicy');

const ctx = { companyId: 'kaldeva', actorId: 'owner' };
test('allows public lead research within company scope', () => {
  assert.equal(evaluateSalesAction({ type: 'search_web', companyId: 'kaldeva' }, ctx).decision, 'allow');
  assert.equal(evaluateSalesAction({ type: 'draft_message', companyId: 'kaldeva' }, ctx).decision, 'allow');
});
test('requires approval for external actions', () => {
  for (const type of ['register_account', 'login', 'send_message', 'purchase', 'accept_terms', 'submit_binding_quote']) {
    assert.equal(evaluateSalesAction({ type, companyId: 'kaldeva' }, ctx).decision, 'approval_required');
  }
});
test('denies cross-company and missing actor context', () => {
  assert.equal(evaluateSalesAction({ type: 'search_web', companyId: 'dekonica' }, ctx).decision, 'deny');
  assert.equal(evaluateSalesAction({ type: 'search_web', companyId: 'kaldeva' }, { companyId: 'kaldeva' }).decision, 'deny');
});
test('fails closed for unknown or malformed actions', () => {
  assert.equal(evaluateSalesAction({ type: 'delete_all', companyId: 'kaldeva' }, ctx).decision, 'deny');
  assert.equal(evaluateSalesAction(null, ctx).decision, 'deny');
});
