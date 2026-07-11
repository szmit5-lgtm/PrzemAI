class AgentRegistry {

    constructor() {
        this.agents = new Map();
    }

    register(name, agent) {
        this.agents.set(name.toUpperCase(), agent);
    }

    get(name) {

        const agent = this.agents.get(name.toUpperCase());

        if (!agent) {
            throw new Error(`Agent '${name}' nie jest zarejestrowany.`);
        }

        return agent;
    }

    list() {
        return [...this.agents.keys()];
    }

}

module.exports = AgentRegistry;