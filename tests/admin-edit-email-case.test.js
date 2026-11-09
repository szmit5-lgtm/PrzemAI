"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

test("admin edit treats an unchanged mixed-case email as a no-op", async () => {
  let handler;
  let writes = 0;
  const originalEmail = "Customer@Example.COM";
  const prisma = {user:{
    async findUnique() {
      return {id:"target", email:originalEmail, role:"user", createdAt:new Date("2026-01-01")};
    },
    async updateMany() {writes++; return {count:1};}
  }};
  const router = {use(){},get(){},patch(route,fn){if(route==="/users/:id") handler=fn;}};
  const originalLoad=Module._load;
  const file=path.resolve(__dirname,"../api/routes/adminRoutes.js");
  try {
    Module._load=function(request,parent,isMain) {
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
  await handler({params:{id:"target"},user:{id:"admin"},body:{
    email:"customer@example.com",expectedEmail:originalEmail
  }},res);
  assert.equal(status,200);
  assert.equal(payload.success,true);
  assert.equal(payload.data.email,originalEmail);
  assert.equal(writes,0);
});
