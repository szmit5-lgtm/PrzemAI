"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const writes = [];
const fakePrisma = {
  task: {
    async update(args) {
      writes.push({ operation: "update", ...args });
      return { id: args.where.id, ...args.data };
    },
    async delete(args) {
      writes.push({ operation: "delete", ...args });
      return { id: args.where.id };
    },
    async findFirst() {
      throw new Error("Ownership must be checked in the write predicate");
    }
  }
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "../../lib/prisma" &&
      parent?.filename?.replaceAll("\\", "/").endsWith("/api/services/TaskService.js")) {
    return fakePrisma;
  }
  return originalLoad.call(this, request, parent, isMain);
};
let TaskService;
try {
  TaskService = require("../api/services/TaskService");
} finally {
  Module._load = originalLoad;
}

test("task update scopes database write to authenticated owner", async () => {
  writes.length = 0;
  const result = await TaskService.update("task-1", "owner-1", {
    title: "Updated", priority: "HIGH", dueDate: ""
  });
  assert.equal(result.title, "Updated");
  assert.deepEqual(writes[0].where, { id: "task-1", userId: "owner-1" });
  assert.deepEqual(writes[0].data, {
    title: "Updated", priority: "HIGH", dueDate: null
  });
});

test("task update rejects reassignment and protected fields before any write", async () => {
  for (const data of [
    { title: "test", userId: "victim-user" },
    { id: "different-task" },
    { source: "SYSTEM" },
    { user: { connect: { id: "victim-user" } } },
    { createdAt: "2020-01-01T00:00:00Z" },
    {},
    null,
    []
  ]) {
    writes.length = 0;
    await assert.rejects(
      TaskService.update("task-1", "owner-1", data),
      /Niedozwolone|Brak danych|Nieprawidłowe/
    );
    assert.equal(writes.length, 0);
  }
});

test("task delete uses owner-scoped atomic predicate", async () => {
  writes.length = 0;
  await TaskService.remove("task-2", "owner-2");
  assert.deepEqual(writes[0], {
    operation: "delete", where: { id: "task-2", userId: "owner-2" }
  });
});

test("task completion still updates status and completion timestamp", async () => {
  writes.length = 0;
  const completedAt = new Date();
  await TaskService.complete("task-3", "owner-3");
  // Complete delegates to update with a timestamp created internally.
  assert.deepEqual(writes[0].where, { id: "task-3", userId: "owner-3" });
  assert.equal(writes[0].data.status, "DONE");
  assert.ok(writes[0].data.completedAt instanceof Date);
});
