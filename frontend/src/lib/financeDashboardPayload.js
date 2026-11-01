// Do not mistake a malformed finance API response for an account with no invoices.
// The backend returns { items: [...] } and { data: { total, new, mail, ksef } }.
export function parseFinanceDashboardResponses(documentsResponse, summaryResponse) {
  const documents = documentsResponse?.items;
  const summary = summaryResponse?.data;
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const isInvoice = value => isRecord(value) &&
    typeof value.id === "string" && value.id.trim().length > 0;
  const isCount = value => Number.isSafeInteger(value) && value >= 0;

  // Repeated IDs cause React to reuse rows and display misleading invoice data.
  // Explicitly unsuccessful API responses must not be shown as verified financial data.
  if ((documentsResponse?.success !== undefined && documentsResponse.success !== true) ||
      (summaryResponse?.success !== undefined && summaryResponse.success !== true) ||
      !Array.isArray(documents) || !documents.every(isInvoice) ||
      new Set(documents.map(document => document.id)).size !== documents.length ||
      !isRecord(summary) || !["total", "new", "mail", "ksef"].every(key => isCount(summary[key]))) {
    throw new Error("Nieprawidłowy format danych finansowych.");
  }

  return { documents, summary };
}
