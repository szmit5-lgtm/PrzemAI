"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");

global.prisma = {};
const GeneralAgentService = require("../api/services/GeneralAgentService");
const GeneralAgentSources = require("../api/services/GeneralAgentSources");
const { redactText } = require("../lib/aiContext");

function fixtures() {
  const tasks = [];
  let id = 0;
  const agents = ["document", "investment", "financial"];
  const db = {
    agent: {
      findMany: async () => agents.map(key => ({ key })),
      findFirst: async ({ where }) =>
        where.userId === "user" && where.enabled && agents.includes(where.key) ? { id: where.key } : null,
      updateMany: async () => assert.fail("General Agent must not schedule live integrations")
    },
    task: {
      findMany: async ({ where, take }) => tasks.filter(task =>
        task.userId === where.userId && task.source === where.source &&
        where.AND.every(({ metadata }) => task.metadata[metadata.path[0]] === metadata.equals)
      ).reverse().slice(0, take).map(task => structuredClone(task)),
      create: async ({ data }) => {
        const task = { ...data, id: String(++id) };
        tasks.push(task);
        return task;
      },
      updateMany: async ({ where, data }) => {
        const row = tasks.find(task => task.id === where.id && task.userId === where.userId &&
          task.source === where.source && task.status === where.status &&
          (!where.startedAt || +task.startedAt === +where.startedAt));
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }
    },
    $transaction: callback => callback(db)
  };
  return { db, tasks };
}

test("delegates to three scoped specialists, saves results and continues through a local OpenAI mock", async t => {
  const requests = [];
  const server = createServer(async (req, res) => {
    assert.equal(req.url, "/v1/responses");
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const { input } = JSON.parse(Buffer.concat(chunks).toString());
    requests.push(JSON.parse(input[1].content[0].text));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      object: "response",
      output: [{ type: "message", content: [{ type: "output_text", text: "Wynik z mocka" }] }]
    }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const oldKey = process.env.OPENAI_API_KEY;
  const oldUrl = process.env.OPENAI_BASE_URL;
  process.env.OPENAI_API_KEY = "local-mock-only";
  process.env.OPENAI_BASE_URL = "http://127.0.0.1:" + server.address().port + "/v1";
  t.after(() => {
    for (const [key, value] of Object.entries({ OPENAI_API_KEY: oldKey, OPENAI_BASE_URL: oldUrl })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const { db, tasks } = fixtures();
  let financeAccess = true;
  const sources = {
    authorize: async scope => scope.userId === "user" && scope.organizationId === "company-a" &&
      (scope.agentKey !== "financial" || financeAccess),
    load: async ({ agentKey }) => ({ records: [{ specialist: agentKey }] })
  };
  const general = new GeneralAgentService({ db, sources });
  const scope = { userId: "user", organizationId: "company-a", conversationId: "chat-a" };
  const first = await general.handleTurn({
    ...scope, turnId: "turn-a",
    message: "Porównaj faktury, dokumenty i inwestycje. OPENAI_API_KEY=sk-fakekey12345"
  });
  assert.equal(first.planId, "turn-a");
  assert.equal(requests.length, 3);
  assert.equal(tasks.length, 3);
  assert.ok(tasks.every(task => task.status === "DONE" && task.metadata.resultStatus === "DRAFT_READY"));
  assert.doesNotMatch(JSON.stringify(requests), /sk-fakekey12345/);
  assert.match(first.answer, /Financial Agent — gotowe/);
  assert.match(first.answer, /Document Agent — gotowe/);
  assert.match(first.answer, /Investment Agent — gotowe/);

  const next = await general.handleTurn({ ...scope, turnId: "turn-b", message: "A jakie ryzyka?" });
  assert.equal(next.planId, "turn-b");
  assert.equal(requests.length, 6);
  assert.ok(requests.slice(3).every(request => request.previousResult === "Wynik z mocka"));
  assert.ok(tasks.slice(3).every(task => task.metadata.parentPlanId === "turn-a"));

  financeAccess = false;
  const status = await general.handleTurn({ ...scope, turnId: "turn-c", message: "Wyniki" });
  assert.match(status.answer, /Financial Agent — brak dostępu/);
  assert.equal((status.answer.match(/Wynik z mocka/g) || []).length, 2);
  assert.equal(requests.length, 6);
  for (const other of [{ userId: "other" }, { organizationId: "company-b" }, { conversationId: "chat-b" }]) {
    const result = await general.readPlan({ ...scope, ...other }, "turn-a");
    assert.doesNotMatch(result.answer, /Wynik z mocka/);
  }
});

test("saved sources enforce company membership and project only content fields", async () => {
  const historyQueries = [];
  const db = {
    organizationMembership: { findFirst: async ({ where }) =>
      where.organizationId === "allowed" && where.role?.in.includes("MEMBER")
        ? { role: "MEMBER", userId: where.userId, organizationId: where.organizationId }
        : null
    },
    organizationInvestment: { findMany: async ({ where }) => {
      assert.deepEqual(where, { organizationId: "allowed" });
      return [{ name: "Inwestycja", status: "ACTIVE", progress: 10,
        description: "Authorization: Bearer privateToken", assignedUserIds: ["hidden-id"] }];
    } },
    history: { findMany: async query => {
      historyQueries.push(query);
      return [{ title: "Umowa", report: { summary: "Kluczowe terminy", token: "hidden-token" } }];
    } }
  };
  const sources = new GeneralAgentSources(db);
  const scope = { userId: "user", organizationId: "allowed" };
  assert.equal(await sources.load({ ...scope, agentKey: "document" }, ""), null);
  assert.equal(await sources.load({ ...scope, organizationId: "denied", agentKey: "investment" }, ""), null);
  const saved = await sources.load({ ...scope, agentKey: "investment" }, "");
  assert.doesNotMatch(JSON.stringify(saved), /privateToken|hidden-id/);
  const personal = await sources.load({ userId: "user", agentKey: "document" }, "Umowa");
  assert.deepEqual(historyQueries[0].where, { userId: "user", type: "document" });
  assert.deepEqual(personal.documents[0].analysis, { summary: "Kluczowe terminy" });
  assert.doesNotMatch(redactText("postgresql://admin:private@db/x\npassword: \"another secret\""), /private|another secret/);
});

test("parallel reads of a queued plan claim the assignment only once", async () => {
  const { db, tasks } = fixtures();
  tasks.push({ id: "one", userId: "user", source: "GENERAL_AGENT", status: "TODO",
    description: "Przeanalizuj umowę", metadata: {
      planId: "plan", conversationId: "chat", organizationId: "", agentKey: "document"
    } });
  let calls = 0;
  const service = new GeneralAgentService({
    db, sources: { authorize: async () => true, load: async () => ({ documents: ["Umowa"] }) },
    ai: { ask: async () => { calls++; return "Raport"; } }
  });
  const scope = { userId: "user", conversationId: "chat" };
  await Promise.all([service.readPlan(scope, "plan", { resume: true }),
    service.readPlan(scope, "plan", { resume: true })]);
  assert.equal(calls, 1);
  assert.match((await service.readPlan(scope, "plan")).answer, /Raport/);
});
