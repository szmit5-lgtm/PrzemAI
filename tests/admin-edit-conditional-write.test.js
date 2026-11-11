"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

test("admin edit conditionally updates only the expected non-admin account", async () => {
  let handler;
  const calls = [];
  const target = {id:"member-1",email:"old@example.com",role:"user",createdAt:new Date("2026-01-01")};
  const prisma = {user:{
    async findUnique(query) { calls.push(["read",query]); return target; },
    async updateMany(query) { calls.push(["write",query]); return {count:1}; }
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
  let status=200,payload;
  const res={status(code){status=code;return this;},json(value){payload=value;return this;}};
  await handler({params:{id:"member-1"},user:{id:"system-admin"},body:{email:"new@example.com",expectedEmail:"old@example.com"}},res);
  assert.equal(status,200);
  assert.equal(payload.success,true);
  assert.equal(payload.data.email,"new@example.com");
  assert.deepEqual(calls[1],["write",{
    where:{id:"member-1",role:{not:"admin"},email:"old@example.com"},
    data:{email:"new@example.com"}
  }]);
  assert.equal(calls.length,2,"no extra read after a successful conditional write");
});
