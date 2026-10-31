// Do not present an invalid API response as an account with no tasks.
export function parseTaskDashboardResponse(response) {
  const items = response?.items;
  const isTask = item =>
    item !== null && typeof item === "object" && !Array.isArray(item) &&
    typeof item.id === "string" && item.id.length > 0 &&
    typeof item.title === "string" &&
    typeof item.status === "string";

  if (!Array.isArray(items) || !items.every(isTask)) {
    throw new Error("Nieprawidłowy format danych zadań.");
  }
  return items;
}

// Mutations must not insert malformed or unrelated records into the task list.
export function parseTaskMutationResponse(response, { id, status } = {}) {
  const [item] = parseTaskDashboardResponse({ items: [response?.item] });
  if ((id !== undefined && item.id !== id) ||
      (status !== undefined && item.status !== status)) {
    throw new Error("Nieprawidłowe potwierdzenie zmiany zadania.");
  }
  return item;
}
