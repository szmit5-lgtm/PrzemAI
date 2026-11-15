"use strict";

// Pure validation: no database, network, credentials or business side effects.
function isKaldevaJobRow(row, expectedStatus) {
  if (!row || typeof row.userId !== "string" || !row.userId.trim() ||
      !row.report || typeof row.report !== "object" || Array.isArray(row.report))
    return false;
  const report = row.report;
  if (report.status !== expectedStatus ||
      report.actorId !== row.userId ||
      report.companyId !== "kaldeva:" + row.userId) return false;
  if (expectedStatus === "queued")
    return typeof report.query === "string" && report.query.trim().length > 0;
  return expectedStatus === "running";
}
module.exports = { isKaldevaJobRow };
