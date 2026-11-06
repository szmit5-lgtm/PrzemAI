const prisma = require("../../lib/prisma");
const AgentRunner = require("../../core/agents/AgentRunner");
const { isAuthorizedDekonicaUser, canSyncMailIntegration } = require("../../lib/mailAccessPolicy");
const {catalog,getAgentDefinition}=require("../../lib/agentCatalog");

class AgentService {
    constructor() {
        this.runner = new AgentRunner();
    }

    async ensureDefaults(userId) {
        await prisma.agent.upsert({
            where: {
                userId_key: {
                    userId,
                    key: "financial"
                }
            },
            update: {},
            create: {
                userId,
                key: "financial",
                name: "Financial Agent",
                type: "FINANCIAL",
                enabled: true,
                status: "IDLE",
                intervalMinutes: 15,
                nextRunAt: new Date()
            }
        });

        for(const def of catalog.filter(x=>x.mode==="TASK_DRAFT")){
            await prisma.agent.upsert({
                where:{userId_key:{userId,key:def.key}},
                update:{},
                create:{userId,key:def.key,name:def.name,type:def.type,enabled:true,status:"IDLE",
                  intervalMinutes:def.intervalMinutes,nextRunAt:new Date()}
            });
        }

        // Email addresses are unverified at registration, so only the
        // explicitly configured internal user ID may get this mailbox.
        // No owner configured = no access.
        if (!isAuthorizedDekonicaUser(userId)) return;

        const mailIntegration =
            await prisma.integration.findFirst({
                where: {
                    userId,
                    type: "MAIL",
                    provider: "HOME_PL",
                    name: "Dekonica office"
                }
            });

        if (!mailIntegration) {
            await prisma.integration.create({
                data: {
                    userId,
                    type: "MAIL",
                    provider: "HOME_PL",
                    name: "Dekonica office",
                    // Credentials existing on Railway are not consent to sync.
                    // A verified owner must explicitly enable the mailbox.
                    enabled: false,
                    config: {
                        email: "office@dekonica.com",
                        imapHost: "dekonica.com",
                        imapPort: 993,
                        smtpHost: "dekonica.com",
                        smtpPort: 587,
                        passwordEnv:
                            "DEKONICA_MAIL_PASSWORD"
                    }
                }
            });
        }
        else if (mailIntegration.config?.autoEnablePending === true) {
            await prisma.integration.update({
                where: { id: mailIntegration.id },
                data: {
                    // Migrate legacy pending integrations without activating
                    // access to real messages during provisioning.
                    enabled: false,
                    config: {
                        ...mailIntegration.config,
                        autoEnablePending: false
                    }
                }
            });
        }
        // Existing explicit enabled/disabled choices are left unchanged.
    }

    async list(userId) {
        await this.ensureDefaults(userId);

        const records=await prisma.agent.findMany({
            where: { userId },
            orderBy: { createdAt: "asc" },
            include: {
                runs: {
                    take: 5,
                    orderBy: {
                        startedAt: "desc"
                    }
                }
            }
        });
        return records.map(agent=>{
          const d=getAgentDefinition(agent.key);
          return d?{...agent,headline:d.headline,description:d.description,
            capabilities:d.capabilities,limitations:d.limitations,mode:d.mode}:agent;
        });
    }

    async runNow(userId, id) {
        const agent = await prisma.agent.findFirst({
            where: { id, userId }
        });

        if (!agent) {
            throw new Error(
                "Agent nie istnieje."
            );
        }

        const lock = await prisma.agent.updateMany({
            where: {
                id,
                userId,
                enabled: true,
                NOT: { status: "RUNNING" }
            },
            data: { status: "RUNNING" }
        });

        if (lock.count !== 1) {
            throw new Error(
                "Agent jest wyłączony albo już działa."
            );
        }

        return this.runner.run(
            { ...agent, status: "RUNNING" },
            "MANUAL"
        );
    }

    async setEnabled(
        userId,
        id,
        enabled
    ) {
        // Reject strings like "false": Boolean("false") is true.
        if (typeof enabled !== "boolean") {
            throw new Error("Pole enabled musi mieć wartość true lub false.");
        }

        const agent = await prisma.agent.findFirst({
            where: { id, userId }
        });

        if (!agent) {
            throw new Error(
                "Agent nie istnieje."
            );
        }

        // Never override RUNNING: the worker uses status as its lock.
        const changed = await prisma.agent.updateMany({
            where: {
                id,
                userId,
                NOT: { status: "RUNNING" }
            },
            data: {
                enabled: Boolean(enabled),
                status: enabled ? "IDLE" : "DISABLED",
                nextRunAt: enabled ? new Date() : null
            }
        });

        if (changed.count !== 1) {
            throw new Error("Nie można zmienić ustawień agenta podczas jego pracy.");
        }

        return prisma.agent.findUnique({ where: { id } });
    }


