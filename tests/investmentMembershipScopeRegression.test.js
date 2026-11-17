"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const calls = [];
const fakePrisma = {
  organizationMembership: {
    async findMany(options) {
      calls.push({ method: "membership", options });
      return [{ organizationId: "dek-org" }, { organizationId: "deh-org" }];
    }
  },
  project: {
    async findMany(options) {
      calls.push({ method: "projects", options });
      return [];
    }
  }
};

const originalLoad = Module._load;
let FinanceService;
try {
  Module._load = function (request, parent, isMain) {
    if (request === "../../lib/prisma" &&
        parent?.filename?.replace(/\\/g, "/").endsWith("/api/services/FinanceService.js")) {
      return fakePrisma;
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  FinanceService = require("../api/services/FinanceService");
} finally {
  Module._load = originalLoad;
}

test("investment list limits shared projects to active memberships and legacy owner", async () => {
  calls.length = 0;
  const projects = await new FinanceService().listProjects("synthetic-user");
  assert.deepEqual(projects, []);
  assert.deepEqual(calls[0], {
    method: "membership",
    options: {
      where: {
        userId: "synthetic-user",
        status: "ACTIVE",
        organization: { status: "ACTIVE" }
      },
      select: { organizationId: true }
    }
  });
  assert.deepEqual(calls[1], {
    method: "projects",
    options: {
      where: {
        status: "ACTIVE",
        OR: [
          { userId: "synthetic-user", organizationId: null },
          { organizationId: { in: ["dek-org", "deh-org"] } }
        ]
      },
      select: {
        id: true, name: true, aliases: true, company: true, organizationId: true
      },
      orderBy: { name: "asc" },
      take: 300
    }
  });
  assert.equal(calls.some(call => JSON.stringify(call).includes("foreign-org")), false);
});
