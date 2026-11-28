import test from "node:test";
import assert from "node:assert/strict";
import { taskScheduleFilter } from "../src/lib/taskSchedule.mjs";

test("task filters follow the Warsaw calendar and omit finished work", () => {
  const current = new Date("2026-12-31T23:30:00Z");
  const rows = [
    { id: "late", status: "TODO", dueDate: "2026-12-31T12:00:00.000Z" },
    { id: "finished", status: "DONE", dueDate: "2026-12-31T12:00:00.000Z" },
    { id: "today", status: "IN_PROGRESS", dueDate: "2027-01-01T12:00:00.000Z" },
    { id: "week", status: "TODO", dueDate: "2027-01-08T12:00:00.000Z" },
    { id: "later", status: "TODO", dueDate: "2027-01-09T12:00:00.000Z" },
    { id: "no-date", status: "TODO", dueDate: null }
  ];
  assert.deepEqual(taskScheduleFilter(rows, "OVERDUE", current).map(row => row.id), ["late"]);
  assert.deepEqual(taskScheduleFilter(rows, "UPCOMING", current).map(row => row.id), ["today", "week"]);
});
