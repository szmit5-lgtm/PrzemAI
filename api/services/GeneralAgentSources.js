"use strict";

const { getAgentDefinition } = require("../../lib/agentCatalog");
const { OrganizationService } = require("./OrganizationService");
const { OrganizationFinanceService } = require("./OrganizationFinanceService");
const { visibleInvestmentWhere } = require("./OrganizationInvestmentService");
const { normalize } = require("./InvestmentContextService");
const { extractAttachment, MAX_FILE } = require("./ChatAttachmentService");
const { redactText, documentReport } = require("../../lib/aiContext");

const { OrganizationBankMonthlyService } = require("./OrganizationBankMonthlyService");
const { OrganizationBankAccessService } = require("./OrganizationBankAccessService");

const { OrganizationSettlementService } = require("./OrganizationSettlementService");
const { OrganizationInvestmentFinanceService } = require("./OrganizationInvestmentFinanceService");

const DOCUMENT_ROLES = ["OWNER", "ADMIN"];

function rankDocuments(rows, instruction, name) {
  const query = " " + normalize(instruction) + " ";
  const score = row => normalize(row[name]).split(" ")
    .filter(word => word.length >= 4 && query.includes(" " + word + " ")).length;
  return rows.sort((a, b) => score(b) - score(a)).slice(0, 4);
}

class GeneralAgentSources {
  constructor(db) {
    this.db = db;
    this.organizations = new OrganizationService({ db });
    this.finance = new OrganizationFinanceService({ db, orgService: this.organizations });
    this.bankAccess = new OrganizationBankAccessService({ db, organizationService: this.organizations });
    this.bank = new OrganizationBankMonthlyService({ db, access: this.bankAccess });
    this.settlements = new OrganizationSettlementService({ db, finance: this.finance, bankAccess: this.bankAccess });
    this.investmentFinance = new OrganizationInvestmentFinanceService({ db, finance: this.finance });
  }

  async financeAccess(userId, organizationId) {
    async function permitted(check) {
      try { await check(); return true; }
      catch (error) {
        if ([403, 404].includes(error.status)) return false;
        throw error;
      }
    }
    const [invoices, bank] = await Promise.all([
      permitted(() => this.finance.accessible(userId, organizationId)),
      permitted(() => this.bankAccess.authorize(userId, organizationId))
    ]);
    return { invoices, bank };
  }

  async authorize({ userId, organizationId, agentKey, investmentIds, financialSources, memoryIds }) {
    if (!organizationId) {
      if (agentKey !== "document" && getAgentDefinition(agentKey)?.mode !== "TASK_DRAFT") return false;
      if (!memoryIds?.length) return true;
      const settings = await this.db.userSettings.findUnique({ where: { userId }, select: { memoryEnabled: true } });
      if (!settings?.memoryEnabled) return false;
      return await this.db.memory.count({ where: { userId, archivedAt: null, id: { in: memoryIds } } }) === memoryIds.length;
    }
    try {
      if (agentKey === "financial") {
        const access = await this.financeAccess(userId, organizationId);
        if (!access.invoices && !access.bank) return false;
        if (financialSources?.invoices && !access.invoices) return false;
        if (financialSources?.bank && !access.bank) return false;
      }
      if (agentKey !== "financial" || investmentIds?.length) {
        const member = await this.organizations.membership(userId, organizationId,
          agentKey === "document" ? DOCUMENT_ROLES : undefined);
        if (investmentIds?.length) {
          const visible = await this.db.organizationInvestment.count({
            where: { ...visibleInvestmentWhere(member, userId, organizationId), id: { in: investmentIds } }
          });
          return visible === investmentIds.length;
        }
      }
      return true;
    } catch (error) {
      if ([403, 404].includes(error.status)) return false;
      throw error;
    }
  }

