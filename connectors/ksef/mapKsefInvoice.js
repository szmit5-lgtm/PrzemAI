"use strict";

// Normalize read-only KSeF metadata without assuming fields absent from the response.
// Never persist authentication material or the full API response here.
function mapKsefInvoice(invoice) {
  if (!invoice || typeof invoice !== "object" || Array.isArray(invoice)) {
    throw new Error("Invalid KSeF invoice metadata.");
  }
  const ksefNumber = invoice.ksefNumber;
  if (typeof ksefNumber !== "string" || !ksefNumber.trim() ||
      ksefNumber.length > 256) {
    throw new Error("KSeF invoice is missing a valid ksefNumber.");
  }
  const issueDate = invoice.invoicingDate || invoice.issueDate || null;
  let parsedDate = null;
  if (issueDate !== null) {
    parsedDate = new Date(issueDate);
    if (!Number.isFinite(parsedDate.getTime())) {
      throw new Error("Invalid KSeF invoice date.");
    }
  }
  return {
    source: "KSEF",
    externalId: ksefNumber,
    ksefNumber,
    status: "NEW",
    issueDate: parsedDate,
    // Metadata only. Financial amounts must be verified against official schema
    // and never fabricated from fields with ambiguous semantics.
    metadata: { importedFrom: "KSEF_METADATA" }
  };
}

module.exports = { mapKsefInvoice };
