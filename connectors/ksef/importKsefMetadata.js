"use strict";

const { mapKsefInvoice } = require("./mapKsefInvoice");

// Persist only verified KSeF identity fields; do not store authentication
// material, arbitrary API responses or unverified monetary totals.
async function importKsefMetadata({ userId, invoices, prisma } = {}) {
  if (typeof userId !== "string" || !userId.trim() ||
      userId !== userId.trim() || !Array.isArray(invoices) ||
      invoices.length > 1000 || !prisma?.financialDocument?.create) {
    throw new Error("Invalid KSeF import configuration.");
  }
  let created = 0;
  let duplicates = 0;
  for (const invoice of invoices) {
    const mapped = mapKsefInvoice(invoice);
    try {
      await prisma.financialDocument.create({
        data: { userId, ...mapped }
      });
      created += 1;
    } catch (error) {
      if (error?.code !== "P2002") throw error;
      duplicates += 1;
    }
  }
  return { created, duplicates };
}

module.exports = { importKsefMetadata };
