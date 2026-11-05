"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { workerOwnerScope } = require("../lib/workerOwnerScope");
test("no scope preserves staging behavior",()=>{
 assert.equal(workerOwnerScope({}),null);
});
test("production owner scope is explicit",()=>{
 assert.equal(workerOwnerScope({WORKER_OWNER_USER_ID:"owner-id"}),"owner-id");
});
test("malformed or empty scope cannot silently widen access",()=>{
 for(const id of ["", "   ", " owner ", "x".repeat(129), 15]){
   assert.throws(()=>workerOwnerScope({WORKER_OWNER_USER_ID:id}),/refusing unscoped worker startup/);
 }
});
