"use strict";

// Foundation for tenant-specific KSeF credentials. Never log or return tokens.
// This module does not change the legacy single-owner integration.
function validateCompanyKsefConfig(company, credential, userId) {
  if (!company || typeof company.id !== "string" || !company.id.trim() ||
      typeof company.nip !== "string" || !/^[0-9]{10}$/.test(company.nip)) {
    return { allowed: false, status: "INVALID_COMPANY" };
  }
  if (!credential || credential.companyId !== company.id ||
      credential.nip !== company.nip) {
    return { allowed: false, status: "COMPANY_MISMATCH" };
  }
  if (typeof userId !== "string" || !userId.trim() ||
      !Array.isArray(company.authorizedUserIds) ||
      !company.authorizedUserIds.includes(userId)) {
    return { allowed: false, status: "ACCESS_DENIED" };
  }
  if (credential.enabled !== true) {
    return { allowed: false, status: "DISABLED" };
  }
  if (credential.environment !== "production") {
    return { allowed: false, status: "INVALID_ENVIRONMENT" };
  }
  if (typeof credential.token !== "string" || !credential.token.trim() ||
      /[\\x00-\\x1f\\x7f]/.test(credential.token)) {
    return { allowed: false, status: "TOKEN_MISSING" };
  }
  return { allowed: true, status: "READY" };
}
module.exports = { validateCompanyKsefConfig };
