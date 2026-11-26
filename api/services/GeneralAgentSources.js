"use strict";

const { OrganizationService } = require("./OrganizationService");
const { OrganizationFinanceService } = require("./OrganizationFinanceService");
const { visibleInvestmentWhere } = require("./OrganizationInvestmentService");
const { normalize } = require("./InvestmentContextService");
const { redactText, documentReport } = require("../../lib/aiContext");

const { OrganizationBankMonthlyService } = require("./OrganizationBankMonthlyService");
const { OrganizationBankAccessService } = require("./OrganizationBankAccessService");

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
    this.bank = new OrganizationBankMonthlyService({
      db, access: new OrganizationBankAccessService({ db, organizationService: this.organizations })
    });
  }

  async authorize({ userId, organizationId, agentKey, investmentIds }) {
    if (!organizationId) return agentKey === "document";
    try {
      if (agentKey === "financial") await this.finance.accessible(userId, organizationId);
      else {
        const member = await this.organizations.membership(userId, organizationId,
          agentKey === "document" ? DOCUMENT_ROLES : undefined);
        if (agentKey === "investment" && investmentIds?.length) {
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
    if (!await this.authorize(scope)) return null;
    if (agentKey === "financial") {
      const text = String(instruction);
      const reference = text.match(/(?:^|\s)([a-z0-9]+(?:[/-][a-z0-9]+)+)(?=$|[\s,.?!])/i)?.[1];
      const periodText = reference ? text.replace(reference, "") : text;
      const years = [...new Set(periodText.match(/\b(?:20[2-9][0-9]|2100)\b/g) || [])].map(Number);
      const year = years.length === 1 ? years[0] : undefined;
      const [invoiceTotals, page] = await Promise.all([
        this.finance.agentTotals(userId, organizationId, year),
        this.finance.documents(userId, organizationId, { limit: 25, year, reference })
      ]);
      const bankPeriods = [];
      try {
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
      return {
        coverage: "Sumy obejmują wszystkie zapisane faktury KSeF w podanym zakresie, według daty wystawienia. " +
          "Kwoty zawierają korekty ze znakiem z KSeF. Pola missing wskazują kwoty nieznane. " +
          "Szczegóły faktur to maksymalnie 25 pozycji. Raport bankowy obejmuje wyłącznie zaimportowane operacje i potwierdzone salda. " +
          "Dane bankowe dotyczą lat jawnie wskazanych w pytaniu (maksymalnie pięciu) lub bieżącego roku. Brak okresu bankowego oznacza brak danych w kontekście.",
        invoiceTotals,
        bankPeriods,
        hasMore: page.hasMore,
        invoices: page.items.map(row => ({
          invoice: redactText(row.invoiceNumber, 100),
          issued: row.issueDate, due: row.dueDate, direction: redactText(row.direction, 24),
          currency: redactText(row.currency, 8), gross: row.grossAmount,
          net: row.netAmount, vat: row.vatAmount
        }))
      };
    }
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
      if (row.size > 2 * 1024 * 1024) return { title, availableText: false };
      const file = await this.db.organizationDocument.findFirst({
        where: { id: row.id, organizationId }, select: { content: true }
      });
      if (!file) return { title, availableText: false };
      const bytes = Buffer.from(file.content);
      try {
        let text = "";
        if (row.contentType === "text/plain") text = bytes.toString("utf8");
        if (row.contentType === "application/pdf") text = (await require("pdf-parse")(bytes, { max: 12 })).text;
        if (row.contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
          text = (await require("mammoth").extractRawText({ buffer: bytes })).value;
        return { title, text: redactText(text, 3000), availableText: Boolean(text.trim()) };
      } catch {
        return { title, availableText: false };
      }
    }));
    return { documents };
  }
}

module.exports = GeneralAgentSources;
