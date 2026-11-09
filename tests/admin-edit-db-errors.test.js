"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

test("admin user edit reports missing account and duplicate email without leaking details", async () => {
  let handler;
  let mode = "missing";
  let writes = 0;
  const prisma = {user: {
    async findUnique() {
      if (mode === "missing") return null;
      return {id:"target",email:"old@example.com",role:"user",createdAt:new Date("2026-01-01")};
    },
    async updateMany() {
      writes++;
      throw Object.assign(new Error("Database constraint details must remain private"), {code:"P2002"});
    }
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
  async function edit() {
    let status=200,payload;
    const res={status(code){status=code;return this;},json(value){payload=value;return this;}};
    await handler({params:{id:"target"},user:{id:"admin"},body:{email:"new@example.com",expectedEmail:"old@example.com"}},res);
    return {status,payload};
  }
  const missing=await edit();
  assert.equal(missing.status,404);
  assert.equal(missing.payload.success,false);
  assert.equal(writes,0);
  mode="duplicate";
  const duplicate=await edit();
  assert.equal(duplicate.status,409);
  assert.equal(duplicate.payload.success,false);
  assert.match(duplicate.payload.error,/zajęty/);
  assert.doesNotMatch(JSON.stringify(duplicate.payload),/Database constraint details/);
  assert.equal(writes,1);
});
