class Planner {

    createPlan(intent) {

        // Komenda pamięci
        if (
            intent.task === "MEMORY_SEARCH" ||
            intent.module === "MEMORY"
        ) {

            return [
                {
                    agent: "GENERAL",
                    action: "memory"
                }
            ];

        }

        switch (intent.task) {

            case "WRITE_EMAIL":

                return [
                    {
                        agent: "MAIL",
                        action: "write"
                    }
                ];

            case "SUMMARIZE_MEETING":

                return [
                    {
                        agent: "MEETING",
                        action: "summarize"
                    }
                ];

            case "SEARCH_PRODUCT":

                return [
                    {
                        agent: "SHOPPING",
                        action: "search"
                    }
                ];

            case "CHAT":
            default:

                return [
                    {
                        agent: "GENERAL",
                        action: "process"
                    }
                ];

        }

    }

}

module.exports = Planner;