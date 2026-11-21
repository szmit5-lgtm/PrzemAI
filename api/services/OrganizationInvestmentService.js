"use strict";
const prisma = require("../../lib/prisma");
const { OrganizationService, OrganizationError } = require("./OrganizationService");

const STATUSES = new Set(["NOT_SET", "IN_PROGRESS", "ON_HOLD", "COMPLETED"]);
const SELECT = {
  id: true, organizationId: true, name: true, description: true,
  status: true, progress: true, source: true, createdAt: true, updatedAt: true
};

class OrganizationInvestmentService {
  constructor({ db = prisma, orgService = null } = {}) {
    this.db = db;
    this.orgService = orgService || new OrganizationService({ db });
  }

  async list(userId, organizationId) {
    // Company membership alone suffices to view NON-FINANCIAL projects.
    // KSeF, invoices and bank statements are deliberately not queried.
    await this.orgService.membership(userId, organizationId);
    const rows = await this.db.organizationInvestment.findMany({
      where: { organizationId },
      select: SELECT,
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      take: 150
    });
    return { items: rows, scope: "ORGANIZATION_PROJECTS_ONLY" };
  }

  async create(userId, organizationId, input) {
    await this.orgService.membership(userId, organizationId, ["OWNER", "ADMIN"]);
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    const description = typeof input?.description === "string" ? input.description.trim() : "";
    if (name.length < 3 || name.length > 160 || description.length > 4000) {
      throw new OrganizationError("Nazwa inwestycji musi mieć 3–160 znaków, a opis maksymalnie 4000.");
    }
    try {
      return await this.db.organizationInvestment.create({
        data: {
          name, description, organizationId, createdById: userId,
          status: "NOT_SET", source: "MANUAL"
        }, select: SELECT
      });
    } catch (error) {
      if (error?.code === "P2002") throw new OrganizationError("Inwestycja o tej nazwie już istnieje w tej spółce.", 409);
      throw error;
    }
  }

  async update(userId, organizationId, investmentId, input) {
    await this.orgService.membership(userId, organizationId, ["OWNER", "ADMIN"]);
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new OrganizationError("Nieprawidłowe dane inwestycji.");
    }
    if (!Object.keys(input).length || Object.keys(input).some(key => !["status", "progress", "description"].includes(key))) {
      throw new OrganizationError("Nieprawidłowe pola aktualizacji inwestycji.");
    }
    const changes = {};
    if (Object.hasOwn(input, "status")) {
      if (!STATUSES.has(input.status)) throw new OrganizationError("Nieprawidłowy status inwestycji.");
      changes.status = input.status;
    }
    if (Object.hasOwn(input, "progress")) {
      if (input.progress !== null && (!Number.isInteger(input.progress) || input.progress < 0 || input.progress > 100)) {
        throw new OrganizationError("Postęp musi być liczbą od 0 do 100 albo pusty.");
      }
      changes.progress = input.progress;
    }
    if (Object.hasOwn(input, "description")) {
      if (typeof input.description !== "string" || input.description.length > 4000) {
        throw new OrganizationError("Opis może mieć maksymalnie 4000 znaków.");
      }
      changes.description = input.description.trim();
    }
    const updated = await this.db.organizationInvestment.updateMany({
      where: { id: investmentId, organizationId },
      data: changes
    });
    if (updated.count !== 1) throw new OrganizationError("Inwestycja nie istnieje w tej spółce.", 404);
    return this.db.organizationInvestment.findFirst({
      where: { id: investmentId, organizationId },
      select: SELECT
    });
  }
}
module.exports = { OrganizationInvestmentService };
