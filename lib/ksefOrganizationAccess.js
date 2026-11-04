"use strict";

// Organization-scoped authorization for future KSeF integration endpoints.
// Do not use a userId as a substitute for an organization membership.
async function requireKsefOrganizationAccess({ prisma, organizationId, userId, allowedRoles = ["OWNER", "ADMIN", "MEMBER"] } = {}) {
  if (!prisma?.organizationMembership?.findFirst ||
      typeof organizationId !== "string" || !organizationId.trim() ||
      typeof userId !== "string" || !userId.trim()) {
    throw new Error("KSeF organization access denied.");
  }
  const membership = await prisma.organizationMembership.findFirst({
    where: {
      organizationId,
      userId,
      status: "ACTIVE",
      organization: { status: "ACTIVE" },
      role: { in: allowedRoles }
    },
    select: { id: true, role: true, organizationId: true }
  });
  if (!membership) throw new Error("KSeF organization access denied.");
  return membership;
}

module.exports = { requireKsefOrganizationAccess };
