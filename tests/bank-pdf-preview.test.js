"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {createBankPdfPreviewHandler}=require("../api/services/BankPdfPreview");
class OrganizationError extends Error {constructor(status){super("private details");this.status=status;}}
function setup(options={}) {
 const calls=[];
 const handler=createBankPdfPreviewHandler({
  OrganizationError,
  financeService:{async accessible(user,org){calls.push("access");assert.equal(user,"owner");assert.equal(org,"dekonica");if(options.accessError)throw options.accessError;}},
  prisma:{organizationMembership:{async findFirst({where}){calls.push("membership");assert.deepEqual(where,{userId:"owner",organizationId:"dekonica",status:"ACTIVE",role:"OWNER"});return options.nonOwner?null:{id:"membership"};}}},
  upload(req,res,cb){calls.push("upload");if(!options.noFile)req.file={buffer:Buffer.from(options.invalidMagic?"invalid":"%PDF-test")};return cb(options.uploadError);},
  async parsePdf(buffer,config){calls.push("parse");assert.equal(config.max,150);if(options.parseError)throw options.parseError;return options.parsed||{numpages:1,text:"2026/001\nPL61109010140000071219812874\nSaldo 100,00"};}
 });
 const res={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
 return {calls,res,run:()=>handler({user:{id:"owner"},params:{id:"dekonica"}},res)};
}

test("PDF preview checks company access and owner role before upload and parsing",async()=>{
 for(const options of [{accessError:new OrganizationError(403)},{nonOwner:true}]) {
  const s=setup(options);await s.run();assert.equal(s.res.statusCode,403);assert.ok(!s.calls.includes("upload"));assert.ok(!s.calls.includes("parse"));
 }
});
test("PDF access infrastructure failure fails closed without exposing details",async()=>{
 const s=setup({accessError:new Error("secret connection string")});await s.run();assert.equal(s.res.statusCode,500);assert.deepEqual(s.calls,["access"]);assert.ok(!JSON.stringify(s.res.body).includes("secret"));
});
test("PDF rejects upload errors, missing files and invalid signatures before parsing",async()=>{
 for(const options of [{uploadError:new Error("size")},{noFile:true},{invalidMagic:true}]) {
  const s=setup(options);await s.run();assert.equal(s.res.statusCode,400);assert.ok(!s.calls.includes("parse"));
 }
});
test("PDF preview returns review-only candidates for authorized owner",async()=>{
 const s=setup();await s.run();assert.equal(s.res.statusCode,200);assert.equal(s.res.body.data.requiresReview,true);assert.deepEqual(s.res.body.data.statementNumbers,["2026/001"]);assert.deepEqual(s.res.body.data.accountNumbers,["PL61109010140000071219812874"]);assert.deepEqual(s.calls,["access","membership","upload","parse"]);
});
test("PDF rejects page or line truncation instead of silently returning partial statements",async()=>{
 for(const parsed of [{numpages:151,text:"partial"},{numpages:0,text:"invalid"},{text:"missing count"},{numpages:1,text:"row\n".repeat(15001)}]) {
  const s=setup({parsed});await s.run();assert.equal(s.res.statusCode,422);assert.equal(s.res.body.success,false);assert.equal(s.res.body.data,undefined);
 }
 const s=setup({parsed:{numpages:150,text:"row\n".repeat(15000)}});await s.run();assert.equal(s.res.statusCode,200);assert.equal(s.res.body.data.lines.length,15000);
});
test("PDF handles scans and parser failures without exposing document details",async()=>{
 for(const options of [{parsed:{numpages:1,text:"  \n "}},{parseError:new Error("private document") }]) {
  const s=setup(options);await s.run();assert.equal(s.res.statusCode,422);assert.ok(!JSON.stringify(s.res.body).includes("private document"));
 }
});
