'use strict';
const { evaluateSalesAction } = require('./salesAgentPolicy');

function normalize(value) {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('pl-PL').replace(/\s+/g, ' ') : '';
}
function canonicalHost(url) {
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return '';
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch { return ''; }
}
// Public search results can include directories, social media and search engines.
// These are not individual prospective customer websites.
const NON_LEAD_HOSTS = new Set([
  'facebook.com','instagram.com','linkedin.com','youtube.com','tiktok.com',
  'google.com','bing.com','panoramafirm.pl','pkt.pl','aleo.com',
  'oferteo.pl','fixly.pl','olx.pl','allegro.pl','wikipedia.org'
]);
function isDirectoryHost(host) {
  return [...NON_LEAD_HOSTS].some(blocked => host === blocked || host.endsWith('.' + blocked));
}
const NON_LEAD_HOSTS = ['facebook.com','instagram.com','linkedin.com','youtube.com','tiktok.com','google.com','bing.com','panoramafirm.pl','pkt.pl','aleo.com','oferteo.pl','fixly.pl','olx.pl','allegro.pl','wikipedia.org'];
function isDirectoryHost(host) {
 return NON_LEAD_HOSTS.some(blocked => host === blocked || host.endsWith('.' + blocked));
}
function buildSalesLeadReport({ companyId, actorId, leads }) {
  if (!companyId || !actorId || !Array.isArray(leads)) throw new TypeError('invalid_sales_job');
  const decision = evaluateSalesAction({ type: 'deduplicate_leads', companyId }, { companyId, actorId });
  if (decision.decision !== 'allow') throw new Error('sales_policy_denied');
  const seen = new Set();
  const accepted = [];
  const rejected = [];
  for (const lead of leads) {
    const name = normalize(lead?.name);
    const host = canonicalHost(lead?.website);
    if (!name || !host || lead.companyId !== companyId) {
      rejected.push({ reason: 'invalid_or_cross_company_lead' });
      continue;
    }
    if (isDirectoryHost(host)) { rejected.push({ reason: 'directory_or_social_listing', website: lead.website }); continue; }
    if (isDirectoryHost(host)) { rejected.push({ reason: 'directory_or_social_listing' }); continue; }
    if (seen.has(host)) { rejected.push({ reason: 'duplicate_domain' }); continue; }
    seen.add(host);
    const category = normalize(lead.category);
    const relevant = /instal|ogrzew|pompy ciepła|hvac|oze/.test(category);
    accepted.push({ name: lead.name.trim(), website: `https://${host}`, category: lead.category || '', source: lead.source || 'public_search', verificationStatus: 'unverified', score: relevant ? 2 : 1, status: 'research_only', draft: 'Dzień dobry, chcielibyśmy porozmawiać o potencjalnej współpracy w zakresie pomp ciepła. Czy możemy przesłać krótką informację?' });
  }
  return { companyId, scanned: leads.length, accepted, rejected, requiresApprovalBeforeSending: true };
}
module.exports = { buildSalesLeadReport, isDirectoryHost };
