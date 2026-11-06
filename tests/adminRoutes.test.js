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
