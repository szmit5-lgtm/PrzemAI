const AgentService = require("../services/AgentService");

class AgentController {
    constructor() {
        this.service = new AgentService();
    }

    async list(req, res) {
        try {
            const data =
                await this.service.list(
                    req.user.id
                );

            res.json({
                success: true,
                data
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: "Nie udało się pobrać danych agentów."
            });
        }
    }

    async runNow(req, res) {
        try {
            const data =
                await this.service.runNow(
                    req.user.id,
                    req.params.id
                );

            res.json({
                success: true,
                data
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async setEnabled(req, res) {
        try {
            const data =
                await this.service.setEnabled(
                    req.user.id,
                    req.params.id,
                    req.body.enabled
                );

            res.json({
                success: true,
                data
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async assignments(req,res){
        try{const data=await this.service.listAssignments(req.user.id,req.params.key);
          return res.json({success:true,data});
        }catch(error){return res.status(400).json({success:false,error:error.message});}
    }
    async createAssignment(req,res){
        try{const data=await this.service.createAssignment(req.user.id,req.params.key,req.body||{});
          return res.status(201).json({success:true,data});
        }catch(error){return res.status(400).json({success:false,error:error.message});}
    }
    async changeAssignmentStage(req,res){
        try{const data=await this.service.changeAssignmentStage(req.user.id,req.params.key,
          req.params.taskId,req.body?.stage);
          return res.json({success:true,data});
        }catch(error){return res.status(400).json({success:false,error:error.message});}
    }
    async integrations(req, res) {
        try {
            const data =
                await this.service.listIntegrations(
                    req.user.id
                );

            res.json({
                success: true,
                data
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: "Nie udało się pobrać danych agentów."
            });
        }
    }

    async setIntegrationEnabled(
        req,
        res
    ) {
        try {
            const data =
                await this.service.setIntegrationEnabled(
                    req.user.id,
                    req.params.id,
                    req.body.enabled
                );

            res.json({
                success: true,
                data
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = AgentController;
