"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

test("admin user edit masks unexpected database failures", async () => {
  let handler;
  let updateCalls = 0;
  const prisma = {user:{
    async findUnique() {return {id:"target",email:"old@example.com",role:"user",createdAt:new Date("2026-01-01")};},
    async updateMany() {updateCalls++;throw new Error("private database connection string");}
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
  await handler({params:{id:"target"},user:{id:"admin"},body:{email:"new@example.com",expectedEmail:"old@example.com"}},res);
  assert.equal(updateCalls,1);
  assert.equal(status,500);
  assert.equal(payload.success,false);
  assert.equal(payload.error,"Nie udało się zapisać konta.");
  assert.doesNotMatch(JSON.stringify(payload),/private database connection string/);
});
