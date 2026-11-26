"use strict";

const { OrganizationService } = require("./OrganizationService");
const { OrganizationFinanceService } = require("./OrganizationFinanceService");
const { normalize } = require("./InvestmentContextService");
const { redactText, documentReport } = require("../../lib/aiContext");

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
  }

  async authorize({ userId, organizationId, agentKey }) {
    if (!organizationId) return agentKey === "document";
    try {
      if (agentKey === "financial") await this.finance.accessible(userId, organizationId);
      else await this.organizations.membership(userId, organizationId,
        agentKey === "document" ? DOCUMENT_ROLES : undefined);
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
      const page = await this.finance.documents(userId, organizationId, { limit: 25 });
      return {
        coverage: "Do 25 najnowszych zapisanych faktur KSeF; w razie dalszych pozycji nie podawaj sum dla całej firmy.",
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
      const investments = await this.db.organizationInvestment.findMany({
        where: { organizationId }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 30,
        select: { name: true, status: true, progress: true, description: true }
      });
      return { investments: investments.map(row => ({
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
