// Do not present an invalid API response as an account with no tasks.
export function parseTaskDashboardResponse(response) {
  const items = response?.items;
  const isTask = item =>
    item !== null && typeof item === "object" && !Array.isArray(item) &&
    typeof item.id === "string" && item.id.trim().length > 0 &&
    typeof item.title === "string" && item.title.trim().length > 0 &&
    typeof item.status === "string" && item.status.trim().length > 0;

  // Duplicate IDs make React reuse the wrong row and task actions ambiguous.
  if ((response?.success !== undefined && response.success !== true) ||
      !Array.isArray(items) || !items.every(isTask) ||
      new Set(items.map(item => item.id)).size !== items.length) {
    throw new Error("Nieprawidłowy format danych zadań.");
  }
  return items;
}

// Mutations must not insert malformed or unrelated records into the task list.
export function parseTaskMutationResponse(response, { id, status } = {}) {
  if (response?.success !== undefined && response.success !== true) {
    throw new Error("Nieprawidłowe potwierdzenie zmiany zadania.");
  }
  const [item] = parseTaskDashboardResponse({ items: [response?.item] });
  if ((id !== undefined && item.id !== id) ||
      (status !== undefined && item.status !== status)) {
    throw new Error("Nieprawidłowe potwierdzenie zmiany zadania.");
  }
  return item;
}

// A successful HTTP status alone is not proof that the task was deleted.
export function parseTaskDeletionResponse(response) {
  if (response?.success !== true) {
    throw new Error("Nieprawidłowe potwierdzenie usunięcia zadania.");
  }
  return true;
}
