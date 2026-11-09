"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

test("admin email edit enforces optimistic concurrency and avoids no-op writes", async () => {
  let handler;
  let reads = 0;
  let writes = 0;
  const target = {id:"target",email:"old@example.com",role:"user",createdAt:new Date("2026-01-01")};
  const prisma = {user:{
    async findUnique() { reads++; return target; },
    async updateMany() { writes++; return {count:0}; }
  }};
  const router = {use(){},get(){},patch(route,fn){if(route==="/users/:id")handler=fn;}};
  const originalLoad = Module._load;
  const file = path.resolve(__dirname,"../api/routes/adminRoutes.js");
  try {
    Module._load = function(request,parent,isMain) {
      if(request==="express")return {Router:()=>router};
      if(request==="../../lib/prisma")return prisma;
      if(request==="../middleware/verifyToken")return (_req,_res,next)=>next();
      return originalLoad.apply(this,arguments);
    };
    delete require.cache[file];
    require(file);
  } finally {
    Module._load=originalLoad;
    delete require.cache[file];
  }
  assert.equal(typeof handler,"function");
  async function request(body) {
    let status=200, payload;
    const res={status(code){status=code;return this;},json(value){payload=value;return this;}};
    await handler({params:{id:"target"},user:{id:"admin"},body},res);
    return {status,payload};
  }
  const stale=await request({email:"new@example.com",expectedEmail:"stale@example.com"});
  assert.equal(stale.status,409);
  assert.equal(stale.payload.success,false);
  assert.equal(writes,0);
  const unchanged=await request({email:"old@example.com",expectedEmail:"old@example.com"});
  assert.equal(unchanged.status,200);
  assert.equal(unchanged.payload.data.email,"old@example.com");
  assert.equal(writes,0);
  const raced=await request({email:"new@example.com",expectedEmail:"old@example.com"});
  assert.equal(raced.status,409);
  assert.equal(raced.payload.success,false);
  assert.equal(writes,1);
  assert.equal(reads,3);
});
