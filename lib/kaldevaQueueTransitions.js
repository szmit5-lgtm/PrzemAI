"use strict";

// Atomic conditional transitions; caller validates the tenant before invoking.
async function claimKaldevaJob(db, row) {
  return db.$executeRaw`
    UPDATE "History" SET "report" = ${JSON.stringify({...row.report,status:"running"})}::jsonb,
      "updatedAt" = NOW()
    WHERE "id" = ${row.id} AND "userId" = ${row.userId}
      AND "type" = 'KALDEVA_SALES' AND "report"->>'status' = 'queued'
      AND "report"->>'actorId' = ${row.userId}
      AND "report"->>'companyId' = ${row.report.companyId}
  `;
}
async function finishKaldevaJob(db, row, nextReport) {
  return db.$executeRaw`
    UPDATE "History" SET "report" = ${JSON.stringify(nextReport)}::jsonb,
      "updatedAt" = NOW()
    WHERE "id" = ${row.id} AND "userId" = ${row.userId}
      AND "type" = 'KALDEVA_SALES' AND "report"->>'status' = 'running'
      AND "report"->>'actorId' = ${row.userId}
      AND "report"->>'companyId' = ${row.report.companyId}
  `;
}
module.exports={claimKaldevaJob,finishKaldevaJob};
