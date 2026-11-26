"use strict";

// Local validation when the Prisma native engine download is unavailable.
// Keep the project's schema and dependency manifests intact.
const path = require("node:path");
const { readFile, writeFile } = require("node:fs/promises");

const root = path.resolve(__dirname, "..");
const tools = process.env.PRZEMAI_E2E_PRISMA_TOOLS;
if (!tools || !path.isAbsolute(tools)) throw new Error("Set PRZEMAI_E2E_PRISMA_TOOLS to an absolute path.");

function prismaPackage(name) {
  const packageRoot = path.join(tools, "node_modules", "@prisma", name);
  const expected = require("@prisma/client/package.json").version;
  if (require(path.join(packageRoot, "package.json")).version !== expected) {
    throw new Error("@prisma/" + name + " must match @prisma/client " + expected);
  }
  return require(packageRoot);
}

async function generate() {
  const { getGenerators } = prismaPackage("internals");
  const source = await readFile(path.join(root, "prisma", "schema.prisma"), "utf8");
  const schemaPath = path.join(tools, "schema.prisma");
  const provider = 'provider = "prisma-client-js"';
  if (!source.includes(provider)) throw new Error("Unexpected Prisma generator configuration.");
  const output = path.join(root, "node_modules", ".prisma", "client");
  const schema = source.replace(provider,
    provider + '\n  engineType = "client"\n  output = ' + JSON.stringify(output));
  await writeFile(schemaPath, schema);
  const generators = await getGenerators({
    schemaPath,
    skipDownload: true,
    registry: { "prisma-client-js": { type: "rpc", isNode: true,
      generatorPath: require.resolve("@prisma/client/generator-build/index.js") } }
  });
  try {
    for (const generator of generators) await generator.generate();
  } finally {
    for (const generator of generators) generator.stop();
  }
}

if (require.main === module) {
  generate().catch(error => { console.error(error.message); process.exitCode = 1; });
} else {
  const url = new URL(process.env.DATABASE_URL);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" ||
      !/^\/przemai_p0_e2e_[a-z0-9_]+$/.test(url.pathname)) {
    throw new Error("Only an isolated local P0 E2E database is allowed.");
  }
  const { PrismaPg } = prismaPackage("adapter-pg");
  const { PrismaClient } = require("@prisma/client");
  global.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) });
}
