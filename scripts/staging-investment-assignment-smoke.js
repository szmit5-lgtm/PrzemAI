"use strict";
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { check } = require("./check-staging-isolation");
async function main() {
  check();
  const db = require("../lib/prisma");
  const { OrganizationInvestmentService } = require("../api/services/OrganizationInvestmentService");
  const rollback = new Error("EXPECTED_TEST_ROLLBACK");
  const tag = randomUUID();
  try {
    await db.$transaction(async tx => {
      const user = role => tx.user.create({data:{email:tag+"-"+role+"@example.invalid",password:"disabled-synthetic-account"}});
      const [owner, staff, outsider] = await Promise.all([user("owner"),user("staff"),user("outsider")]);
      const a = await tx.organization.create({data:{name:"Synthetic A",slug:"a-"+tag}});
      const b = await tx.organization.create({data:{name:"Synthetic B",slug:"b-"+tag}});
      for (const [org,u,role] of [[a,owner,"OWNER"],[a,staff,"MEMBER"],[b,outsider,"OWNER"]]) {
        await tx.organizationMembership.create({data:{organizationId:org.id,userId:u.id,role}});
      }
      const svc = new OrganizationInvestmentService({db:tx});
      const p = await svc.create(owner.id,a.id,{name:"Synthetic Mielno"});
      await svc.create(owner.id,a.id,{name:"Synthetic other"});
      const q = await svc.create(outsider.id,b.id,{name:"Synthetic Zgorzelec"});
      assert.equal((await svc.list(staff.id,a.id)).items.length,0);
      await assert.rejects(()=>svc.assignMembers(staff.id,a.id,p.id,{userIds:[staff.id]}),{status:403});
      await assert.rejects(()=>svc.assignMembers(owner.id,a.id,p.id,{userIds:[outsider.id]}),{status:403});
      await assert.rejects(()=>svc.assignMembers(owner.id,a.id,q.id,{userIds:[staff.id]}),{status:404});
      await svc.assignMembers(owner.id,a.id,p.id,{userIds:[staff.id]});
      const items=(await svc.list(staff.id,a.id)).items;
      assert.deepEqual(items.map(x=>x.id),[p.id]);
      assert.equal(Object.hasOwn(items[0],"assignedUserIds"),false);
      await assert.rejects(()=>svc.list(staff.id,b.id),{status:403});
      await svc.assignMembers(owner.id,a.id,p.id,{userIds:[]});
      assert.equal((await svc.list(staff.id,a.id)).items.length,0);
      throw rollback;
    },{timeout:30000});
    throw new Error("ROLLBACK_NOT_OBSERVED");
  } catch(e) { if(e!==rollback) throw e; }
  finally { await db.$disconnect(); }
  console.log("[STAGING-INVESTMENTS] PASS synthetic assignments, tenant isolation, rollback");
}
main().catch(()=>{console.error("[STAGING-INVESTMENTS] FAIL");process.exitCode=1;});
