"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {buildSettlementReport} = require("../api/services/InvoiceSettlementReport");
const invoice = {id:"i1",invoiceNumber:"FV/1",grossAmount:"1000.00",currency:"PLN",dueDate:"2026-11-10"};
test("missing bank coverage is not proof of nonpayment",()=>{
 const r=buildSettlementReport([invoice],[],[],{asOf:"2026-11-22"});
 assert.equal(r.rows[0].status,"PAYMENT_UNCONFIRMED");
 assert.equal(r.rows[0].remaining,"1000.00");
});
test("full coverage marks overdue unpaid invoices",()=>{
 const r=buildSettlementReport([invoice],[],[],{asOf:"2026-11-22",bankCoverageComplete:true});
 assert.equal(r.rows[0].status,"OVERDUE");
 assert.equal(r.rows[0].daysOverdue,12);
});
test("partial payment and verified credit note reduce outstanding amount",()=>{
 const r=buildSettlementReport([invoice],
  [{invoiceId:"i1",transactionId:"t1",amount:"300",confirmed:true}],
  [{id:"c1",originalInvoiceId:"i1",grossDelta:-200,verified:true}],
  {asOf:"2026-11-22",bankCoverageComplete:true});
 assert.equal(r.rows[0].status,"PARTIALLY_PAID");
 assert.equal(r.rows[0].correctedGross,"800.00");
 assert.equal(r.rows[0].remaining,"500.00");
});
test("unconfirmed allocations and corrections never affect totals",()=>{
 const r=buildSettlementReport([invoice],
  [{invoiceId:"i1",transactionId:"t1",amount:1000,confirmed:false}],
  [{id:"c1",originalInvoiceId:"i1",grossDelta:-1000,verified:false}],
  {bankCoverageComplete:true});
 assert.equal(r.rows[0].remaining,"1000.00");
});
test("duplicate bank imports and duplicate corrections are idempotent",()=>{
 const allocation={invoiceId:"i1",transactionId:"t1",amount:400,confirmed:true};
 const correction={id:"c1",originalInvoiceId:"i1",grossDelta:-100,verified:true};
 const r=buildSettlementReport([invoice],[allocation,allocation],[correction,correction],{bankCoverageComplete:true});
 assert.equal(r.rows[0].remaining,"500.00");
});
