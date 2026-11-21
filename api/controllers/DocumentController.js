const fs = require("node:fs/promises");
const HistoryService = require("../services/HistoryService");
const DocumentService = require("../services/DocumentService");
const TaskService = require("../services/TaskService");

class DocumentController {

    async analyze(req, res) {

        try {

            if (!req.file) {

                return res.status(400).json({

                    success: false,

                    error: "Nie wybrano pliku."

                });

            }

            const report = await DocumentService.analyze(

                req.file.path

            );

            await HistoryService.create({

                title: req.file.originalname,

                filename: req.file.filename,

                type: "document",

                report,

                userId: req.user.id

            });

            // Document analysis is successful once the report is stored. A single
            // invalid AI-proposed task must not turn that success into HTTP 500.
            const taskCreation = { created: 0, failed: 0 };
            if (Array.isArray(report.actionItems)) {
                for (const item of report.actionItems) {
                    try {
                        await TaskService.create({
                            title: item.title,
                            description: item.description,
                            priority: item.priority || "MEDIUM",
                            dueDate: item.dueDate ?? null,
                            userId: req.user.id
                        });
                        taskCreation.created += 1;
                    } catch (error) {
                        taskCreation.failed += 1;
                        // Never send Prisma's raw query, user identifiers or
                        // analyzed document contents to the browser or logs.
                        console.error("[DocumentController] Task creation failed:", error?.code || error?.name || "Error");
                    }
                }
            }

            return res.json({

                success: true,

                filename: req.file.originalname,

                report,
                taskCreation,
                ...(taskCreation.failed > 0 ? {
                    warning: "Analiza dokumentu została zapisana, ale nie wszystkie zadania udało się utworzyć."
                } : {})

            });

        }
        catch (err) {

            return res.status(500).json({

                success: false,

                error: err.message

            });

        }
        finally {
            // Uploaded files are temporary; avoid accumulating documents on disk.
            if (req.file?.path) {
                await fs.unlink(req.file.path).catch((error) => {
                    console.error("[DocumentController] Upload cleanup failed:", error.code || error.name);
                });
            }
        }

    }

}

module.exports = DocumentController;