const prisma = require("../../lib/prisma");
const { GENERAL_SOURCE } = require("../../lib/agentCatalog");
const { OrganizationError, OrganizationService } = require("./OrganizationService");
const { visibleInvestmentWhere } = require("./OrganizationInvestmentService");

const historyTypes = ["document", "meeting"];
const searchLimit = 12;
const exportLimit = 500;
const recent = [{ updatedAt: "desc" }, { id: "desc" }];
const personalTasks = {
  source: { notIn: ["COMPANY", GENERAL_SOURCE] },
  investmentId: null,
  investmentScoped: false
};

class WorkspaceToolsService {
  constructor({ db = prisma } = {}) {
    this.db = db;
    this.organizations = new OrganizationService({ db });
  }

  async search(userId, rawQuery, organizationId) {
    const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
    if (query.length < 3 || query.length > 100 || query.includes("\0")) {
      throw new OrganizationError("Wpisz od 3 do 100 znaków.");
    }
    if (organizationId !== undefined && (typeof organizationId !== "string" ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(organizationId))) {
      throw new OrganizationError("Nieprawidłowa spółka.");
    }
    // Prisma contains uses LIKE semantics on PostgreSQL.
    const match = { contains: query.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" };
    const options = { orderBy: recent, take: searchLimit + 1, select: { id: true, title: true, updatedAt: true } };
    const results = organizationId
      ? await this.searchOrganization(userId, organizationId, match)
      : await Promise.all([
        this.db.history.findMany({ ...options, where: { userId, type: { in: historyTypes }, title: match } }),
        this.db.task.findMany({ ...options, where: { userId, ...personalTasks, title: match } })
      ]).then(([history, tasks]) => [
        ...history.map(row => ({ ...row, kind: "history", href: "/history/" + encodeURIComponent(row.id) })),
        ...tasks.map(row => ({ ...row, kind: "task", href: "/tasks" }))
      ]);
    results.sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id));
    return { results: results.slice(0, searchLimit), hasMore: results.length > searchLimit };
  }

  async searchOrganization(userId, organizationId, match) {
    const member = await this.organizations.membership(userId, organizationId);
    const base = "/company/" + encodeURIComponent(organizationId);
    const investments = this.db.organizationInvestment.findMany({
      where: {
        ...visibleInvestmentWhere(member, userId, organizationId),
        name: match
      },
      orderBy: recent,
      take: searchLimit + 1,
      select: { id: true, name: true, updatedAt: true }
    });
    const documents = ["OWNER", "ADMIN"].includes(member.role)
      ? this.db.organizationDocument.findMany({
        where: { organizationId, name: match },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: searchLimit + 1,
        select: { id: true, name: true, createdAt: true }
      })
      : [];
    const [investmentRows, documentRows] = await Promise.all([investments, documents]);
    return [
      ...investmentRows.map(({ id, name, updatedAt }) => ({
        id, title: name, updatedAt, kind: "investment", href: base + "/investments/" + encodeURIComponent(id)
      })),
      ...documentRows.map(({ id, name, createdAt }) => ({
        id, title: name, updatedAt: createdAt, kind: "companyDocument", href: base + "/documents"
      }))
    ];
  }

  async exportPersonal(userId) {
    const account = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, createdAt: true }
    });
    if (!account) throw new OrganizationError("Konto jest niedostępne.", 404);

    const options = { orderBy: recent, take: exportLimit + 1 };
    const [history, tasks] = await Promise.all([
      this.db.history.findMany({
        ...options,
        where: { userId, type: { in: historyTypes } },
        select: { id: true, title: true, filename: true, type: true, createdAt: true, updatedAt: true }
      }),
      this.db.task.findMany({
        ...options,
        where: { userId, ...personalTasks },
        select: {
          id: true, title: true, description: true, status: true, priority: true,
          dueDate: true, completedAt: true, createdAt: true, updatedAt: true
        }
      })
    ]);
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      account,
      limitPerSection: exportLimit,
      truncatedSections: [
        ...(history.length > exportLimit ? ["history"] : []),
        ...(tasks.length > exportLimit ? ["tasks"] : [])
      ],
      history: history.slice(0, exportLimit),
      tasks: tasks.slice(0, exportLimit)
    };
  }
}

module.exports = WorkspaceToolsService;
