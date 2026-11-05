"use strict";

// Only map fields defined in the official KSeF 2.0 InvoiceMetadata schema.
// Never store arbitrary API payloads or authentication material.
function mapKsefInvoice(invoice, { direction } = {}) {
  if (!invoice || typeof invoice !== "object" || Array.isArray(invoice)) {
    throw new Error("Invalid KSeF invoice metadata.");
  }
  const ksefNumber = invoice.ksefNumber;
  if (typeof ksefNumber !== "string" || !ksefNumber.trim() || ksefNumber.length > 256) {
    throw new Error("KSeF invoice is missing a valid ksefNumber.");
  }
  const issueDate = invoice.issueDate || null;
  let parsedDate = null;
  if (issueDate !== null) {
    parsedDate = new Date(issueDate);
    if (!Number.isFinite(parsedDate.getTime())) {
      throw new Error("Invalid KSeF invoice date.");
    }
  }

  const optionalText = (value, max) =>
    typeof value === "string" && value.trim() && value.length <= max ? value.trim() : undefined;
  // These are KSeF API-provided totals, not values calculated from ambiguous XML tags.
  const amount = value => typeof value === "number" && Number.isFinite(value) &&
    Math.abs(value) <= 1e14 ? value.toFixed(2) : undefined;
  const seller = invoice.seller && typeof invoice.seller === "object" ? invoice.seller : {};
  const buyer = invoice.buyer && typeof invoice.buyer === "object" ? invoice.buyer : {};
  const buyerId = buyer.identifier?.type === "Nip" ? buyer.identifier.value : undefined;
  const nip = value => typeof value === "string" && /^\d{10}$/.test(value) ? value : undefined;
  const currency = /^[A-Z]{3}$/.test(invoice.currency || "") ? invoice.currency : undefined;

  return {
    source: "KSEF",
    externalId: ksefNumber,
    ksefNumber,
    status: "NEW",
    issueDate: parsedDate,
    ...(optionalText(invoice.invoiceNumber, 256) && { invoiceNumber: optionalText(invoice.invoiceNumber, 256) }),
    ...(optionalText(seller.name, 512) && { sellerName: optionalText(seller.name, 512) }),
    ...(nip(seller.nip) && { sellerNip: nip(seller.nip) }),
    ...(optionalText(buyer.name, 512) && { buyerName: optionalText(buyer.name, 512) }),
    ...(nip(buyerId) && { buyerNip: nip(buyerId) }),
    ...(currency && { currency }),
    ...(amount(invoice.netAmount) !== undefined && { netAmount: amount(invoice.netAmount) }),
    ...(amount(invoice.grossAmount) !== undefined && { grossAmount: amount(invoice.grossAmount) }),
    ...(amount(invoice.vatAmount) !== undefined && { vatAmount: amount(invoice.vatAmount) }),
    ...(["INCOMING", "OUTGOING"].includes(direction) && { direction }),
    metadata: { importedFrom: "KSEF_METADATA" }
  };
}

module.exports = { mapKsefInvoice };
