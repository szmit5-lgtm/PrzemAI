"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const path=require("node:path");

function setup(db) {
 const routes={};
 const router={use(fn){(routes.middleware??=[]).push(fn);},get(url,fn){routes["GET "+url]=fn;},patch(url,fn){routes["PATCH "+url]=fn;}};
 const original=Module._load;
 try {
  Module._load=function(request,parent,isMain){
   if(request==="express")return {Router:()=>router};
   if(request==="../../lib/prisma")return db;
   if(request==="../middleware/verifyToken")return (_req,_res,next)=>next();
   return original.apply(this,arguments);
  };
  const filename=path.resolve(__dirname,"../api/routes/adminRoutes.js");
  delete require.cache[filename];
  require(filename);
  delete require.cache[filename];
 }finally{Module._load=original;}
 return routes;
}
async function invoke(routes,payload,dbUser={id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}) {
 const req={user:{id:"owner"},params:{id:"target"},body:{expectedEmail:"old@example.com",...payload}};
 let status=200,body;
 const res={status(n){status=n;return this;},json(value){body=value;return this;}};
 const middleware=routes.middleware[1];
 await new Promise((resolve,reject)=>Promise.resolve(middleware(req,res,resolve)).then(()=>{if(body)resolve();},reject));
 if(body)return {status,body};
 await routes["PATCH /users/:id"](req,res);
 return {status,body};
}
test("admin edit: valid email normalized, no privilege change",async()=>{
 let updated;
 const db={user:{
  findUnique:async({where})=>where.id==="owner"?{id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}:{id:"target",role:"user",email:"old@example.com"},
  updateMany:async args=>{updated=args;return {count:1};}
 }};
 const result=await invoke(setup(db),{email:" New@Example.com "});
 assert.equal(result.status,200);
 assert.equal(updated.data.email,"new@example.com");
 assert.equal(updated.where.role.not,"admin");
 assert.equal(updated.where.email,"old@example.com");
 assert.equal(updated.data.role,undefined);
});
test("admin edit: invalid email rejected without write",async()=>{
 let writes=0;
 const db={user:{findUnique:async()=>({id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}),updateMany:async()=>{writes++;}}};
 const result=await invoke(setup(db),{email:"not-an-email"});
 assert.equal(result.status,400);assert.equal(writes,0);
});
test("admin edit: reserved administrator email rejected",async()=>{
 const db={user:{findUnique:async()=>({id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"})}};
 const result=await invoke(setup(db),{email:"p.szmitkowski@dekonica.com"});
 assert.equal(result.status,403);
});
test("admin edit: concurrent role promotion prevents write",async()=>{
 const db={user:{
  findUnique:async({where})=>where.id==="owner"?{id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}:{id:"target",role:"user",email:"old@example.com"},
  updateMany:async()=>({count:0})
 }};
 const result=await invoke(setup(db),{email:"new@example.com"});
 assert.equal(result.status,409);
});
test("admin edit: duplicate email returns conflict",async()=>{
 const db={user:{
  findUnique:async({where})=>where.id==="owner"?{id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}:{id:"target",role:"user",email:"old@example.com"},
  updateMany:async()=>{throw {code:"P2002"};}
 }};
 const result=await invoke(setup(db),{email:"used@example.com"});
 assert.equal(result.status,409);
});

test("admin edit: non-admin user cannot edit another account",async()=>{
 let writes=0;
 const db={user:{
  findUnique:async()=>({id:"owner",role:"user",email:"p.szmitkowski@dekonica.com"}),
  updateMany:async()=>{writes++;}
 }};
 const result=await invoke(setup(db),{email:"new@example.com"});
 assert.equal(result.status,403);
 assert.equal(writes,0);
});
test("admin edit: administrator with wrong email cannot edit",async()=>{
 let writes=0;
 const db={user:{
  findUnique:async()=>({id:"owner",role:"admin",email:"other@example.com"}),
  updateMany:async()=>{writes++;}
 }};
 const result=await invoke(setup(db),{email:"new@example.com"});
 assert.equal(result.status,403);
 assert.equal(writes,0);
});
test("admin edit: missing target returns 404 without writing",async()=>{
 let writes=0;
 const db={user:{
  findUnique:async({where})=>where.id==="owner"
   ?{id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}:null,
  updateMany:async()=>{writes++;}
 }};
 const result=await invoke(setup(db),{email:"new@example.com"});
 assert.equal(result.status,404);
 assert.equal(writes,0);
});
test("admin edit: own account is protected",async()=>{
 let writes=0;
 const db={user:{
  findUnique:async()=>({id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}),
  updateMany:async()=>{writes++;}
 }};
 const routes=setup(db);
 const req={user:{id:"owner"},params:{id:"owner"},body:{email:"new@example.com",expectedEmail:"old@example.com"}};
 let status=200;
 const res={status(n){status=n;return this;},json(){return this;}};
 await routes["PATCH /users/:id"](req,res);
 assert.equal(status,403);
 assert.equal(writes,0);
});

test("admin list: paginates 50 accounts without exposing passwords",async()=>{
 let query;
 const rows=Array.from({length:51},(_,i)=>({id:"u"+i,email:"u"+i+"@example.com",role:"user",createdAt:new Date("2026-01-01"),organizationMemberships:[]}));
 const db={user:{
  findUnique:async()=>({id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}),
  findMany:async args=>{query=args;return rows;}
 }};
 const routes=setup(db);
 const req={user:{id:"owner"},query:{}};
 let status=200,body;
 const res={status(n){status=n;return this;},json(v){body=v;return this;}};
 await routes["GET /users"](req,res);
 assert.equal(status,200);
 assert.equal(body.data.items.length,50);
 assert.equal(body.data.nextCursor,"u49");
 assert.equal(query.take,51);
 assert.equal(query.select.password,undefined);
 assert.equal(query.select.email,true);
});

test("admin list: cursor requests skip the previous row",async()=>{
 let query;
 const db={user:{
  findUnique:async()=>({id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}),
  findMany:async args=>{query=args;return [];}
 }};
 const routes=setup(db);
 let body;
 await routes["GET /users"]({user:{id:"owner"},query:{cursor:"u49"}},{json(v){body=v;return this;},status(){return this;}});
 assert.deepEqual(query.cursor,{id:"u49"});
 assert.equal(query.skip,1);
 assert.equal(body.data.nextCursor,null);
});

test("admin edit: administrator target cannot be changed",async()=>{
 let writes=0;
 const db={user:{
  findUnique:async({where})=>where.id==="owner"
   ?{id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}
   :{id:"target",role:"admin",email:"another-admin@example.com"},
  updateMany:async()=>{writes++;}
 }};
 const result=await invoke(setup(db),{email:"new@example.com"});
 assert.equal(result.status,403);
 assert.equal(writes,0);
});

test("admin list: non-admin cannot pass authorization middleware",async()=>{
 let queried=false;
 const db={user:{
  findUnique:async()=>({id:"owner",role:"user",email:"p.szmitkowski@dekonica.com"}),
  findMany:async()=>{queried=true;return [];}
 }};
 const routes=setup(db);
 let status=200,body;
 const res={status(n){status=n;return this;},json(v){body=v;return this;}};
 let passed=false;
 await routes.middleware[1]({user:{id:"owner"}},res,()=>{passed=true;});
 assert.equal(status,403);
 assert.equal(passed,false);
 assert.equal(queried,false);
 assert.equal(body.success,false);
});

test("admin list: administrator with different email is denied",async()=>{
 const db={user:{
  findUnique:async()=>({id:"owner",role:"admin",email:"other@example.com"})
 }};
 const routes=setup(db);
 let status=200,passed=false;
 const res={status(n){status=n;return this;},json(){return this;}};
 await routes.middleware[1]({user:{id:"owner"}},res,()=>{passed=true;});
 assert.equal(status,403);
 assert.equal(passed,false);
});

test("admin list: verified owner passes authorization middleware",async()=>{
 const db={user:{
  findUnique:async()=>({id:"owner",role:"admin",email:" P.Szmitkowski@Dekonica.com "})
 }};
 const routes=setup(db);
 let passed=false;
 const res={status(){throw new Error("Unexpected rejection");},json(){throw new Error("Unexpected rejection");}};
 await routes.middleware[1]({user:{id:"owner"}},res,()=>{passed=true;});
 assert.equal(passed,true);
});

test("admin list: malformed cursor is rejected before querying database",async()=>{
 let queries=0;
 const db={user:{
  findUnique:async()=>({id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}),
  findMany:async()=>{queries++;return [];}
 }};
 const routes=setup(db);
 for(const cursor of ["", " ".repeat(3), "x".repeat(100), ["a","b"]]){
  let status=200,body;
  const res={status(n){status=n;return this;},json(v){body=v;return this;}};
  await routes["GET /users"]({user:{id:"owner"},query:{cursor}},res);
  assert.equal(status,400);
  assert.equal(body.success,false);
 }
 assert.equal(queries,0);
});


test("admin list: database failure returns generic error without leaking details",async()=>{
 const db={user:{
  findUnique:async()=>({id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}),
  findMany:async()=>{throw new Error("DATABASE_URL=private-secret");}
 }};
 const routes=setup(db);
 let status=200,body;
 const res={status(n){status=n;return this;},json(v){body=v;return this;}};
 await routes["GET /users"]({user:{id:"owner"},query:{}},res);
 assert.equal(status,500);
 assert.equal(body.success,false);
 assert.doesNotMatch(JSON.stringify(body),/DATABASE_URL|private-secret/);
});

test("admin edit: database failure does not disclose internal details",async()=>{
 const db={user:{
  findUnique:async({where})=>where.id==="owner"
   ?{id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}
   :{id:"target",role:"user",email:"old@example.com"},
  updateMany:async()=>{throw new Error("postgres://private-secret");}
 }};
 const result=await invoke(setup(db),{email:"new@example.com"});
 assert.equal(result.status,500);
 assert.equal(result.body.success,false);
 assert.doesNotMatch(JSON.stringify(result.body),/postgres:|private-secret/);
});

test("admin edit: stale concurrent email change is rejected",async()=>{
 let filter;
 const db={user:{
  findUnique:async({where})=>where.id==="owner"
   ?{id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}
   :{id:"target",role:"user",email:"old@example.com"},
  updateMany:async args=>{filter=args.where;return {count:0};}
 }};
 const result=await invoke(setup(db),{email:"new@example.com"});
 assert.equal(result.status,409);
 assert.equal(filter.email,"old@example.com");
 assert.equal(filter.role.not,"admin");
});


test("admin edit: stale form cannot overwrite a changed email",async()=>{
 let writes=0;
 const db={user:{
  findUnique:async({where})=>where.id==="owner"
   ?{id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}
   :{id:"target",role:"user",email:"changed@example.com"},
  updateMany:async()=>{writes++;return {count:1};}
 }};
 const result=await invoke(setup(db),{email:"new@example.com",expectedEmail:"old@example.com"});
 assert.equal(result.status,409);
 assert.equal(writes,0);
});

test("admin edit: missing original email cannot bypass stale-form protection",async()=>{
 let writes=0;
 const db={user:{
  findUnique:async({where})=>where.id==="owner"
   ?{id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}
   :{id:"target",role:"user",email:"old@example.com"},
  updateMany:async()=>{writes++;return {count:1};}
 }};
 for(const expectedEmail of [null,42,"", "wrong@example.com"]){
  const result=await invoke(setup(db),{email:"new@example.com",expectedEmail});
  assert.equal(result.status,409);
 }
 assert.equal(writes,0);
});

test("admin edit: successful write returns updated account without a second database read",async()=>{
 let targetReads=0,writes=0;
 const createdAt=new Date("2026-01-02T00:00:00Z");
 const db={user:{
  findUnique:async({where})=>{
   if(where.id==="owner")return {id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"};
   targetReads++;
   if(targetReads>1)throw new Error("database read failed after committed write");
   return {id:"target",role:"user",email:"old@example.com",createdAt};
  },
  updateMany:async()=>{writes++;return {count:1};}
 }};
 const result=await invoke(setup(db),{email:"new@example.com"});
 assert.equal(result.status,200);
 assert.equal(result.body.success,true);
 assert.equal(result.body.data.email,"new@example.com");
 assert.equal(result.body.data.createdAt,createdAt);
 assert.equal(writes,1);
 assert.equal(targetReads,1);
});


test("admin authorization: database outage fails closed without reaching routes",async()=>{
 let passed=false;
 const db={user:{findUnique:async()=>{throw new Error("postgres://sensitive-connection");}}};
 const routes=setup(db);
 let status=200,body;
 const res={status(n){status=n;return this;},json(v){body=v;return this;}};
 await routes.middleware[1]({user:{id:"owner"}},res,()=>{passed=true;});
 assert.equal(status,500);
 assert.equal(passed,false);
 assert.equal(body.success,false);
 assert.doesNotMatch(JSON.stringify(body),/postgres:|sensitive-connection/);
});

test("admin authorization: deleted account cannot access user management",async()=>{
 let passed=false,queries=0;
 const db={user:{
  findUnique:async()=>null,
  findMany:async()=>{queries++;return [];}
 }};
 const routes=setup(db);
 let status=200,body;
 const res={status(n){status=n;return this;},json(v){body=v;return this;}};
 await routes.middleware[1]({user:{id:"deleted-owner"}},res,()=>{passed=true;});
 assert.equal(status,403);
 assert.equal(passed,false);
 assert.equal(queries,0);
 assert.equal(body.success,false);
});

test("admin authorization: missing database role cannot grant access",async()=>{
 let passed=false;
 const db={user:{findUnique:async()=>({id:"owner",email:"p.szmitkowski@dekonica.com"})}};
 const routes=setup(db);
 let status=200;
 const res={status(n){status=n;return this;},json(){return this;}};
 await routes.middleware[1]({user:{id:"owner"}},res,()=>{passed=true;});
 assert.equal(status,403);
 assert.equal(passed,false);
});

test("admin list: organization membership query excludes inactive and sensitive fields",async()=>{
 let query;
 const db={user:{
  findUnique:async()=>({id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}),
  findMany:async args=>{query=args;return [];}
 }};
 const routes=setup(db);
 let body;
 await routes["GET /users"]({user:{id:"owner"},query:{}},{json(v){body=v;return this;},status(){return this;}});
 assert.equal(body.success,true);
 assert.deepEqual(query.select.organizationMemberships.where.status.in,["ACTIVE","PENDING"]);
 assert.deepEqual(query.select.organizationMemberships.select.organization.select,{id:true,name:true});
 assert.deepEqual(query.select.organizationMemberships.select.role,true);
 assert.deepEqual(query.select.organizationMemberships.select.status,true);
 assert.equal(query.select.organizationMemberships.select.organization.select.ksefToken,undefined);
 assert.equal(query.select.organizationMemberships.select.organization.select.bankAccount,undefined);
 assert.equal(query.select.password,undefined);
});

test("admin edit: missing request body is rejected without database write",async()=>{
 let writes=0;
 const db={user:{
  findUnique:async()=>({id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}),
  updateMany:async()=>{writes++;}
 }};
 const routes=setup(db);
 const result=await invoke(routes,{email:undefined});
 assert.equal(result.status,400);
 assert.equal(writes,0);
});

test("admin edit: oversized email is rejected without database write",async()=>{
 let writes=0;
 const db={user:{
  findUnique:async()=>({id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}),
  updateMany:async()=>{writes++;}
 }};
 const result=await invoke(setup(db),{email:"a".repeat(250)+"@example.com"});
 assert.equal(result.status,400);
 assert.equal(writes,0);
});

test("admin edit: changing to protected email is case-insensitively denied",async()=>{
 let writes=0;
 const db={user:{
  findUnique:async()=>({id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}),
  updateMany:async()=>{writes++;}
 }};
 const result=await invoke(setup(db),{email:" P.SZMITKOWSKI@DEKONICA.COM "});
 assert.equal(result.status,403);
 assert.equal(writes,0);
});

test("admin edit: role injection cannot promote a regular user",async()=>{
 let update;
 const db={user:{
  findUnique:async({where})=>where.id==="owner"
   ?{id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}
   :{id:"target",role:"user",email:"old@example.com"},
  updateMany:async args=>{update=args;return {count:1};}
 }};
 const result=await invoke(setup(db),{email:"new@example.com",role:"admin",organizationId:"other-company",isAdmin:true});
 assert.equal(result.status,200);
 assert.deepEqual(update.data,{email:"new@example.com"});
 assert.equal(result.body.data.role,"user");
 assert.equal(update.where.role.not,"admin");
});

test("admin edit: non-string email is rejected before database write",async()=>{
 let writes=0;
 const db={user:{
  findUnique:async()=>({id:"owner",role:"admin",email:"p.szmitkowski@dekonica.com"}),
  updateMany:async()=>{writes++;return {count:1};}
 }};
 for(const email of [null,42,{},["new@example.com"]]){
  const result=await invoke(setup(db),{email});
  assert.equal(result.status,400);
 }
 assert.equal(writes,0);
});

test("admin list: trims pagination cursor before database lookup",async()=>{
 let query;
 const db={user:{findMany:async args=>{query=args;return [];}}};
 const routes=setup(db);
 let status=200,body;
 const res={status(n){status=n;return this;},json(v){body=v;return this;}};
 await routes["GET /users"]({user:{id:"owner"},query:{cursor:"  u49  "}},res);
 assert.equal(status,200);
 assert.equal(body.success,true);
 assert.deepEqual(query.cursor,{id:"u49"});
 assert.equal(query.skip,1);
});
