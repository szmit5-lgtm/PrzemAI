"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const verifyToken = require("../api/middleware/verifyToken");
const secret = "synthetic-only-test-secret";
function request(auth) {
  let statusCode;
  let body;
  let nextCalled = false;
  const req = { headers: auth === undefined ? {} : { authorization: auth } };
  const res = { status(n) { statusCode = n; return this; }, json(v) { body = v; return this; } };
  return { req, res, run() { verifyToken(req,res,()=>{ nextCalled = true; }); return {statusCode,body,nextCalled,req}; } };
}
function withSecret(value, run) {
  const previous=process.env.JWT_SECRET;
  if(value===undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET=value;
  try { run(); } finally {
    if(previous===undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET=previous;
  }
}
test("valid signed token carries user ID", () => withSecret(secret,()=>{
  const token=jwt.sign({id:"synthetic-user"},secret,{expiresIn:"1m"});
  const result=request("Bearer "+token).run();
  assert.equal(result.nextCalled,true);
  assert.equal(result.req.user.id,"synthetic-user");
}));
test("bad header is rejected",()=>withSecret(secret,()=>{
  for(const token of [undefined,"Basic example","Bearer ","Bearer a b",42]){
    const result=request(token).run();
    assert.equal(result.nextCalled,false);
    assert.equal(result.statusCode,401);
  }
}));
test("unsigned, malformed or ID-less JWT is rejected",()=>withSecret(secret,()=>{
  const emptyId=jwt.sign({role:"admin"},secret,{expiresIn:"1m"});
  const bad=jwt.sign({id:"synthetic-user"},"other-secret",{expiresIn:"1m"});
  const none=jwt.sign({id:"synthetic-user"},secret,{algorithm:"none"});
  for(const token of [emptyId,bad,none,"not-a-token"]){
    const result=request("Bearer "+token).run();
    assert.equal(result.statusCode,401);
    assert.equal(result.nextCalled,false);
  }
}));
test("missing signing secret is fail-closed",()=>withSecret(undefined,()=>{
  const result=request("Bearer token").run();
  assert.equal(result.statusCode,503);
  assert.equal(result.nextCalled,false);
}));
