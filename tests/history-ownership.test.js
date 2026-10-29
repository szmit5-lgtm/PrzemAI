"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const calls = [];
let historyRecord = null;

const prisma = {
  history: {
    async findMany(args) {
      calls.push({ method: "findMany", args });
      return [];
    },
    async findFirst(args) {
      calls.push({ method: "findFirst", args });
      return historyRecord;
    },
    async delete(args) {
      calls.push({ method: "delete", args });
      return { id: args.where.id };
    }
  }
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (
    request === "../../lib/prisma" &&
    parent?.filename?.replaceAll("\\", "/").endsWith("/api/services/HistoryService.js")
  ) {
    return prisma;
  }
  return originalLoad.call(this, request, parent, isMain);
};

let HistoryService;
try {
  HistoryService = require("../api/services/HistoryService");
} finally {
  Module._load = originalLoad;
}

function reset() {
  calls.length = 0;
  historyRecord = null;
}

test("history listing is restricted to the signed-in user and omits report bodies", async () => {
  reset();
  await HistoryService.list("owner-a");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "findMany");
  assert.deepEqual(calls[0].args.where, { userId: "owner-a" });
  assert.equal(calls[0].args.select.report, undefined);
  assert.equal(calls[0].args.orderBy.createdAt, "desc");
});

test("history detail lookup requires both record ID and authenticated owner", async () => {
  reset();
  await HistoryService.get("report-a", "owner-a");

  assert.deepEqual(calls, [{
    method: "findFirst",
    args: { where: { id: "report-a", userId: "owner-a" } }
  }]);
});

test("history deletion rejects missing or unowned records without a delete write", async () => {
  reset();
  await assert.rejects(
    HistoryService.remove("report-b", "owner-b"),
    /Analiza nie istnieje/
  );

  assert.deepEqual(calls, [{
    method: "findFirst",
    args: { where: { id: "report-b", userId: "owner-b" } }
  }]);
});

test("history deletion checks ownership before deleting an existing record", async () => {
  reset();
  historyRecord = { id: "report-c", userId: "owner-c" };

  const result = await HistoryService.remove("report-c", "owner-c");

  assert.equal(result.id, "report-c");
  assert.deepEqual(calls, [
    {
      method: "findFirst",
      args: { where: { id: "report-c", userId: "owner-c" } }
    },
    {
      method: "delete",
      args: { where: { id: "report-c" } }
    }
  ]);
});
