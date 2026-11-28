// Do not mistake a malformed finance API response for an account with no invoices.
// The backend returns { items: [...] } and { data: { total, new, mail, ksef } }.
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const success = response => response?.success === undefined || response.success === true;
const isCount = value => Number.isSafeInteger(value) && value >= 0;
const invalid = () => new Error("Nieprawidłowy format danych finansowych.");

export function parseFinancialDocuments(response) {
  const documents = response?.items;
  const isInvoice = value => isRecord(value) && typeof value.id === "string" && value.id.trim().length > 0;
  if (!success(response) || !Array.isArray(documents) || !documents.every(isInvoice) ||
      new Set(documents.map(document => document.id)).size !== documents.length) throw invalid();
  return documents;
}

export function parseFinanceSummary(response) {
  const summary = response?.data;
  if (!success(response) || !isRecord(summary) ||
      !["total", "new", "mail", "ksef"].every(key => isCount(summary[key]))) throw invalid();
  return summary;
}

export function parseFinanceDashboardResponses(documentsResponse, summaryResponse) {
  return { documents: parseFinancialDocuments(documentsResponse), summary: parseFinanceSummary(summaryResponse) };
}
