'use strict';
const { evaluateSalesAction } = require('./salesAgentPolicy');
const { buildSalesLeadReport } = require('./salesLeadPipeline');

// Minimal, in-process queue. The search adapter is injected; this module
// does not access the internet, store credentials, or send messages.
function createSalesJobQueue({ searchPublicLeads, maxLeads = 100, maxJobs = 500 } = {}) {
  if (typeof searchPublicLeads !== 'function') throw new TypeError('search_adapter_required');
  if (!Number.isInteger(maxLeads) || maxLeads < 1 || maxLeads > 1000) throw new TypeError('invalid_limit');
  if (!Number.isInteger(maxJobs) || maxJobs < 1 || maxJobs > 10000) throw new TypeError('invalid_job_limit');
  const jobs = new Map();
  let sequence = 0;
  function enqueue({ companyId, actorId, query }) {
    if (typeof query !== 'string' || !query.trim() || query.length > 200) throw new TypeError('invalid_query');
    const policy = evaluateSalesAction({ type: 'search_web', companyId }, { companyId, actorId });
    if (policy.decision !== 'allow') throw new Error('sales_policy_denied');
    // Reclaim the oldest finished job before rejecting new work. Never evict\n    // queued/running jobs, so bursts cannot silently discard active work.\n    if (jobs.size >= maxJobs) {\n      const finished = [...jobs.values()].find(j => ['completed', 'failed', 'cancelled'].includes(j.status));\n      if (finished) jobs.delete(finished.id);\n    }\n    if (jobs.size >= maxJobs) throw new Error('sales_queue_full');
    const id = String(++sequence);
    jobs.set(id, { id, companyId, actorId, query: query.trim(), status: 'queued', report: null, error: null });
    return id;
  }
  function get(id, { companyId, actorId }) {
    const job = jobs.get(id);
    if (!job || job.companyId !== companyId || job.actorId !== actorId) return null;
    return structuredClone(job);
  }
  function cancel(id, scope) {
    const job = get(id, scope);
    if (!job || job.status !== 'queued') return false;
    jobs.get(id).status = 'cancelled';
    return true;
  }
  async function runNext(id = null) {
    const job = id === null ? [...jobs.values()].find(j => j.status === 'queued') : jobs.get(String(id));
    if (job && job.status !== 'queued') return null;
    if (!job) return null;
    job.status = 'running';
    try {
      const leads = await searchPublicLeads({ query: job.query, companyId: job.companyId, actorId: job.actorId, limit: maxLeads });
      if (!Array.isArray(leads) || leads.length > maxLeads) throw new TypeError('invalid_search_results');
      job.report = buildSalesLeadReport({ companyId: job.companyId, actorId: job.actorId, leads });
      job.status = 'completed';
    } catch (err) {
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : 'unknown_error';
    }
    return get(job.id, { companyId: job.companyId, actorId: job.actorId });
  }
  return { enqueue, get, cancel, runNext };
}
module.exports = { createSalesJobQueue };
