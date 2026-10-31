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
