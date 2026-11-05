"use strict";

const { mapKsefInvoice } = require("./mapKsefInvoice");

// The (userId, source, externalId) uniqueness constraint makes repeated syncs idempotent.
async function importKsefMetadata({ userId, invoices, prisma, direction } = {}) {
  if (typeof userId !== "string" || !userId.trim() ||
      userId !== userId.trim() || !Array.isArray(invoices) ||
      invoices.length > 1000 || !prisma?.financialDocument?.create) {
    throw new Error("Invalid KSeF import configuration.");
  }
  let created = 0;
  let duplicates = 0;
  for (const invoice of invoices) {
    const mapped = mapKsefInvoice(invoice, { direction });
    try {
      await prisma.financialDocument.create({ data: { userId, ...mapped } });
      created += 1;
    } catch (error) {
      if (error?.code !== "P2002") throw error;
      duplicates += 1;
      // The first metadata-only imports had no totals. Enrich them without
      // clearing existing XML, status, project assignments or review history.
      if (typeof prisma.financialDocument.updateMany === "function") {
        const { source, externalId, status, metadata, ...safeFields } = mapped;
        const updates = Object.fromEntries(
          Object.entries(safeFields).filter(([, value]) => value !== undefined && value !== null)
        );
        await prisma.financialDocument.updateMany({
          where: { userId, source: "KSEF", externalId },
          data: updates
        });
      }
    }
  }
  return { created, duplicates };
}

module.exports = { importKsefMetadata };
