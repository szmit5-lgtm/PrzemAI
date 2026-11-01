// Do not confuse a failed history request with an account that has no analyses.
export function parseHistoryListResponse(response) {
  const items = response?.items;
  const isItem = item =>
    item !== null && typeof item === "object" && !Array.isArray(item) &&
    typeof item.id === "string" && item.id.trim().length > 0 &&
    typeof item.title === "string" && item.title.trim().length > 0 &&
    typeof item.type === "string" && item.type.trim().length > 0 &&
    typeof item.createdAt === "string" && item.createdAt.trim().length > 0;

  if (response?.success !== true || !Array.isArray(items) ||
      !items.every(isItem) ||
      new Set(items.map(item => item.id)).size !== items.length) {
    throw new Error("Nieprawidłowy format historii analiz.");
  }
  return items;
}

// Do not remove an analysis from the UI unless the API confirms deletion.
export function parseHistoryDeletionResponse(response) {
  if (response?.success !== true) {
    throw new Error("Brak potwierdzenia usunięcia analizy.");
  }
  return true;
}
