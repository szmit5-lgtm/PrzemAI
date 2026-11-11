'use strict';

// Pure policy gate for autonomous sales tasks. No network calls or side effects.
const APPROVAL_ACTIONS = new Set([
  'register_account', 'accept_terms', 'purchase', 'subscribe',
  'send_bulk_message', 'sign_contract', 'change_credentials',
  'publish_offer', 'submit_binding_quote'
]);
const SAFE_ACTIONS = new Set([
  'search_web', 'visit_public_page', 'extract_public_company_data',
  'deduplicate_leads', 'score_leads', 'draft_message', 'prepare_report'
]);

function evaluateSalesAction(action, context = {}) {
  if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
    return { decision: 'deny', reason: 'invalid_action' };
  }
  if (!context.companyId || !context.actorId || context.companyId !== action.companyId) {
    return { decision: 'deny', reason: 'company_scope_required' };
  }
  if (action.type === 'login') {
    return { decision: 'approval_required', reason: 'authenticated_session' };
  }
  if (action.type === 'send_message') {
    return { decision: 'approval_required', reason: 'external_communication' };
  }
  if (APPROVAL_ACTIONS.has(action.type)) {
    return { decision: 'approval_required', reason: 'external_commitment' };
  }
  if (SAFE_ACTIONS.has(action.type)) {
    return { decision: 'allow', reason: 'read_only_or_draft' };
  }
  return { decision: 'deny', reason: 'unknown_action' };
}

module.exports = { evaluateSalesAction };
