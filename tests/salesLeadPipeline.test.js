'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSalesLeadReport } = require('../salesLeadPipeline');
const base = { companyId:'kaldeva', actorId:'owner' };
test('deduplicates domains and prepares drafts without sending', () => {
  const r = buildSalesLeadReport({...base,leads:[
    { companyId:'kaldeva',name:'Firma A',website:'https://www.example.com/a',category:'Instalacje HVAC' },
    { companyId:'kaldeva',name:'Firma A oddział',website:'http://example.com/b',category:'OZE' }
  ]});
  assert.equal(r.accepted.length,1);assert.equal(r.rejected[0].reason,'duplicate_domain');
  assert.equal(r.accepted[0].score,2);assert.equal(r.requiresApprovalBeforeSending,true);
});
test('rejects cross-company and invalid website',()=>{
  const r=buildSalesLeadReport({...base,leads:[{companyId:'dekonica',name:'Firma',website:'https://firma.pl'}, {companyId:'kaldeva',name:'Firma',website:'javascript:alert(1)'}]});
  assert.equal(r.accepted.length,0);assert.equal(r.rejected.length,2);
});
test('rejects missing job identity',()=>assert.throws(()=>buildSalesLeadReport({companyId:'kaldeva',leads:[]}),/invalid_sales_job/));
test('empty job creates empty report',()=>{const r=buildSalesLeadReport({...base,leads:[]});assert.equal(r.scanned,0);assert.equal(r.accepted.length,0)});
