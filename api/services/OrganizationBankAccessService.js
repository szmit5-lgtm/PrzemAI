"use strict";
const prisma = require("../../lib/prisma");
const { OrganizationService, OrganizationError } = require("./OrganizationService");

// Bank data is organization-scoped. KSeF link is neither necessary nor
// sufficient to grant access to company bank statements.
class OrganizationBankAccessService {
  constructor({db=prisma,organizationService=null}={}) {
    this.db=db;
    this.organizationService=organizationService||new OrganizationService({db});
  }
  async authorize(userId,organizationId,{ownerOnly=false}={}) {
    const member=await this.organizationService.membership(userId,organizationId);
    if(ownerOnly) {
      if(member.role!=="OWNER")throw new OrganizationError("Import wyciągów wymaga roli właściciela firmy.",403);
      return {role:member.role};
    }
    if(member.role==="OWNER")return {role:"OWNER"};
    const allowed=await this.db.organizationMembership.findFirst({
      where:{
        userId,organizationId,status:"ACTIVE",financeAccess:true,
        organization:{status:"ACTIVE"}
      },
      select:{id:true,userId:true,organizationId:true,financeAccess:true}
    });
    if(!allowed || allowed.userId!==userId || allowed.organizationId!==organizationId || !allowed.financeAccess) {
      throw new OrganizationError("Nie masz dostępu do finansów tej firmy.",403);
    }
    return {role:member.role};
  }
}
module.exports={OrganizationBankAccessService};
