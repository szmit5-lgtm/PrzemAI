"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

let messages = [];
let authorized = true;
let duplicate = false;
let inserted = [];
let syncUpdates = [];
let fetchCount = 0;

const integration = {
  id: "integration-test",
  userId: "owner-test",
  name: "Test mailbox",
  type: "MAIL",
  provider: "HOME_PL",
  config: { email: "test@example.invalid" }
};

const prisma = {
  integration: {
    async findMany() { return [integration]; },
    async update({ where, data }) {
      syncUpdates.push({ where, data });
      return { ...integration, ...data };
    }
  },
  financialDocument: {
    async create({ data }) {
      inserted.push(data);
      if (duplicate) {
        const error = new Error("duplicate");
        error.code = "P2002";
        throw error;
      }
      return { id: "new-document", ...data };
    }
  }
};

class FakeConnector {
  async fetchRecentMessages(limit) {
    assert.equal(limit, 30);
    fetchCount += 1;
    return messages;
  }
}

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const source = parent?.filename?.replaceAll("\\\\", "/") || "";
  if (source.endsWith("/agents/financial/FinancialAgent.js")) {
    if (request === "../../lib/prisma") return prisma;
    if (request === "../../connectors/mail/HomePlMailConnector") return FakeConnector;
    if (request === "../../lib/mailAccessPolicy") {
      return { canSyncMailIntegration: () => authorized };
    }
  }
  return originalLoad.call(this, request, parent, isMain);
};

let FinancialAgent;
try {
  FinancialAgent = require("../agents/financial/FinancialAgent");
} finally {
  Module._load = originalLoad;
}

function reset() {
  messages = [];
  authorized = true;
  duplicate = false;
  inserted = [];
  syncUpdates = [];
  fetchCount = 0;
}

function message(date, attachments) {
  return {
    uid: 7,
    uidValidity: "5",
    messageId: "<mail-7@example.invalid>",
    date,
    subject: "Faktury",
    from: "supplier@example.invalid",
    attachments
  };
}

test("mail import stores receivedAt, never guesses invoice issueDate", async () => {
  reset();
  messages = [message("2026-10-27T10:30:00+01:00", [
    { filename: "invoice.pdf", contentType: "application/pdf", size: 12 },
    { filename: "invoice.xml", contentType: "application/xml", size: 22 },
    { filename: "logo.png", contentType: "image/png", size: 2 }
  ])];

  const result = await new FinancialAgent().run({ userId: "owner-test" });
  assert.equal(result.metadata.newDocuments, 2);
  assert.equal(inserted.length, 2);
  assert.equal(fetchCount, 1);
  assert.equal(syncUpdates.length, 1);
  for (const document of inserted) {
    assert.equal(document.issueDate, null);
    assert.equal(document.rawData.receivedAt, "2026-10-27T09:30:00.000Z");
    assert.equal(document.status, "NEW");
    assert.equal(document.userId, "owner-test");
    assert.equal(Object.hasOwn(document.rawData, "content"), false);
  }
  assert.notEqual(inserted[0].externalId, inserted[1].externalId);
});

test("invalid mail timestamp does not prevent import or become invoice date", async () => {
  reset();
  messages = [message("not-a-date", [
    { filename: "invoice.pdf", contentType: "application/pdf", size: 12 }
  ])];
  duplicate = true;

  const result = await new FinancialAgent().run({ userId: "owner-test" });
  assert.equal(result.metadata.newDocuments, 0);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].issueDate, null);
  assert.equal(inserted[0].rawData.receivedAt, null);
  assert.equal(syncUpdates.length, 1);
});

test("unauthorized shared mailbox is not fetched or marked synchronized", async () => {
  reset();
  authorized = false;
  const result = await new FinancialAgent().run({ userId: "owner-test" });
  assert.equal(result.metadata.blockedIntegrations, 1);
  assert.equal(fetchCount, 0);
  assert.equal(inserted.length, 0);
  assert.equal(syncUpdates.length, 0);
});
