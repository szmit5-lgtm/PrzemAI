// Do not mistake a malformed finance API response for an account with no invoices.
// The backend returns { items: [...] } and { data: { total, new, mail, ksef } }.
export function parseFinanceDashboardResponses(documentsResponse, summaryResponse) {
  const documents = documentsResponse?.items;
  const summary = summaryResponse?.data;
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const isCount = value => Number.isSafeInteger(value) && value >= 0;

  if (!Array.isArray(documents) || !documents.every(isRecord) ||
      !isRecord(summary) || !["total", "new", "mail", "ksef"].every(key => isCount(summary[key]))) {
    throw new Error("Nieprawidłowy format danych finansowych.");
  }

  return { documents, summary };
}
