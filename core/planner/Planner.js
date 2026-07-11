class Planner {

    createPlan(intent) {

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

            default:
                return [
                    {
                        agent: "GENERAL",
                        action: "chat"
                    }
                ];

        }

    }

}

module.exports = Planner;