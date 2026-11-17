"use strict";

// ClickUp adapter is intentionally not wired into production routes.
// Inject fetch for deterministic offline tests; token must stay server-side.
const BASE = "https://api.clickup.com/api/v2";
function createClickUpKaldevaClient({ token, listId, fetchImpl = globalThis.fetch }) {
  if (typeof token !== "string" || !token.trim()) throw new Error("CLICKUP_API_TOKEN is required");
  if (typeof listId !== "string" || !/^\\d+$/.test(listId)) throw new Error("Invalid CLICKUP_KALDEVA_LIST_ID");
  if (typeof fetchImpl !== "function") throw new Error("fetch unavailable");
  async function request(path, options = {}) {
    const response = await fetchImpl(BASE + path, {
      ...options,
      headers: { Authorization: token, "Content-Type": "application/json" }
    });
    if (!response.ok) throw new Error("ClickUp API request failed: HTTP " + response.status);
    return response.json();
  }
  return {
    async checkList() {
      const data = await request("/list/" + listId);
      if (String(data.id) !== listId) throw new Error("ClickUp list mismatch");
      return { id: String(data.id), name: data.name };
    },
    async listTasks({ maxPages = 3 } = {}) {
      if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 10) throw new Error("Invalid page limit");
      const tasks = [];
      let complete = false;
      for (let page = 0; page < maxPages; page++) {
        const data = await request("/list/" + listId + "/task?page=" + page + "&include_closed=true");
        if (!data || !Array.isArray(data.tasks)) throw new Error("Malformed ClickUp response");
        for (const task of data.tasks) {
          if (!task || (typeof task.id !== "string" && typeof task.id !== "number") || !String(task.id).trim() || typeof task.name !== "string" || !task.name.trim() || (task.status != null && (typeof task.status !== "object" || typeof task.status.status !== "string"))) {
            throw new Error("Malformed ClickUp task");
          }
          tasks.push({ id: String(task.id), name: task.name, status: task.status?.status ?? null });
        }
        if (data.last_page === true || data.tasks.length === 0) {
          complete = true;
          break;
        }
      }
      if (!complete) throw new Error("ClickUp pagination limit reached; refusing partial lead list");
      return tasks;
    }
  };
}
module.exports = { createClickUpKaldevaClient };
