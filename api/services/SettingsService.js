const prisma = require("../../lib/prisma");
const ALLOWED_MODELS = new Set(["gpt-5.5","gpt-6.1-sol","gpt-6.1-terra","gpt-6-astra","gpt-6-luna"]);

class SettingsService {

    async get(userId) {

        return prisma.userSettings.upsert({

            where: {
                userId
            },

            update: {},

            create: {
                userId
            }

        });

    }

    async update(userId, data) {

        if (!data || !ALLOWED_MODELS.has(data.aiModel)) {
            throw new Error("Wybierz obsługiwany model AI.");
        }


        return prisma.userSettings.upsert({

            where: {
                userId
            },

            update: {

                memoryEnabled:
                    data.memoryEnabled,

                historyEnabled:
                    data.historyEnabled,

                executiveMode:
                    data.executiveMode,

                aiModel:
                    data.aiModel

            },

            create: {

                userId,

                memoryEnabled:
                    data.memoryEnabled ?? true,

                historyEnabled:
                    data.historyEnabled ?? true,

                executiveMode:
                    data.executiveMode ?? true,

                aiModel:
                    data.aiModel || "gpt-5.5"

            }

        });

    }

}

module.exports = new SettingsService();