"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { OrganizationInvestmentService } = require("../api/services/OrganizationInvestmentService");
const { OrganizationInvestmentFinanceService } = require("../api/services/OrganizationInvestmentFinanceService");
const { investmentContext } = require("../api/services/InvestmentContextService");

const investments = [
  { id: "mielno", organizationId: "company", name: "Mielno", assignedUserIds: ["leszek"], progress: 0 },
  { id: "zgorzelec", organizationId: "company", name: "Zgorzelec", assignedUserIds: [], progress: 75 }
];

test("Leszek's investment panel is limited to Mielno, including on direct requests", async () => {
  const reads = [];
  const db = {
    organizationInvestment: {
      async findFirst({ where, select }) {
        assert.equal(select.assignedUserIds, undefined);
        return investments.find(row => row.id === where.id && row.organizationId === where.organizationId &&
          row.assignedUserIds.includes(where.assignedUserIds.has));
      }
    },
    organizationDocument: {
      async findMany({ where }) {
        reads.push(where);
        return [{ id: "doc" }, { id: "report", isInvestmentReport: true }];
      }
    },
    task: { async findMany({ where }) { reads.push(where); return [{ id: "task" }]; } }
  };
  const service = new OrganizationInvestmentService({ db, orgService: { async membership() { return { role: "MEMBER" }; } } });
  await assert.rejects(service.panel("leszek", "company", "zgorzelec"), { status: 404 });
  await assert.rejects(service.panel("leszek", "other-company", "mielno"), { status: 404 });
  assert.equal(reads.length, 0);
  const panel = await service.panel("leszek", "company", "mielno");
  assert.equal(panel.investment.progress, 0);
  assert.deepEqual(panel.documents.map(row => row.id), ["doc"]);
  assert.deepEqual(panel.reports.map(row => row.id), ["report"]);
  assert.deepEqual(panel.tasks.map(row => row.id), ["task"]);
  assert.ok(reads.every(where => where.investmentId === "mielno"));
  await assert.rejects(service.attach("leszek", "company", "mielno", { kind: "task", recordId: "task" }), { status: 403 });
  investments[0].assignedUserIds = [];
  try { await assert.rejects(service.panel("leszek", "company", "mielno"), { status: 404 }); }
  finally { investments[0].assignedUserIds = ["leszek"]; }
});

test("financial totals and documents use only the exact matching project and the company KSeF account", async () => {
  const nip = "1111111111";
  const finance = {
    async accessible(userId) {
      assert.equal(userId, "leszek");
      return { ownerUserId: "owner", nip };
    },
    async projects() { return { items: investments.map(item => ({ id: "legacy-" + item.id, name: item.name })) }; }
  };
  const db = {
    organizationInvestment: { async findMany() { return investments; } },
    financialDocument: {
      async findMany({ where, select }) {
        assert.equal(where.userId, "owner");
        assert.equal(where.source, "KSEF");
        assert.deepEqual(where.AND[0].OR, [
          { projectId: "legacy-mielno" },
          { correctionLink: { organizationId: "company", invoice: { projectId: "legacy-mielno" } } }
        ]);
        assert.equal(where.issueDate.gte.toISOString(), "2026-01-01T00:00:00.000Z");
        assert.equal(select.rawData, undefined);
        return [{
          id: "invoice", invoiceNumber: "FV-1", projectId: where.AND[0].OR[0].projectId, issueDate: new Date("2026-04-01"),
          buyerNip: nip, sellerNip: "2222222222", direction: "INCOMING",
          currency: "PLN", grossAmount: "123.45", netAmount: "100.37", vatAmount: "23.08"
        }];
      }
    }
  };
  const service = new OrganizationInvestmentFinanceService({ db, finance });
  const result = await service.forInvestment("leszek", "company", investments[0], 2026);
  assert.equal(result.mapping, "EXACT_NAME");
  assert.equal(result.invoices[0].invoiceNumber, "FV-1");
  assert.equal(result.invoices[0].buyerNip, undefined);
  assert.equal(result.invoices[0].netAmount, "100.37");
  assert.equal(result.invoices[0].vatAmount, "23.08");
  assert.equal(result.profitability[0].netResult, "-100.37");
  assert.equal(result.totals[0].gross, "123.45");
  assert.equal(result.months[0].month, 4);
});

test("agent context queries active organizations and enforces staff assignments before selecting a project", async () => {
  const db = { organizationInvestment: { async findMany({ where }) {
    assert.equal(where.organization.status, "ACTIVE");
    assert.deepEqual(where.OR[0], { assignedUserIds: { has: "leszek" } });
    assert.deepEqual(where.OR[1].organization.memberships.some, {
      userId: "leszek", status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] }
    });
    return [investments[0]];
  } } };
  const context = await investmentContext({ userId: "leszek", instruction: "Mielno i Zgorzelec", db });
  assert.match(context, /Mielno/);
  assert.doesNotMatch(context, /Zgorzelec/);
});
