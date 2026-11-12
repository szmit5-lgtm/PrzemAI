'use strict';

// Safe, read-only lead discovery adapter. A caller supplies an authorized search
// function; this module never sends messages, registers accounts or logs in.
const { evaluateSalesAction } = require('./salesAgentPolicy');
const PRIVATE_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i;
function publicUrl(raw) {
  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (PRIVATE_HOST.test(host) || /^\d+$/.test(host) ||
        /^(10|127|0|169\.254|192\.168)\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
        host === '[::1]' || host.includes(':')) return null;
    if (!host.includes('.')) return null;
    url.hash = '';
    return url.toString();
  } catch { return null; }
}

async function discoverPublicLeads({ companyId, actorId, query, search, maxResults = 20 }) {
  const gate = evaluateSalesAction(
    { type: 'search_web', companyId }, { companyId, actorId }
  );
  if (gate.decision !== 'allow') throw new Error('search_not_authorized');
  if (typeof search !== 'function') throw new TypeError('search_adapter_required');
  if (typeof query !== 'string' || !query.trim() || query.length > 200) {
    throw new TypeError('invalid_query');
  }
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 50) {
    throw new RangeError('invalid_result_limit');
  }
  const results = await search(query.trim(), { limit: maxResults });
  if (!Array.isArray(results)) throw new TypeError('invalid_search_response');
  const seen = new Set();
  const leads = [];
  for (const item of results.slice(0, 200)) {
    const url = publicUrl(item?.url);
    if (!url) continue;
    const domain = new URL(url).hostname.replace(/^www\./, '');
    if (seen.has(domain)) continue;
    seen.add(domain);
    leads.push({
      companyId, domain, url,
      name: String(item?.title || domain).slice(0, 160),
      snippet: String(item?.snippet || '').slice(0, 500),
      source: 'public_search',
      status: 'unverified'
    });
    if (leads.length >= maxResults) break;
  }
  return { companyId, query: query.trim(), leads, count: leads.length,
    note: 'Public search candidates; verify company fit and contact details before outreach.' };
}

module.exports = { discoverPublicLeads, publicUrl };
