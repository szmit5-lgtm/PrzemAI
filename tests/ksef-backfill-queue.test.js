"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
test("KSeF backfill button queues a worker run without waiting for invoice downloads",()=>{
 const routes=fs.readFileSync(path.join(__dirname,"../api/routes/financeRoutes.js"),"utf8");
 const service=fs.readFileSync(path.join(__dirname,"../api/services/FinanceService.js"),"utf8");
 const frontend=fs.readFileSync(path.join(__dirname,"../frontend/src/app/finance/page.js"),"utf8");
 assert.match(routes,/post\("\/history\/import", verifyToken/);
 assert.match(service,/KSEF_OWNER_USER_ID !== userId/);
 assert.match(service,/nextRunAt: new Date\(\)/);
 assert.match(frontend,/Pobierz brakujące faktury/);
});
