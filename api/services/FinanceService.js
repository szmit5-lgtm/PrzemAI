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

    async listProjects(userId) {
        if (typeof userId !== "string" || !userId.trim()) {
            throw new Error("Brak identyfikatora użytkownika.");
        }
        return prisma.project.findMany({
            where: { userId, status: "ACTIVE" },
            select: { id: true, name: true, aliases: true, company: true },
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
        const aliases = Array.isArray(payload?.aliases)
            ? [...new Set(payload.aliases.map(x=>typeof x === "string" ? x.trim() : "")
                .filter(x=>x.length >= 3 && x.length <= 100))].slice(0,10)
            : [];
        if (name.length < 3 || name.length > 120 || company.length > 100) {
            throw new Error("Nazwa projektu musi mieć 3–120 znaków.");
        }
        const existing = await prisma.project.findFirst({
            where: { userId, name, status: "ACTIVE" },
            select: { id: true }
        });
        if (existing) throw new Error("Projekt o tej nazwie już istnieje.");
        return prisma.project.create({ data: {
            userId, name, company: company || null, aliases, status: "ACTIVE"
        } });
    }

    async assignProject(userId, id, projectId) {
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
