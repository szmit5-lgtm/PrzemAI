const MemoryEngine = require("../core/memory/MemoryEngine");

const memory = new MemoryEngine();

memory.save("name", "Przemek");
memory.save("company", "PrzemAI");

console.log(memory.get("name"));
console.log(memory.get("company"));

console.log(memory.getAll());