  async load(scope, instruction) {
    const { userId, organizationId, agentKey } = scope;
    if (agentKey === "financial") {
      if (!organizationId) return null;
      const access = await this.financeAccess(userId, organizationId);
      if (!access.invoices && !access.bank) return null;
      const text = String(instruction);
      const reference = text.match(/(?:^|\s)([a-z0-9]+(?:[/-][a-z0-9]+)+)(?=$|[\s,.?!])/i)?.[1];
      const periodText = reference ? text.replace(reference, "") : text;
      const years = [...new Set(periodText.match(/\b(?:20[2-9][0-9]|2100)\b/g) || [])].map(Number);
      const year = years.length === 1 ? years[0] : undefined;
      const [invoiceTotals, page] = access.invoices ? await Promise.all([
        this.finance.agentTotals(userId, organizationId, year),
        this.finance.documents(userId, organizationId, { limit: 25, year, reference })
      ]) : [[], { items: [], hasMore: false }];
      const bankPeriods = [];
      if (access.bank) try {
        for (const bankYear of years.length ? years.slice(0, 5) : [new Date().getUTCFullYear()]) {
          const report = await this.bank.report(userId, organizationId, bankYear);
          if (!report.accounts.length) continue;
          bankPeriods.push({
            year: bankYear,
            months: report.months.map(({month, currencies}) => ({month, currencies})),
            quarters: report.quarters.map(({quarter, currencies}) => ({quarter, currencies}))
          });
        }
      } catch (error) {
        if (![403, 404, 413].includes(error.status)) throw error;
      }
      const financialReports = [];
      if (access.invoices && access.bank && /\b(sald\w*|rozlicz\w*|platnos\w*|zaplac\w*|niezaplac\w*|prognoz\w*|nalezn\w*|zobowiaz\w*|przetermin\w*|stal\w*|invalid xml)\b/.test(normalize(text))) {
        try {
          const report = await this.settlements.report(userId, organizationId, year || new Date().getUTCFullYear());
          financialReports.push({ year: report.year, asOf: report.asOf, summary: report.summary,
            balances: report.balances, forecast: report.forecast, invalidXml: report.diagnostics });
          const statuses = new Map(report.items.map(item => [item.id, item]));
          for (const row of page.items) {
            const detail = statuses.get(row.id);
            if (detail) row.settlement = { status: detail.status, overdue: detail.overdue,
              paid: detail.paid, outstanding: detail.outstanding };
          }
        } catch (error) {
          if (![403, 404, 413].includes(error.status)) throw error;
        }
      }
      let investmentProfitability = [];
      let investmentIds = [];
      if (access.invoices && /\b(rentownosc\w*|marz\w*|zysk\w*)\b/.test(normalize(text))) {
        try {
          const member = await this.organizations.membership(userId, organizationId);
          const report = await this.investmentFinance.report(userId, organizationId, year || new Date().getUTCFullYear(), member);
          const visible = report.investments.filter(row => row.profitability.length);
          investmentIds = visible.map(row => row.id);
          investmentProfitability = visible.map(row => ({
            investment: redactText(row.name, 160), year: report.year, profitability: row.profitability
          }));
        } catch (error) {
          if (![403, 404, 413].includes(error.status)) throw error;
        }
      }
      return {
        financialSources: { invoices: access.invoices, bank: bankPeriods.length > 0 || financialReports.length > 0 },
        coverage: "Sumy obejmują wszystkie zapisane faktury KSeF w podanym zakresie, według daty wystawienia. " +
          "Kwoty zawierają korekty ze znakiem z KSeF. Pola missing wskazują kwoty nieznane. " +
          "Szczegóły faktur to maksymalnie 25 pozycji. Raport bankowy obejmuje wyłącznie zaimportowane operacje i potwierdzone salda. " +
          "Dane bankowe dotyczą lat jawnie wskazanych w pytaniu (maksymalnie pięciu) lub bieżącego roku. Brak okresu bankowego oznacza brak danych w kontekście. " +
          "Prognoza opiera się na importach i terminach płatności. Rentowność obejmuje przypisane faktury netto. " +
          (access.invoices ? "" : "Faktury KSeF są poza dostępnym zakresem."),
        investmentIds,
        invoiceTotals,
        bankPeriods,
        financialReports,
        investmentProfitability,
        hasMore: page.hasMore,
        invoices: page.items.map(row => ({
          invoice: redactText(row.invoiceNumber, 100),
          issued: row.issueDate, due: row.dueDate, direction: redactText(row.direction, 24),
          currency: redactText(row.currency, 8), gross: row.grossAmount,
          net: row.netAmount, vat: row.vatAmount, settlement: row.settlement
        }))
      };
    }
    if (!await this.authorize(scope)) return null;
    if (agentKey === "investment") {
      const member = await this.organizations.membership(userId, organizationId);
      const investments = await this.db.organizationInvestment.findMany({
        where: visibleInvestmentWhere(member, userId, organizationId), orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 30,
        select: { id: true, name: true, status: true, progress: true, description: true }
      });
      return { investmentIds: investments.map(row => row.id), investments: investments.map(row => ({
        name: redactText(row.name, 160), status: redactText(row.status, 40), progress: row.progress,
        description: redactText(row.description, 800)
      })) };
    }
    if (agentKey !== "document") {
      if (organizationId) return {};
      const settings = await this.db.userSettings.findUnique({ where: { userId }, select: { memoryEnabled: true } });
      if (!settings?.memoryEnabled) return {};
      const memory = await this.db.memory.findMany({
        where: { userId, archivedAt: null }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 8,
        select: { id: true, title: true, content: true }
      });
      return { memoryIds: memory.map(row => row.id), memory: memory.map(row => ({
        title: redactText(row.title, 160), content: redactText(row.content, 700)
      })) };
    }
    if (!organizationId) {
      const rows = await this.db.history.findMany({
        where: { userId, type: "document" }, take: 30,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { title: true, report: true }
      });
      return { documents: rankDocuments(rows, instruction, "title").map(row => ({
        title: redactText(row.title, 200), analysis: documentReport(row.report)
      })) };
    }
    const rows = await this.db.organizationDocument.findMany({
      where: { organizationId }, take: 60, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, name: true, contentType: true, size: true }
    });
    const selected = rankDocuments(rows, instruction, "name");
    const documents = await Promise.all(selected.map(async row => {
      const title = redactText(row.name, 200);
      if (row.size > MAX_FILE) return { title, availableText: false };
      const file = await this.db.organizationDocument.findFirst({
        where: { id: row.id, organizationId }, select: { content: true }
      });
      if (!file) return { title, availableText: false };
      const bytes = Buffer.from(file.content);
      try {
        let text = "";
        if (row.contentType === "text/plain") text = bytes.toString("utf8");
        else if (["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
          .includes(row.contentType)) {
          const originalname = row.contentType === "application/pdf" ? "source.pdf" : "source.docx";
          text = (await extractAttachment({ originalname, buffer: bytes })).text;
        }
        return { title, text: redactText(text, 3000), availableText: Boolean(text.trim()) };
      } catch {
        return { title, availableText: false };
      }
    }));
    return { documents };
  }
}

module.exports = GeneralAgentSources;
