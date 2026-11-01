// Validate the memory API contract before rendering or confirming mutations.
function isMemory(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    typeof value.id === "string" && value.id.trim().length > 0 &&
    typeof value.type === "string" && value.type.trim().length > 0 &&
    typeof value.title === "string" && value.title.trim().length > 0 &&
    typeof value.content === "string" && value.content.trim().length > 0;
}

export function parseMemoryListResponse(response) {
  const memories = response?.memories;
  if (response?.success !== true || !Array.isArray(memories) ||
      !memories.every(isMemory) ||
      new Set(memories.map(memory => memory.id)).size !== memories.length) {
    throw new Error("Nieprawidłowy format danych pamięci AI.");
  }
  return memories;
}

export function parseMemoryMutationResponse(response, expectedId = null, requireArchive = false) {
  const memory = response?.memory;
  if (response?.success !== true || !isMemory(memory) ||
      (expectedId !== null && memory.id !== expectedId) ||
      (requireArchive && (typeof memory.archivedAt !== "string" ||
        !Number.isFinite(Date.parse(memory.archivedAt))))) {
    throw new Error("Brak potwierdzenia zmiany pamięci AI.");
  }
  return memory;
}
