"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const taskSource = fs.readFileSync(path.join(__dirname, "../api/services/TaskService.js"), "utf8");
const controllerSource = fs.readFileSync(path.join(__dirname, "../api/controllers/DocumentController.js"), "utf8");

function taskHarness() {
  const calls = [];
  const prisma = { task: {
    async create(payload) { calls.push({ operation: "create", payload }); return payload.data; },
    async update(payload) { calls.push({ operation: "update", payload }); return payload.data; }
  } };
  const context = { module: { exports: {} }, Date, require: name => {
    assert.equal(name, "../../lib/prisma");
    return prisma;
  } };
  vm.runInNewContext(taskSource, context, { filename: "TaskService.js" });
  return { service: context.module.exports, calls };
}

test("document AI date-only dueDate becomes valid Prisma DateTime", async () => {
  const { service, calls } = taskHarness();
  const created = await service.create({
    title: "Sprawdzić akta rejestrowe BERGEOS sp. z o.o.",
    dueDate: "2026-11-23", priority: "MEDIUM", userId: "owner-1"
  });
  assert.ok(created.dueDate instanceof Date);
  assert.equal(created.dueDate.toISOString(), "2026-11-23T12:00:00.000Z");
  assert.equal(calls[0].payload.data.userId, "owner-1");
  assert.equal(calls[0].payload.data.status, "TODO");
});

test("task create and update accept strict ISO timestamps, clear and absent dates", async () => {
  const { service, calls } = taskHarness();
  const iso = await service.create({ title: "T", dueDate: "2026-11-23T10:30:00+01:00", userId: "u" });
  assert.equal(iso.dueDate.toISOString(), "2026-11-23T09:30:00.000Z");
  const blank = await service.create({ title: "T", dueDate: "", userId: "u" });
  assert.equal(blank.dueDate, null);
  const updated = await service.update("task", "owner-1", { dueDate: "2026-11-23" });
  assert.equal(updated.dueDate.toISOString(), "2026-11-23T12:00:00.000Z");
  assert.equal(calls[2].payload.where.userId, "owner-1");
  assert.equal(calls[2].payload.where.source.not, "COMPANY");
  const changed = await service.update("task", "owner-1", { priority: "HIGH" });
  assert.equal(Object.hasOwn(changed, "dueDate"), false);
  const cleared = await service.update("task", "owner-1", { dueDate: "" });
  assert.equal(cleared.dueDate, null);
});

test("invalid task dates fail clearly before querying Prisma", async () => {
  const { service, calls } = taskHarness();
  for (const dueDate of ["2026-02-31", "2026-11-00", "jutro", "23/11/2026", 12345, "2026-11-23T19:00:00"]) {
    await assert.rejects(service.create({ title: "T", userId: "u", dueDate }),
      error => error.code === "INVALID_TASK_DUE_DATE" && /Nieprawidłowy termin/.test(error.message));
    await assert.rejects(service.update("id", "u", { dueDate }),
      error => error.code === "INVALID_TASK_DUE_DATE");
  }
  assert.equal(calls.length, 0);
});

function documentHarness({ failTitle } = {}) {
  const calls = { saved: [], tasks: [], deleted: [], errors: [] };
  const report = { summary: "Raport zapisany", actionItems: [
    { title: "Prawidłowe zadanie", dueDate: "2026-11-23" },
    { title: "Drugie zadanie", dueDate: null }
  ] };
  const dependencies = {
    "node:fs/promises": { unlink: async file => { calls.deleted.push(file); } },
    "../services/HistoryService": { create: async payload => { calls.saved.push(payload); } },
    "../services/DocumentService": { analyze: async () => report },
    "../services/TaskService": { create: async payload => {
      calls.tasks.push(payload);
      if (payload.title === failTitle) throw new Error("Prisma internal error (not for user)");
    } }
  };
  const context = {
    module: { exports: {} },
    console: { error: (...args) => calls.errors.push(args) },
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), "unexpected dependency " + name);
      return dependencies[name];
    }
  };
  vm.runInNewContext(controllerSource, context, { filename: "DocumentController.js" });
  const controller = new context.module.exports();
  const req = { file: { path: "/tmp/document.pdf", originalname: "dokument.pdf", filename: "random.pdf" }, user: { id: "user-1" } };
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  return { controller, req, res, calls };
}

test("successful document analysis survives one failed task; no Prisma detail leaks", async () => {
  const { controller, req, res, calls } = documentHarness({ failTitle: "Drugie zadanie" });
  await controller.analyze(req, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.report.summary, "Raport zapisany");
  assert.equal(res.body.taskCreation.created, 1);
  assert.equal(res.body.taskCreation.failed, 1);
  assert.match(res.body.warning, /nie wszystkie zadania/);
  assert.doesNotMatch(JSON.stringify(res.body), /Prisma internal error/);
  assert.equal(calls.saved.length, 1);
  assert.equal(calls.saved[0].userId, "user-1");
  assert.equal(calls.tasks.length, 2);
  assert.deepEqual(calls.deleted, ["/tmp/document.pdf"]);
});

test("document analysis reports created tasks without warning when all save", async () => {
  const { controller, req, res, calls } = documentHarness();
  await controller.analyze(req, res);
  assert.equal(res.body.success, true);
  assert.equal(res.body.taskCreation.created, 2);
  assert.equal(res.body.taskCreation.failed, 0);
  assert.equal(res.body.warning, undefined);
  assert.equal(calls.tasks[0].userId, "user-1");
});
