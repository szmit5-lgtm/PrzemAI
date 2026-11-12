'use strict';
const { discoverPublicLeads } = require('./publicLeadDiscovery');
const { createSalesJobQueue } = require('./salesJobQueue');

// Bridges the discovery result shape (url) to the report pipeline (website).
// Search is supplied by the host application and must be read-only.
function createKaldevSalesWorkflow({ search, maxLeads = 20, maxJobs = 500 } = {}) {
  if (typeof search !== 'function') throw new TypeError('search_adapter_required');
  if (!Number.isInteger(maxLeads) || maxLeads < 1 || maxLeads > 50) throw new RangeError('invalid_lead_limit');
  const searchPublicLeads = async ({ query, companyId, actorId, limit }) => {
    const result = await discoverPublicLeads({
      query, companyId, actorId, maxResults: Math.min(limit, maxLeads), search
    });
    return result.leads.map(lead => ({
      companyId: lead.companyId,
      name: lead.name,
      website: lead.url,
      category: lead.snippet,
      source: lead.source,
      status: lead.status
    }));
  };
  // The queue forwards actorId to the discovery adapter for company-scoped policy.
  return createSalesJobQueue({ searchPublicLeads, maxLeads, maxJobs });
}
module.exports = { createKaldevSalesWorkflow };
