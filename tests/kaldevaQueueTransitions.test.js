"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {claimKaldevaJob,finishKaldevaJob}=require("../lib/kaldevaQueueTransitions");
const row={id:"fictional-job",userId:"fictional-user",report:{
  actorId:"fictional-user",companyId:"kaldeva:fictional-user",
  query:"fictional test customers",status:"queued"
}};
// Simulates PostgreSQL's atomic UPDATE predicate under a single-row lock.
// This is NOT a database integration test.
function mockDb(initial) {
 let current=structuredClone(initial), affected=0;
 return {
   async $executeRaw(strings,...args) {
     const sql=strings.join("?");
     assert.match(sql,/AND "type" = 'KALDEVA_SALES'/);
     assert.match(sql,/AND "report"->>'actorId'/);
     assert.match(sql,/AND "report"->>'companyId'/);
     const next=JSON.parse(args[0]);
     const jobId=args[1],userId=args[2],actorId=args[3],companyId=args[4];
     const expected=sql.includes("'queued'")?"queued":"running";
     await Promise.resolve(); // interleave both simulated workers
     if(current.id!==jobId||current.userId!==userId||current.report.status!==expected||
        current.report.actorId!==actorId||current.report.companyId!==companyId) return 0;
     current.report=next; affected++; return 1;
   },
   get row(){return structuredClone(current);},
   get writes(){return affected;}
 };
}
test("two workers cannot both claim a queued row in atomic mock",async()=>{
 const db=mockDb(row);
 const results=await Promise.all([claimKaldevaJob(db,row),claimKaldevaJob(db,row)]);
 assert.deepEqual(results.sort(),[0,1]);
 assert.equal(db.writes,1);
 assert.equal(db.row.report.status,"running");
});
test("cancelled work is not reclaimed and result cannot overwrite cancellation",async()=>{
 const db=mockDb({...row,report:{...row.report,status:"cancelled"}});
 assert.equal(await claimKaldevaJob(db,row),0);
 assert.equal(await finishKaldevaJob(db,row,{...row.report,status:"completed"}),0);
 assert.equal(db.writes,0);
});
test("only the matching actor and company can transition",async()=>{
 for(const field of ["actorId","companyId"]){
   const report={...row.report,[field]:"another-tenant"};
   const db=mockDb({...row,report});
   assert.equal(await claimKaldevaJob(db,row),0);
   assert.equal(db.writes,0);
 }
});
test("finishing a running job succeeds once and does not overwrite newer status",async()=>{
 const db=mockDb(row);
 assert.equal(await claimKaldevaJob(db,row),1);
 const result={...row.report,status:"completed",report:{scanned:2,accepted:[],rejected:[]}};
 assert.equal(await finishKaldevaJob(db,row,result),1);
 assert.equal(await finishKaldevaJob(db,row,result),0);
 assert.equal(db.row.report.status,"completed");
 assert.equal(db.writes,2);
});
