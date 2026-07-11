const AgentRegistry = require("../core/registry/AgentRegistry");

const registry = new AgentRegistry();

registry.register("MEETING", {});
registry.register("LEGAL", {});
registry.register("SHOPPING", {});

console.log(registry.list());

console.log(registry.has("MEETING"));
console.log(registry.has("FINANCE"));

console.log(registry.get("LEGAL"));