    async listAssignments(userId,key){
        const def=getAgentDefinition(key);
        if(!def||def.mode!=="TASK_DRAFT")throw Error("Ten agent nie przyjmuje zleceń.");
        const agent=await prisma.agent.findFirst({where:{userId,key},select:{id:true}});
        if(!agent)throw Error("Agent nie istnieje.");
        return prisma.task.findMany({
          where:{userId,source:"AGENT",metadata:{path:["agentKey"],equals:key}},
          orderBy:{createdAt:"desc"},take:100
        });
    }

    async createAssignment(userId,key,payload){
        const def=getAgentDefinition(key);
        if(!def||def.mode!=="TASK_DRAFT")throw Error("Nieobsługiwany agent.");
        const instruction=typeof payload?.instruction==="string"?payload.instruction.trim():"";
        if(instruction.length<5||instruction.length>8000)
            throw Error("Zlecenie musi mieć od 5 do 8000 znaków.");
        const opt=x=>typeof x==="string"?x.trim().slice(0,200):"";
        const agent=await prisma.agent.findFirst({
            where:{userId,key,enabled:true},select:{id:true,status:true}
        });
        if(!agent)throw Error("Agent jest wyłączony lub niedostępny.");
        const stages=["NEW","QUALIFIED","PROPOSAL","FOLLOW_UP","WON","LOST"];
        const stage=stages.includes(payload?.stage)?payload.stage:"NEW";
        const task=await prisma.task.create({
            data:{userId,source:"AGENT",priority:"MEDIUM",status:"TODO",
              title:instruction.replace(/\s+/g," ").slice(0,110),
              description:instruction,tags:[key],
              metadata:{agentKey:key,company:opt(payload?.company),
                client:opt(payload?.client),contact:opt(payload?.contact),
                project:opt(payload?.project),stage,resultStatus:"QUEUED",
                submittedAt:new Date().toISOString()}}
        });
        // Requests only queue a job; expensive AI work runs in the worker.
        await prisma.agent.updateMany({
          where:{id:agent.id,userId,enabled:true,NOT:{status:"RUNNING"}},
          data:{status:"IDLE",nextRunAt:new Date()}
        });
        return task;
    }

    async changeAssignmentStage(userId,key,id,stage){
        const def=getAgentDefinition(key);
        if(!def||def.mode!=="TASK_DRAFT"||
          !["NEW","QUALIFIED","PROPOSAL","FOLLOW_UP","WON","LOST"].includes(stage))
            throw Error("Nieprawidłowy etap sprawy.");
        const task=await prisma.task.findFirst({where:{userId,id,source:"AGENT"}});
        if(!task||task.metadata?.agentKey!==key)throw Error("Zlecenie nie istnieje.");
        const result=await prisma.task.updateMany({
          where:{userId,id,source:"AGENT"},
          data:{metadata:{...task.metadata,stage}}
        });
        if(result.count!==1)throw Error("Nie można zmienić etapu.");
        return{id,stage};
    }

    async listIntegrations(userId) {
        await this.ensureDefaults(userId);

        return prisma.integration.findMany({
            where: { userId },
            orderBy: { createdAt: "asc" }
        });
    }

    async setIntegrationEnabled(
        userId,
        id,
        enabled
    ) {
        if (typeof enabled !== "boolean") {
            throw new Error("Pole enabled musi mieć wartość true lub false.");
        }

        const integration =
            await prisma.integration.findFirst({
                where: { id, userId }
            });

        if (!integration) {
            throw new Error(
                "Integracja nie istnieje."
            );
        }

        // A legacy or misconfigured shared mailbox must not be enabled
        // by a user who is not its explicitly authorized owner.
        if (enabled && integration.type === "MAIL" &&
            integration.provider === "HOME_PL" &&
            !canSyncMailIntegration(userId, integration)) {
            throw new Error("Brak uprawnień do włączenia tej skrzynki pocztowej.");
        }

        return prisma.integration.update({
            where: { id },
            data: {
                enabled: Boolean(enabled),
                // An explicit user choice overrides automatic setup.
                config: {
                    ...integration.config,
                    autoEnablePending: false
                }
            }
        });
    }
}

module.exports = AgentService;
