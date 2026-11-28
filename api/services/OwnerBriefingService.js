"use strict";

const prisma = require("../../lib/prisma");
const { OrganizationError } = require("./OrganizationService");
const { OrganizationSettlementService } = require("./OrganizationSettlementService");
const { toCents } = require("./OrganizationBankMonthlyService");

const companyLimit = 20;
const taskLimit = 8;
const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit"
});
const openInvestmentStatus = ["NOT_SET", "IN_PROGRESS", "ON_HOLD"];

class OwnerBriefingService {
  constructor({ db = prisma, settlements = new OrganizationSettlementService({ db }) } = {}) {
    this.db = db;
    this.settlements = settlements;
  }

  async read(userId, asOf = new Date()) {
    const day = dateFormat.format(asOf);
    const upcoming = new Date(day + "T00:00:00Z");
    upcoming.setUTCDate(upcoming.getUTCDate() + 8);
    const memberships = await this.db.organizationMembership.findMany({
      where: { userId, role: "OWNER", status: "ACTIVE", organization: { status: "ACTIVE" } },
      orderBy: { organizationId: "asc" },
      select: { organization: { select: { id: true, name: true, displayName: true } } },
      take: companyLimit + 1
    });
    const companies = [];
    for (const { organization } of memberships.slice(0, companyLimit)) {
      companies.push(await this.company(userId, organization, asOf, day, upcoming));
    }
    if (!companies.length) return { day, companies, alerts: [], moreCompanies: false };
    const active = await this.db.organizationMembership.findMany({
      where: { userId, role: "OWNER", status: "ACTIVE", organization: { status: "ACTIVE" },
        organizationId: { in: companies.map(company => company.id) } },
      select: { organizationId: true }
    });
    const activeIds = new Set(active.map(member => member.organizationId));
    const visible = companies.filter(company => activeIds.has(company.id));
    return { day, companies: visible.map(({ alerts, ...company }) => company),
      alerts: visible.flatMap(company => company.alerts), moreCompanies: memberships.length > companyLimit };
  }

  async company(userId, organization, asOf, day, upcoming) {
    const organizationId = organization.id;
    const name = organization.displayName || organization.name;
    const base = "/company/" + encodeURIComponent(organizationId);
    const [tasks, investments, finance] = await Promise.all([
      this.db.task.findMany({
        where: {
          source: "COMPANY", status: { notIn: ["DONE", "CANCELLED"] },
          dueDate: { lt: upcoming }, metadata: { path: ["organizationId"], equals: organizationId },
          OR: [{ investmentId: null, investmentScoped: false }, { investment: { organizationId } }]
        },
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        take: taskLimit + 1,
        select: { id: true, title: true, dueDate: true, investmentId: true }
      }),
      this.db.organizationInvestment.groupBy({
        by: ["status"], where: { organizationId, status: { in: openInvestmentStatus } }, _count: { _all: true }
      }),
      this.finance(userId, organizationId, asOf, Number(day.slice(0, 4)))
    ]);
    const dueTasks = tasks.slice(0, taskLimit).map(task => ({
      id: task.id, title: task.title, dueOn: task.dueDate.toISOString().slice(0, 10),
      href: task.investmentId ? base + "/investments/" + encodeURIComponent(task.investmentId) : base
    }));
    const alert = (kind, key, href, details = {}) => ({
      id: JSON.stringify([organizationId, kind, key]), organizationId, company: name, kind, href, ...details
    });
    const alerts = dueTasks.filter(task => task.dueOn < day)
      .map(task => alert("taskOverdue", task.id, task.href, { title: task.title, dueOn: task.dueOn }));
    for (const balance of finance.balances) {
      for (const [kind, amount] of [["overduePayable", balance.overduePayable], ["overdueReceivable", balance.overdueReceivable]]) {
        if (toCents(amount) > 0n) alerts.push(alert(kind, balance.currency, base + "/finance/bank-matches",
          { amount, currency: balance.currency }));
      }
    }
    for (const forecast of finance.forecast) {
      if (forecast.projectedMonthEnd !== null && toCents(forecast.projectedMonthEnd) < 0n) {
        alerts.push(alert("negativeForecast", forecast.currency, base + "/finance/bank-matches",
          { amount: forecast.projectedMonthEnd, currency: forecast.currency }));
      }
    }
    return { id: organizationId, name, href: base, finance, dueTasks, moreTasks: tasks.length > taskLimit,
      investments: Object.fromEntries(investments.map(row => [row.status, row._count._all])), alerts };
  }

  async finance(userId, organizationId, asOf, year) {
    try {
      const { balances, forecast } = await this.settlements.report(userId, organizationId, year, asOf, { includeItems: false });
      return { status: "available", balances, forecast };
    } catch (error) {
      if (!(error instanceof OrganizationError)) {
        console.error("[Owner briefing] Settlement report failed", error?.name, error?.code);
      }
      const status = error instanceof OrganizationError && [403, 404].includes(error.status)
        ? "unavailable" : "error";
      return { status, balances: [], forecast: [] };
    }
  }
}

module.exports = { OwnerBriefingService };
