"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { isKaldevaJobRow } = require("../lib/kaldevaJobGuard");
const base = {userId:"synthetic-user-1", report:{
  actorId:"synthetic-user-1",companyId:"kaldeva:synthetic-user-1",
  status:"queued",query:"synthetic HVAC leads"
}};
test("accepts only same-tenant queued job with nonempty query",()=>{
  assert.equal(isKaldevaJobRow(base,"queued"),true);
  for(const row of [
    {...base,userId:"synthetic-user-2"},
    {...base,report:{...base.report,actorId:"synthetic-user-2"}},
    {...base,report:{...base.report,companyId:"kaldeva:synthetic-user-2"}},
    {...base,report:{...base.report,status:"running"}},
    {...base,report:{...base.report,query:"  "}},
    {...base,report:{...base.report,query:null}},
    {...base,report:null},null
  ]) assert.equal(isKaldevaJobRow(row,"queued"),false);
});
test("stale recovery only applies to running job in same tenant",()=>{
  const running={...base,report:{...base.report,status:"running"}};
  assert.equal(isKaldevaJobRow(running,"running"),true);
  assert.equal(isKaldevaJobRow(base,"running"),false);
  assert.equal(isKaldevaJobRow({...running,report:{...running.report,companyId:"kaldeva:another"}},"running"),false);
});
test("rejects unsupported states",()=>{
  for(const state of ["completed","failed","cancelled",""])
    assert.equal(isKaldevaJobRow({...base,report:{...base.report,status:state}},state),false);
});
