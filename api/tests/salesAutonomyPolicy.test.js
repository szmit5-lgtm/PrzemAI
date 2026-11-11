"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {createSalesTask,evaluateAction,nextSalesStep,MAX_STEPS}=require("../services/SalesAutonomyPolicy");
const base=()=>createSalesTask({organizationId:"dekonica",requestedBy:"owner-1",
  objective:"Find B2B construction clients",leadLimit:25});
test("public research and drafts can be planned without approval",()=>{
  const task=base();
  for(const action of ["DISCOVER_LEADS","READ_PUBLIC_PAGE","QUALIFY_LEAD","DRAFT_OUTREACH"]){
    assert.equal(evaluateAction(task,action).allowed,true);
  }
  assert.equal(nextSalesStep(task,{action:"DISCOVER_LEADS"}).task.steps.length,1);
});
test("sending, account creation, login and commitments require approval",()=>{
  const task=base();
  for(const action of ["LOGIN","CREATE_ACCOUNT","SUBMIT_FORM","SEND_EMAIL",
    "SEND_MESSAGE","ACCEPT_TERMS","MAKE_COMMITMENT","PURCHASE","CHANGE_PRICE"]){
    const result=evaluateAction(task,action,{taskId:"t1",target:"example.com"});
    assert.equal(result.allowed,false);
    assert.equal(result.reason,"APPROVAL_REQUIRED");
  }
  assert.equal(nextSalesStep(task,{action:"SEND_EMAIL"},{taskId:"t1",target:"lead@example.com"}).task.status,"WAITING_APPROVAL");
});
test("approval must match company, task, target, action and owner",()=>{
  const task=base();
  task.approvals=[{organizationId:"dekonica",taskId:"t1",action:"SEND_EMAIL",
    target:"lead@example.com",approvedBy:"owner-1",status:"APPROVED"}];
  assert.equal(evaluateAction(task,"SEND_EMAIL",{taskId:"t1",target:"lead@example.com"}).allowed,true);
  assert.equal(evaluateAction(task,"SEND_EMAIL",{taskId:"t2",target:"lead@example.com"}).allowed,false);
  assert.equal(evaluateAction(task,"SEND_EMAIL",{taskId:"t1",target:"other@example.com"}).allowed,false);
  assert.equal(evaluateAction({...task,organizationId:"deherus"},"SEND_EMAIL",{taskId:"t1",target:"lead@example.com"}).allowed,false);
  task.approvals[0].used=true;
  assert.equal(evaluateAction(task,"SEND_EMAIL",{taskId:"t1",target:"lead@example.com"}).allowed,false);
});
test("unknown actions and exhausted tasks fail closed",()=>{
  const task=base();
  assert.equal(evaluateAction(task,"EXECUTE_JAVASCRIPT").allowed,false);
  assert.equal(evaluateAction({...task,steps:Array(MAX_STEPS).fill({})},"DISCOVER_LEADS").allowed,false);
  assert.equal(evaluateAction({...task,status:"CANCELLED"},"DISCOVER_LEADS").allowed,false);
  assert.throws(()=>createSalesTask({organizationId:"a",requestedBy:"b",objective:"c",leadLimit:101}));
});
