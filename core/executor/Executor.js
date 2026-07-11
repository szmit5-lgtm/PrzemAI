class Executor {

    constructor(registry) {

        this.registry = registry;

    }

    async execute(plan, input) {

        let result = input;

        for (const step of plan) {

            const agent = this.registry.get(step.agent);

            if (!agent) {
                throw new Error(`Agent ${step.agent} nie został zarejestrowany.`);
            }

            if (typeof agent[step.action] !== "function") {
                throw new Error(
                    `Agent ${step.agent} nie posiada metody ${step.action}().`
                );
            }

            result = await agent[step.action](result);

        }

        return result;

    }

}

module.exports = Executor;