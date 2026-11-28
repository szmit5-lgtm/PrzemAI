"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { OrganizationSettlementService } = require("../api/services/OrganizationSettlementService");

const asOf = new Date("2026-11-27T12:00:00.000Z");
const periodEnd = new Date("2026-11-22T12:00:00.000Z");
const totals = new Map([["PLN", { monthReceivable: 1500n, monthPayable: 2500n }]]);

function account(id, accountType, closingBalance, currency = "PLN") {
  return { id, currency, accountType, statements: closingBalance == null ? [] : [{ closingBalance, periodEnd }] };
}

function service(accounts, activity = {}) {
  const queries = [];
  const db = {
    bankAccount: {
      async findMany({ where, select }) {
        assert.deepEqual(where, { organizationId: "company" });
        assert.equal(select.accountType, true);
        assert.deepEqual(select.statements.where.periodEnd, { lte: asOf });
        assert.equal(select.statements.where.organizationId, "company");
        return accounts;
      }
    },
    bankTransaction: {
      async aggregate({ where }) {
        assert.equal(where.organizationId, "company");
        assert.deepEqual(where.bookedAt, { gt: new Date("2026-11-22T23:59:59.999Z"), lte: asOf });
        queries.push(where.bankAccountId);
        return { _sum: { amount: activity[where.bankAccountId] ?? null } };
      }
    }
  };
  return { forecasts: new OrganizationSettlementService({ db }).forecast("company", asOf, totals), queries };
}

test("month-end operating cash excludes VAT and non-current balances", async () => {
  const { forecasts, queries } = service([
    account("current", "CURRENT", "100.00"),
    account("vat", "VAT", "70.00"),
    account("other", "OTHER", "200.00"),
    account("eur", "CURRENT", "40.00", "EUR")
  ], { current: "-30.00", vat: "5.00" });
  const [pln, eur] = await forecasts;
  assert.deepEqual(queries, ["current", "vat", "other", "eur"]);
  assert.equal(pln.balanceFromImports, "345.00");
  assert.equal(pln.operatingBalanceFromImports, "70.00");
  assert.equal(pln.vatBalanceFromImports, "75.00");
  assert.equal(pln.projectedMonthEnd, "60.00");
  assert.deepEqual(pln.operatingClosings, ["2026-11-22"]);
  assert.equal(eur.projectedMonthEnd, "40.00");
});

test("missing VAT balances do not suppress a fully anchored operational forecast", async () => {
  const { forecasts, queries } = service([account("current", "CURRENT", "25.00"), account("vat", "VAT", null)]);
  const [pln] = await forecasts;
  assert.deepEqual(queries, ["current"]);
  assert.equal(pln.balanceFromImports, null);
  assert.equal(pln.vatBalanceFromImports, null);
  assert.equal(pln.projectedMonthEnd, "15.00");
});

test("VAT funds cannot stand in for missing current-account balances", async () => {
  for (const accounts of [
    [account("vat", "VAT", "100.00")],
    [account("current", "CURRENT", "50.00"), account("unknown-current", "CURRENT", null), account("vat", "VAT", "30.00")]
  ]) {
    const [pln] = await service(accounts).forecasts;
    assert.equal(pln.operatingBalanceFromImports, null);
    assert.equal(pln.projectedMonthEnd, null);
    assert.notEqual(pln.vatBalanceFromImports, null);
  }
});
