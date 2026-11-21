const prisma = require("../../lib/prisma");
const { financialDocumentLabel } = require("../../lib/financialDocumentLabel");
const {financeClass,validateFinanceClass,summarizePeriods} = require("../../lib/financeClassification");

class FinanceService {
    async list(userId, options = {}) {
        if (typeof userId !== "string" || !userId.trim()) {
            throw new Error("Brak identyfikatora użytkownika.");
        }
        const limit = Math.min(
            Math.max(Math.trunc(Number(options.limit)) || 100, 1),
            500
        );

        // Keep the page bounded and never allow a negative or fractional offset.
        const offsetValue = Number(options.offset);
        const offset = Number.isFinite(offsetValue)
            ? Math.min(Math.max(Math.trunc(offsetValue), 0), 100000)
            : 0;

        const where = {
            userId
        };

        if (options.status) {
            where.status = options.status;
        }

        if (options.source) {
            where.source = options.source;
        }

        const items = await prisma.financialDocument.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: [
                { issueDate: "desc" },
                { createdAt: "desc" },
                { id: "desc" }
            ],
            include: {
                project: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        return items.map(item => ({
            ...item,
      // Full KSeF XML is available only from the single-document endpoint.
      rawData: item.source === "KSEF" ? null : item.rawData,
      displayTitle: item.source === "KSEF" ? financialDocumentLabel(item) : null,
      descriptionReady: item.source === "KSEF" && !!item.metadata?.analysis?.description,
      costAccounting:financeClass(item),
            netAmount:
                item.netAmount?.toString() || null,
            vatAmount:
                item.vatAmount?.toString() || null,
            grossAmount:
                item.grossAmount?.toString() || null
        }));
    }

    async one(userId, id) {
        if (typeof userId !== "string" || !userId.trim()) return null;
        if (typeof id !== "string" || !id.trim() || id.length > 128) return null;
        const document = await prisma.financialDocument.findFirst({
            where: { id, userId },
            include: { project: { select: { id: true, name: true } } }
        });
        if (!document) return null;
        return {
            ...document,
            displayTitle: document.source === "KSEF" ? financialDocumentLabel(document) : null,
            costAccounting:financeClass(document),
            netAmount: document.netAmount?.toString() || null,
            vatAmount: document.vatAmount?.toString() || null,
            grossAmount: document.grossAmount?.toString() || null
        };
    }

    async queueKsefBackfill(userId) {
        // A KSeF credential belongs to one explicitly configured owner.
        // Never let a different authenticated account queue this import.
        if (!userId || process.env.KSEF_SYNC_ENABLED !== "true" ||
            process.env.KSEF_OWNER_USER_ID !== userId) {
            throw new Error("Integracja KSeF nie jest aktywna na tym koncie.");
        }
        const agent = await prisma.agent.findFirst({
            where: { userId, key: "financial", type: "FINANCIAL", enabled: true },
            select: { id: true, status: true }
        });
        if (!agent) throw new Error("Włącz najpierw Financial Agent.");
        if (agent.status === "RUNNING") {
            return { queued: false, status: "RUNNING" };
        }
        const updated = await prisma.agent.updateMany({
            where: { id: agent.id, userId, enabled: true,
                NOT: { status: "RUNNING" } },
            data: { nextRunAt: new Date(), status: "IDLE" }
        });
        return updated.count === 1
            ? { queued: true, status: "QUEUED" }
            : { queued: false, status: "RUNNING" };
    }

    // Company projects require explicit grants for members; legacy personal projects
    // remain visible only to their creator until explicitly assigned to a tenant.
    async accessibleProjectOrganizations(userId) {
        const memberships = await prisma.organizationMembership.findMany({
            where: { userId, status: "ACTIVE", organization: { status: "ACTIVE" } },
            select: { organizationId: true }
        });
        return memberships.map(member => member.organizationId);
    }

    async listProjects(userId) {
        if (typeof userId !== "string" || !userId.trim()) {
            throw new Error("Brak identyfikatora użytkownika.");
        }
        const organizationIds = await this.accessibleProjectOrganizations(userId);
        return prisma.project.findMany({
            where: {
                status: "ACTIVE",
                OR: [
                    { userId, organizationId: null },
                    {
                        organizationId: { in: organizationIds },
                        projectAccesses: { some: { userId } }
                    },
                    {
                        organizationId: { in: organizationIds },
                        organization: {
                            memberships: {
                                some: {
                                    userId, status: "ACTIVE",
                                    role: { in: ["OWNER", "ADMIN"] }
                                }
                            }
                        }
                    }
                ]
            },
            select: { id: true, name: true, aliases: true, company: true, organizationId: true },
            orderBy: { name: "asc" },
            take: 300
        });
    }

    async createProject(userId, payload) {
        if (typeof userId !== "string" || !userId.trim()) {
            throw new Error("Brak identyfikatora użytkownika.");
        }
        const name = typeof payload?.name === "string" ? payload.name.trim() : "";
        const company = typeof payload?.company === "string" ? payload.company.trim() : "";
        const organizationId = typeof payload?.organizationId === "string"
            ? payload.organizationId.trim() : "";
        const aliases = Array.isArray(payload?.aliases)
            ? [...new Set(payload.aliases.map(x=>typeof x === "string" ? x.trim() : "")
                .filter(x=>x.length >= 3 && x.length <= 100))].slice(0,10)
            : [];
        if (name.length < 3 || name.length > 120 || company.length > 100) {
            throw new Error("Nazwa projektu musi mieć 3–120 znaków.");
        }
        if (organizationId.length > 128) throw new Error("Nieprawidłowa spółka.");
        const allowed = await this.accessibleProjectOrganizations(userId);
        // A single-company member creates shared projects by default.
        // Multiple-company members must choose explicitly to avoid cross-tenant mistakes.
        const selectedOrganizationId = organizationId || (allowed.length === 1 ? allowed[0] : "");
        if (organizationId && !allowed.includes(organizationId)) {
            throw new Error("Brak dostępu do wybranej spółki.");
        }
        if (!organizationId && allowed.length > 1) {
            throw new Error("Wybierz spółkę dla nowego projektu.");
        }
        // Only organization admins may create company-wide projects.
        // Membership alone must not grant project creation or visibility.
        if (selectedOrganizationId) {
            const admin = await prisma.organizationMembership.findFirst({
                where: {
                    userId, organizationId: selectedOrganizationId, status: "ACTIVE",
                    role: { in: ["OWNER", "ADMIN"] },
                    organization: { status: "ACTIVE" }
                },
                select: { id: true }
            });
            if (!admin) throw new Error("Brak uprawnień do tworzenia projektu spółki.");
        }
        const existing = await prisma.project.findFirst({
            where: {
                name, status: "ACTIVE",
                ...(selectedOrganizationId ? { organizationId: selectedOrganizationId } : { userId, organizationId: null })
            },
            select: { id: true }
        });
        if (existing) throw new Error("Projekt o tej nazwie już istnieje.");
        return prisma.project.create({ data: {
            userId, name, company: company || null, aliases, status: "ACTIVE",
            organizationId: selectedOrganizationId || null
        } });
    }

    // Explicit owner-initiated mapping for existing legacy projects. No automatic
    // migration based on the display-only company field.
    async shareLegacyProject(userId, projectId, organizationId) {
        if (typeof userId !== "string" || !userId.trim() ||
            typeof projectId !== "string" || !projectId.trim() || projectId.length > 128 ||
            typeof organizationId !== "string" || !organizationId.trim() || organizationId.length > 128) {
            throw new Error("Nieprawidłowe dane przypisania projektu.");
        }
        const membership = await prisma.organizationMembership.findFirst({
            where: {
                userId, organizationId, status: "ACTIVE",
                role: { in: ["OWNER", "ADMIN"] },
                organization: { status: "ACTIVE" }
            },
            select: { id: true }
        });
        if (!membership) throw new Error("Brak uprawnień administratora spółki.");
        const updated = await prisma.project.updateMany({
            where: { id: projectId, userId, organizationId: null, status: "ACTIVE" },
            data: { organizationId }
        });
        if (updated.count !== 1) throw new Error("Projekt nie istnieje lub został już przypisany.");
        return { id: projectId, organizationId };
    }

    // Only an active organization administrator can manage explicit project grants.
    async setProjectAccess(actorId, projectId, targetUserId, enabled) {
        if (![actorId, projectId, targetUserId].every(value =>
            typeof value === "string" && value.trim() && value.length <= 128) ||
            typeof enabled !== "boolean") {
            throw new Error("Nieprawidłowe dane uprawnień.");
        }
        const project = await prisma.project.findFirst({
            where: { id: projectId, status: "ACTIVE", organizationId: { not: null } },
            select: { id: true, organizationId: true }
        });
        if (!project) throw new Error("Projekt spółki nie istnieje.");
        const admin = await prisma.organizationMembership.findFirst({
            where: {
                userId: actorId, organizationId: project.organizationId,
                status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] },
                organization: { status: "ACTIVE" }
            },
            select: { id: true }
        });
        if (!admin) throw new Error("Brak uprawnień administratora spółki.");
        const target = await prisma.organizationMembership.findFirst({
            where: {
                userId: targetUserId, organizationId: project.organizationId,
                status: "ACTIVE", organization: { status: "ACTIVE" }
            },
            select: { id: true }
        });
        if (!target) throw new Error("Pracownik nie ma aktywnego dostępu do spółki.");
        if (enabled) {
            await prisma.projectAccess.upsert({
                where: { projectId_userId: { projectId, userId: targetUserId } },
                create: { projectId, userId: targetUserId },
                update: {}
            });
        } else {
            await prisma.projectAccess.deleteMany({ where: { projectId, userId: targetUserId } });
        }
        return { projectId, userId: targetUserId, enabled };
    }

    async assignProject(userId, id, projectId) {
        if (typeof userId !== "string" || !userId.trim()) {
            throw new Error("Brak identyfikatora użytkownika.");
        }
        if (typeof id !== "string" || !id.trim() || id.length > 128) {
            throw new Error("Nieprawidłowy dokument.");
        }
        if (projectId !== null && (typeof projectId !== "string" || !projectId.trim() || projectId.length > 128)) {
            throw new Error("Nieprawidłowy projekt.");
        }
        const existing = await prisma.financialDocument.findFirst({
            where: { userId, id }, select: { id: true, metadata: true }
        });
        if (!existing) return null;
        let project = null;
        if (projectId !== null) {
            project = await prisma.project.findFirst({
                where: { userId, id: projectId, status: "ACTIVE" },
                select: { id: true, name: true }
            });
            if (!project) throw new Error("Projekt nie istnieje na Twoim koncie.");
        }
        const metadata = existing.metadata && typeof existing.metadata === "object" &&
            !Array.isArray(existing.metadata) ? existing.metadata : {};
        const analysis = metadata.analysis && typeof metadata.analysis === "object" &&
            !Array.isArray(metadata.analysis) ? metadata.analysis : {};
        await prisma.financialDocument.updateMany({
            where: { id, userId },
            data: {
                projectId,
                metadata: { ...metadata, analysis: {
                    ...analysis, projectDecision: "MANUAL", projectHint: project?.name || null
                } }
            }
        });
        return { id, projectId, project };
    }

    async classifyExpense(userId,id,value) {
        if (typeof userId !== "string" || !userId.trim()) {
            throw new Error("Brak identyfikatora użytkownika.");
        }
        if(typeof id!=="string"||id.length<1||id.length>128)throw Error("Nieprawidłowa faktura.");
        const classification=validateFinanceClass(value);
        const document=await prisma.financialDocument.findFirst({
            where:{id,userId,source:"KSEF",direction:"INCOMING"},
            select:{id:true,metadata:true}
        });
        if(!document) return null;
        const metadata=document.metadata&&typeof document.metadata==="object"&&!Array.isArray(document.metadata)
            ?document.metadata:{};
        const updated=await prisma.financialDocument.updateMany({
            where:{id,userId,source:"KSEF",direction:"INCOMING"},
            data:{metadata:{...metadata,costAccounting:{...classification,source:"MANUAL",
                classifiedAt:new Date().toISOString()}}}
        });
        return updated.count ?{id,...classification}:null;
    }

    async reportPeriods(userId,yearInput){
        if (typeof userId !== "string" || !userId.trim()) {
            throw new Error("Brak identyfikatora użytkownika.");
        }
        const year=yearInput===undefined?new Date().getUTCFullYear():Number(yearInput);
        if(!Number.isSafeInteger(year)||year<2020||year>2100)
            throw Error("Nieprawidłowy rok zestawienia.");
        const start=new Date(Date.UTC(year,0,1));
        const end=new Date(Date.UTC(year+1,0,1));
        const docs=[];
        const pageSize=500;
        for(let page=0;page<100;page++){
            const items=await prisma.financialDocument.findMany({
                where:{userId,source:"KSEF",issueDate:{gte:start,lt:end}},
                select:{id:true,issueDate:true,source:true,direction:true,currency:true,
                    grossAmount:true,invoiceNumber:true,sellerName:true,metadata:true},
                orderBy:{id:"asc"},take:pageSize,
                ...(page ? {cursor:{id:docs[docs.length-1].id},skip:1}: {})
            });
            docs.push(...items);
            if(items.length<pageSize)break;
            if(page===99)throw Error("Za dużo dokumentów do tego zestawienia.");
        }
        return {year,source:"KSEF_INVOICES",cashFlowAvailable:false,
            explanation:"Zestawienie jest według daty wystawienia i kwot brutto faktur. Nie oznacza wpływów i wypływów z kont bankowych.",
            rows:summarizePeriods(docs,year)};
    }

    async summary(userId) {
        if (typeof userId !== "string" || !userId.trim()) {
            throw new Error("Brak identyfikatora użytkownika.");
        }
        const [
            total,
            newCount,
            mailCount,
            ksefCount
        ] = await Promise.all([
            prisma.financialDocument.count({
                where: { userId }
            }),
            prisma.financialDocument.count({
                where: {
                    userId,
                    status: "NEW"
                }
            }),
            prisma.financialDocument.count({
                where: {
                    userId,
                    source: "MAIL"
                }
            }),
            prisma.financialDocument.count({
                where: {
                    userId,
                    source: "KSEF"
                }
            })
        ]);

        const summary = { total, new: newCount, mail: mailCount, ksef: ksefCount };
        if (typeof prisma.financialDocument.groupBy !== "function") return summary;
        const rows = await prisma.financialDocument.groupBy({
            by: ["currency", "direction"],
            where: { userId, source: "KSEF" },
            _sum: { netAmount: true, vatAmount: true, grossAmount: true },
            _count: { _all: true }
        });
        return {
            ...summary,
            amounts: rows.map(row => ({
                currency: row.currency,
                direction: row.direction,
                count: row._count._all,
                net: row._sum.netAmount?.toString() || null,
                vatPLN: row._sum.vatAmount?.toString() || null,
                gross: row._sum.grossAmount?.toString() || null
            }))
        };
    }
}

module.exports = FinanceService;
