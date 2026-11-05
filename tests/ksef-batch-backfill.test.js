"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { syncKsefOwner } = require("../connectors/ksef/syncKsefOwner");
const fakeInvoice = { ksefNumber: "1234567890-20261105-AAAAAAAAAAAA-BB" };

test("five historical periods are processed in one run and cursor advances each time", async () => {
  const calls = [];
  const prisma = {
    agent: {
      async findUnique() { return { config: {} }; },
      async update(args) { calls.push({ type: "checkpoint", cursor: args.data.config.ksefBackfillCursor }); }
    },
    project: { async findMany() { return []; } },
    financialDocument: {
      async create() { },
      async findMany() { return []; },
      async updateMany() { return { count: 1 }; }
    }
  };
  class FakeClient {
    async *iterateInvoiceMetadata({ subjectType, from, to }) {
      calls.push({ type: "query", subjectType, from, to });
      yield [fakeInvoice];
    }
  }
  const result = await syncKsefOwner({
    userId: "owner", prisma, nip: "1234567890", token: "configured",
    now: new Date("2026-11-05T19:00:00Z"),
    historyWindowsPerRun: 5,
    authorize: async () => "access-token", Client: FakeClient
  });
  assert.equal(result.historyComplete,true);
  assert.equal(result.historicalWindows,5);
  assert.equal(result.created,12);
  const checkpoints = calls.filter(x=>x.type==="checkpoint");
  assert.equal(checkpoints.length,5);
  assert.equal(checkpoints[0].cursor,"2026-04-02T00:00:00.000Z");
  assert.equal(checkpoints.at(-1).cursor,"2026-11-04T19:00:00.000Z");
  assert.equal(calls.filter(x=>x.type==="query").length,12);
});

test("XML downloads query null-only records rather than being limited to recent invoices",async()=>{
  const queries=[];
  const updates=[];
  const prisma={
    agent:{async findUnique(){return null;}},
    financialDocument:{
      async create(){},
      async findMany(args){
        queries.push(args);
        if(args.where.rawData?.equals) return [{
          id:"old", ksefNumber:fakeInvoice.ksefNumber,
          metadata:{}, projectId:null,dueDate:null
        }];
        return [];
      },
      async updateMany(args){updates.push(args);return {count:1};}
    }
  };
  class Client{
    async *iterateInvoiceMetadata(){yield [];}
    async getInvoiceXml(){return "<Faktura><Fa><FaWiersz><P_7>Materiał</P_7></FaWiersz></Fa></Faktura>";}
  }
  const result=await syncKsefOwner({
    userId:"owner",prisma,nip:"1234567890",token:"configured",
    authorize:async()=> "ok",Client
  });
  assert.equal(result.xmlFetched,1);
  assert.ok(queries.some(x=>x.where.rawData?.equals));
  assert.ok(updates.some(x=>x.data.metadata?.analysis?.description==="Materiał"));
});
