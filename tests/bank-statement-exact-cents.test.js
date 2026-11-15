"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const src = fs.readFileSync(path.join(__dirname, "../api/services/BankStatementImportService.js"), "utf8");

function sandbox() {
  const writes = { accounts: [], statements: [], transactions: [] };
  const tx = {
    bankAccount: {
      async upsert({ where, create }) {
        writes.accounts.push({ where, create });
        return { id: "bank-1" };
      }
    },
    bankStatement: {
      async findFirst() { return null; },
      async create({ data }) {
        writes.statements.push(data);
        return { id: "statement-1" };
      }
    },
    bankTransaction: {
      async createMany({ data }) { writes.transactions.push(...data); return { count: data.length }; }
    }
  };
  const prisma = {
    organizationMembership: {
      async findFirst({ where }) {
        if (where.userId !== "owner-a" || where.organizationId !== "dekonica") return null;
        return { id: "owner-member" };
      }
    },
    async $transaction(fn) { return fn(tx); }
  };
  const dependencies = {
    crypto: require("node:crypto"),
    "../../lib/prisma": prisma,
    "./OrganizationFinanceService": {
      OrganizationFinanceService: class {
        async accessible(userId, orgId) {
          if (userId !== "owner-a" || orgId !== "dekonica") throw new Error("Forbidden finance scope");
        }
      }
    },
    "./OrganizationService": {
      OrganizationError: class extends Error { constructor(message,status) { super(message); this.status = status; } }
    }
  };
  const module = { exports: {} };
  vm.runInNewContext(src, {
    module, exports: module.exports,
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw new Error("Unmocked dependency: "+name);
      return dependencies[name];
    }
  }, { filename: "BankStatementImportService.js" });
  return { importStatement: module.exports.importStatement, writes };
}

const base = {
  iban: "61109010140000071219812874",
  statementNumber: "TEST-001",
  openingBalance: "100.00",
  closingBalance: "100.01",
  periodStart: "2026-11-01",
  periodEnd: "2026-11-02",
  transactions: [
    { date: "2026-11-02", amount: "0.01", description: "Test 1 grosz" }
  ]
};

test("statement reconciliation accepts exactly one grosz with unchanged precision", async () => {
  const { importStatement, writes } = sandbox();
  const result = await importStatement("owner-a", "dekonica", base);
  assert.equal(result.closingBalance, "100.01");
  assert.equal(result.transactionCount, 1);
  assert.equal(writes.transactions[0].amount, "0.01");
  assert.equal(writes.statements[0].openingBalance, "100.00");
});

test("statement reconciliation rejects even one grosz difference, without DB writes", async () => {
  const { importStatement, writes } = sandbox();
  await assert.rejects(
    importStatement("owner-a", "dekonica", { ...base, closingBalance: "100.02" }),
    /Saldo początkowe/
  );
  assert.equal(writes.accounts.length, 0);
  assert.equal(writes.transactions.length, 0);
});

test("statement reconciliation retains cents beyond safe JS integer precision", async () => {
  const { importStatement, writes } = sandbox();
  const record = {
    ...base,
    openingBalance: "90071992547409.91",
    closingBalance: "90071992547409.92",
    transactions: [{ date: "2026-11-02", amount: "0.01" }]
  };
  const result = await importStatement("owner-a", "dekonica", record);
  assert.equal(result.closingBalance, "90071992547409.92");
  assert.equal(writes.statements[0].closingBalance, "90071992547409.92");
});

test("out-of-range decimal or excessive precision is rejected before writes", async () => {
  const { importStatement, writes } = sandbox();
  for (const amount of ["12345678901234567.00", "1.001", "Infinity", "1e10"]) {
    await assert.rejects(
      importStatement("owner-a", "dekonica", { ...base, openingBalance: amount }),
      /Nieprawidłowa kwota|zakres bazy/
    );
  }
  assert.equal(writes.statements.length, 0);
});

test("account owner from another tenant cannot import statement", async () => {
  const { importStatement, writes } = sandbox();
  await assert.rejects(importStatement("owner-a", "deherus", base), /Forbidden finance scope/);
  assert.equal(writes.accounts.length, 0);
});
