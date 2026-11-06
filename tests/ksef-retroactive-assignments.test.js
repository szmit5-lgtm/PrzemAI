"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { Prisma } = require("@prisma/client");
const { syncKsefOwner } = require("../connectors/ksef/syncKsefOwner");

const projectA = { id: "m", name: "Mielno", company: "Dekonica", aliases: ["budowa Mielno"], status: "ACTIVE" };
const projectB = { id: "z", name: "Zgorzelec", company: "Dekonica", aliases: ["Zgorzelec CO"], status: "ACTIVE" };
function invoice(id, text, metadata = {}, projectId = null) {
  return {
    id, projectId, dueDate: null, metadata,
    rawData: { xml: "<Faktura><Fa><FaWiersz><P_7>" + text + "</P_7></FaWiersz></Fa></Faktura>" }
  };
}
test("already imported KSeF XML is assigned across pages without changing manual decisions", async () => {
  const docs = Array.from({length: 85}, (_, i) =>
    invoice(String(i).padStart(3, "0"), "Montaż instalacji Mielno"));
  docs[10] = invoice("010", "Instalacja Mielno", {
    analysis: { version: 1, projectDecision: "MANUAL" }
  }, "custom-project");
  docs[11] = invoice("011", "Materiały Mielno oraz Zgorzelec");
  docs[12] = invoice("012", "Materiały ogólne");
  docs[13] = invoice("013", "Prace Zgorzelec");
  const writes = [];
  const queries = [];
  const prisma = {
    agent: { async findUnique(){return null;} },
    project: { async findMany(){return [projectA,projectB];} },
    financialDocument: {
      async create(){},
      async findMany(args) {
        queries.push(args);
        if (args.where.rawData?.equals === Prisma.DbNull) return [];
        if (args.where.rawData?.not === Prisma.DbNull) {
          const index = args.cursor ? docs.findIndex(x=>x.id===args.cursor.id)+1 : 0;
          return docs.slice(index,index+(args.take||40));
        }
        return [];
      },
      async updateMany(args) { writes.push(args); return { count: 1 }; }
    }
  };
  class Client {
    async *iterateInvoiceMetadata() { yield []; }
    async getInvoiceXml() { throw new Error("not called"); }
  }
  const result = await syncKsefOwner({
    userId:"owner",prisma,token:"configured",nip:"1234567890",
    authorize:async()=>"access-token",Client,
    now:new Date("2026-11-05T19:00:00Z")
  });
  assert.equal(result.projectAssigned,82);
  assert.equal(result.projectReview,2);
  assert.equal(result.projectErrors,0);
  assert.equal(result.projectDescribed,84);
  assert.ok(queries.filter(x=>x.where.rawData?.not === Prisma.DbNull).length >= 3);
  assert.ok(writes.every(x=>x.where.userId==="owner" && x.where.source==="KSEF"));
  assert.equal(writes.some(x=>x.where.id==="010"),false);
  assert.equal(writes.find(x=>x.where.id==="011").data.projectId,undefined);
  assert.equal(writes.find(x=>x.where.id==="011").data.metadata.analysis.projectDecision,"AMBIGUOUS");
  assert.equal(writes.find(x=>x.where.id==="013").data.projectId,"z");
  assert.ok(writes.every(x=>x.data.metadata.analysis.version===3));
});
