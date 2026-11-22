"use strict";

/**
 * Pure, offline task transition helper for synthetic investment fixtures.
 * Never accepts production organization identifiers or performs I/O.
 */
const STATUSES = Object.freeze(["todo", "in_progress", "blocked", "done"]);
const TRANSITIONS = Object.freeze({
  todo: ["in_progress", "blocked"],
  in_progress: ["blocked", "done"],
  blocked: ["in_progress"],
  done: []
});
function assertTenant(organizationId) {
  if (typeof organizationId !== "string" || !/^tenant-demo-[a-z0-9-]+$/.test(organizationId)) {
    throw new Error("synthetic tenant required");
  }
}
function transitionInvestmentTask(tasks, { organizationId, taskId, toStatus, expectedStatus }) {
  assertTenant(organizationId);
  if (!Array.isArray(tasks)) throw new TypeError("tasks must be an array");
  if (typeof taskId !== "string" || !STATUSES.includes(toStatus) || !STATUSES.includes(expectedStatus)) {
    throw new Error("invalid transition request");
  }
  const task = tasks.find((item) => item.id === taskId && item.organizationId === organizationId && item.synthetic === true);
  if (!task) throw new Error("task not found");
  if (task.status !== expectedStatus) throw new Error("stale task status");
  if (!TRANSITIONS[expectedStatus].includes(toStatus)) throw new Error("transition not allowed");
  return tasks.map((item) => item === task ? { ...item, status: toStatus } : item);
}
module.exports = { transitionInvestmentTask };
