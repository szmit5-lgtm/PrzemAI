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

const ownerScope = userId => ({
  userId, role: "OWNER", status: "ACTIVE", organization: { status: "ACTIVE" }
});

function reportWindow(asOf) {
  const day = dateFormat.format(asOf);
  const upcoming = new Date(day + "T00:00:00Z");
  upcoming.setUTCDate(upcoming.getUTCDate() + 8);
  return { day, upcoming };
}

class OwnerBriefingService {
  constructor({ db = prisma, settlements = new OrganizationSettlementService({ db }) } = {}) {
    this.db = db;
    this.settlements = settlements;
  }

  async read(userId, asOf = new Date()) {
    const { day, upcoming } = reportWindow(asOf);
    const memberships = await this.db.organizationMembership.findMany({
      where: ownerScope(userId),
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
      where: { ...ownerScope(userId),
        organizationId: { in: companies.map(company => company.id) } },
      select: { organizationId: true }
    });
    const activeIds = new Set(active.map(member => member.organizationId));
    const visible = companies.filter(company => activeIds.has(company.id));
    const alerts = visible.flatMap(company => company.alerts);
    const states = alerts.length ? await this.db.ownerAlertState.findMany({
      where: { userId, alertId: { in: alerts.map(alert => alert.id) } },
      select: { alertId: true, status: true, snoozedUntil: true }
    }) : [];
    const byId = new Map(states.map(state => [state.alertId, state]));
    return { day, companies: visible.map(({ alerts, ...company }) => company),
      alerts: alerts.map(alert => {
        const state = byId.get(alert.id);
        if (!state || (state.status === "SNOOZED" && state.snoozedUntil <= asOf)) return { ...alert, status: "OPEN" };
        return { ...alert, status: state.status, snoozedUntil: state.snoozedUntil };
      }), moreCompanies: memberships.length > companyLimit };
  }

  async setAlert(userId, alertId, status, asOf = new Date()) {
    if (typeof alertId !== "string" || alertId.length > 240 || !["ACKNOWLEDGED", "SNOOZED", "CLOSED", "OPEN"].includes(status))
      throw new OrganizationError("Nieprawidłowa zmiana alertu.", 400);
    let key;
    try { key = JSON.parse(alertId); } catch { throw new OrganizationError("Nieprawidłowy alert.", 400); }
    if (!Array.isArray(key) || typeof key[0] !== "string") throw new OrganizationError("Nieprawidłowy alert.", 400);
    const where = { ...ownerScope(userId), organizationId: key[0] };
    const membership = await this.db.organizationMembership.findFirst({
      where,
      select: { organization: { select: { id: true, name: true, displayName: true } } }
    });
    if (!membership) throw new OrganizationError("Nie znaleziono dostępnego alertu.", 404);
    const { day, upcoming } = reportWindow(asOf);
    const company = await this.company(userId, membership.organization, asOf, day, upcoming);
    if (!company.alerts.some(alert => alert.id === alertId) ||
        !await this.db.organizationMembership.findFirst({ where, select: { id: true } }))
      throw new OrganizationError("Nie znaleziono dostępnego alertu.", 404);

    const snoozedUntil = status === "SNOOZED" ? new Date(asOf.getTime() + 24 * 60 * 60 * 1000) : null;
    if (status === "OPEN") await this.db.ownerAlertState.deleteMany({ where: { userId, alertId } });
    else await this.db.ownerAlertState.upsert({
      where: { userId_alertId: { userId, alertId } },
      create: { userId, alertId, status, snoozedUntil },
      update: { status, snoozedUntil }
    });
    return { alertId, status, snoozedUntil };
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
        select: { id: true, title: true, dueDate: true, priority: true, investmentId: true }
      }),
      this.db.organizationInvestment.groupBy({
        by: ["status"], where: { organizationId, status: { in: openInvestmentStatus } }, _count: { _all: true }
      }),
      this.finance(userId, organizationId, asOf, Number(day.slice(0, 4)))
    ]);
    const dueTasks = tasks.slice(0, taskLimit).map(task => ({
      id: task.id, title: task.title, priority: task.priority, dueOn: task.dueDate.toISOString().slice(0, 10),
      href: task.investmentId ? base + "/investments/" + encodeURIComponent(task.investmentId) : base
    }));
    const alert = (kind, key, href, details = {}) => ({
      id: JSON.stringify([organizationId, kind, key]), organizationId, company: name, kind, href, ...details
    });
    const alerts = dueTasks.flatMap(task => {
      const kind = task.dueOn < day ? "taskOverdue"
        : task.priority === "URGENT" || (task.priority === "HIGH" && task.dueOn === day) ? "urgentTask" : null;
      return kind ? [alert(kind, [task.id, task.dueOn], task.href, { title: task.title, dueOn: task.dueOn })] : [];
    });
    for (const balance of finance.balances) {
      for (const [kind, amount] of [["overduePayable", balance.overduePayable], ["overdueReceivable", balance.overdueReceivable]]) {
        if (toCents(amount) > 0n) alerts.push(alert(kind, [balance.currency, amount], base + "/finance/bank-matches",
          { amount, currency: balance.currency }));
      }
    }
    for (const forecast of finance.forecast) {
      if (forecast.projectedMonthEnd !== null && toCents(forecast.projectedMonthEnd) < 0n) {
        alerts.push(alert("negativeForecast", [forecast.currency, day.slice(0, 7), forecast.projectedMonthEnd], base + "/finance/bank-matches",
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
