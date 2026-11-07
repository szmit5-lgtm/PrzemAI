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
 const req={user:{id:"owner"},params:{id:"target"},body:payload};
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
 assert.equal(updated.where.email.not,"p.szmitkowski@dekonica.com");
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
 const req={user:{id:"owner"},params:{id:"owner"},body:{email:"new@example.com"}};
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
