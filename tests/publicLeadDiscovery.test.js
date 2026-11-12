'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { discoverPublicLeads, publicUrl } = require('../publicLeadDiscovery');
const base = { companyId: 'kaldeva', actorId: 'owner', query: 'pompy ciepla hurtownie' };
test('deduplicates domains and labels candidates unverified', async () => {
  const search = async () => [
    { url: 'https://www.example.com/a', title: 'Example' },
    { url: 'https://example.com/b', title: 'Duplicate' },
    { url: 'https://other.example.org/', title: 'Other' }
  ];
  const result = await discoverPublicLeads({ ...base, search });
  assert.equal(result.count, 2);
  assert.equal(result.leads[0].status, 'unverified');
  assert.equal(result.leads[0].companyId, 'kaldeva');
});
test('rejects unsafe URLs and private addresses', () => {
  for (const url of ['file:///etc/passwd','http://localhost/a','http://127.0.0.1',
    'http://10.1.1.1','http://192.168.1.2','http://172.20.0.1','http://[::1]/']) {
    assert.equal(publicUrl(url), null);
  }
});
test('rejects missing actor and invalid query before search', async () => {
  await assert.rejects(discoverPublicLeads({ ...base, actorId: '', search: async () => [] }), /search_not_authorized/);
  await assert.rejects(discoverPublicLeads({ ...base, query: '', search: async () => [] }), /invalid_query/);
});
test('caps results and refuses malformed adapter responses', async () => {
  await assert.rejects(discoverPublicLeads({ ...base, maxResults: 51, search: async () => [] }), /invalid_result_limit/);
  await assert.rejects(discoverPublicLeads({ ...base, search: async () => ({}) }), /invalid_search_response/);
});
