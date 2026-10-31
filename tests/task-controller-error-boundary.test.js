"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const operations = ["list", "get", "create", "update", "complete", "remove"];
const sensitiveError = new Error("private postgres hostname and password");
const service = Object.fromEntries(
  operations.map((operation) => [
    operation,
    async () => { throw sensitiveError; }
  ])
);

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const source = parent?.filename?.replaceAll("\\", "/") || "";
  if (source.endsWith("/api/controllers/TaskController.js") &&
      request === "../services/TaskService") {
    return service;
  }
  return originalLoad.call(this, request, parent, isMain);
};

let TaskController;
try {
  TaskController = require("../api/controllers/TaskController");
} finally {
  Module._load = originalLoad;
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("all task endpoints hide service and database error details", async () => {
  const controller = new TaskController();
  const req = {
    user: { id: "user-1" },
    params: { id: "task-1" },
    body: { title: "Example task" }
  };

  for (const operation of operations) {
    const res = response();
    await controller[operation](req, res);
    assert.equal(res.statusCode, 500, operation);
    assert.deepEqual(res.body, {
      success: false,
      error: "Nie udało się wykonać operacji na zadaniu."
    }, operation);
    assert.doesNotMatch(JSON.stringify(res.body), /postgres|hostname|password|private/i);
  }
});
