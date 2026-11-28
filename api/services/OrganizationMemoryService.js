"use strict";

const prisma = require("../../lib/prisma");
const { OrganizationService, OrganizationError } = require("./OrganizationService");

const roles = ["OWNER", "ADMIN"];
const fields = {
    id: true, kind: true, counterparty: true, text: true, investmentId: true,
    createdAt: true, updatedAt: true, investment: { select: { name: true } }
};

class OrganizationMemoryService {
    constructor({ db = prisma } = {}) {
        this.db = db;
        this.organizations = new OrganizationService({ db });
    }

    async list(userId, organizationId) {
        await this.organizations.membership(userId, organizationId, roles);
        const rows = await this.db.organizationMemory.findMany({
            where: { organizationId,
                OR: [{ investmentId: null }, { investment: { organizationId } }],
                organization: { status: "ACTIVE", memberships: {
                    some: { userId, status: "ACTIVE", role: { in: roles } }
                } }
            },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take: 101, select: fields
        });
        return { items: rows.slice(0, 100), hasMore: rows.length > 100 };
    }

    async save(userId, organizationId, input, id = null) {
        await this.organizations.membership(userId, organizationId, roles);
        const { kind, text, counterparty, investmentId } = input || {};
        const cleaned = typeof text === "string" ? text.trim() : "";
        if (!["DECISION", "AGREEMENT"].includes(kind) || cleaned.length < 3 || cleaned.length > 5000 ||
            (counterparty != null && (typeof counterparty !== "string" || counterparty.trim().length > 180)) ||
            (investmentId != null && (typeof investmentId !== "string" || investmentId.length > 128))) {
            throw new OrganizationError("Podaj rodzaj i treść wpisu od 3 do 5000 znaków.");
        }
        return this.db.$transaction(async tx => {
            await new OrganizationService({ db: tx }).membership(userId, organizationId, roles);
            if (investmentId && !await tx.organizationInvestment.findFirst({
                where: { id: investmentId, organizationId }, select: { id: true }
            })) throw new OrganizationError("Nie znaleziono inwestycji w tej spółce.", 404);
            const data = { kind, text: cleaned, counterparty: counterparty?.trim() || null, investmentId: investmentId || null };
            if (!id) return tx.organizationMemory.create({ data: { organizationId, ...data }, select: fields });
            const result = await tx.organizationMemory.updateMany({ where: { id, organizationId }, data });
            if (!result.count) throw new OrganizationError("Nie znaleziono wpisu w tej spółce.", 404);
            return tx.organizationMemory.findFirst({ where: { id, organizationId }, select: fields });
        }, { isolationLevel: "Serializable" });
    }

    async remove(userId, organizationId, id) {
        await this.organizations.membership(userId, organizationId, roles);
        const result = await this.db.organizationMemory.deleteMany({
            where: { id, organizationId, organization: { status: "ACTIVE", memberships: {
                some: { userId, status: "ACTIVE", role: { in: roles } }
            } } }
        });
        if (!result.count) throw new OrganizationError("Nie znaleziono wpisu w tej spółce.", 404);
        return { id };
    }
}

module.exports = { OrganizationMemoryService };
