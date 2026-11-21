"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../api/routes/organizationDocumentRoutes.js"), "utf8");
const schema = fs.readFileSync(path.join(__dirname, "../prisma/schema.prisma"), "utf8");
const companyPage = fs.readFileSync(path.join(__dirname, "../frontend/src/app/company/[id]/page.js"), "utf8");

function harness({ role = "OWNER", persisted = null, count = 0, totalSize = 0 } = {}) {
  const routes = { get: {}, post: {}, use: [] };
  const membershipCalls = [], calls = { list: [], aggregate: [], create: [], download: [] };
  const prisma = {
    organizationDocument: {
      findMany: async options => { calls.list.push(options); return []; },
      aggregate: async options => { calls.aggregate.push(options); return { _count: { _all: count }, _sum: { size: totalSize } }; },
      findFirst: async options => {
        if (options.select.id) return null;
        calls.download.push(options);
        return persisted;
      },
      create: async options => {
        calls.create.push(options);
        return { id: "d1", name: options.data.name, size: options.data.size };
      }
    }
  };
  class OrganizationError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }
  class OrganizationService {
    async membership(userId, orgId, roles) {
      membershipCalls.push({ userId, orgId, roles });
      if (role === "NONE" || !roles.includes(role)) throw new OrganizationError("Brak dostępu do firmy.", 403);
    }
  }
  const router = {
    use(fn) { routes.use.push(fn); },
    get(name, fn) { routes.get[name] = fn; },
    post(name, fn) { routes.post[name] = fn; }
  };
  const multer = () => ({ single: () => (_req, _res, next) => next() });
  multer.memoryStorage = () => ({});
  const dependencies = {
    express: { Router: () => router },
    multer,
    "node:crypto": require("node:crypto"),
    "node:path": path,
    "../../lib/prisma": prisma,
    "../services/OrganizationService": { OrganizationService, OrganizationError }
  };
  const context = { module: { exports: {} }, require(name) {
    assert.ok(Object.hasOwn(dependencies, name), "unexpected require " + name);
    return dependencies[name];
  }, Buffer, TextDecoder, encodeURIComponent };
  vm.runInNewContext(source, context, { filename: "organizationDocumentRoutes.js" });
  return { router, routes, calls, membershipCalls };
}
function request(organizationId = "orgA", documentId = "doc1") {
  return { params: { id: organizationId, documentId }, user: { id: "user1" } };
}
function response() {
  return { code: 200, headers: {}, body: null, status(code) { this.code = code; return this; },
    json(payload) { this.body = payload; return this; },
    set(payload) { this.headers = payload; return this; },
    send(body) { this.body = body; return this; } };
}
async function authorized(h, req, res) {
  let next = false;
  await h.routes.use[0](req, res, () => { next = true; });
  return next;
}

test("company library persists original bytes in isolated OrganizationDocument model", () => {
  assert.match(schema, /model OrganizationDocument \{/);
  assert.match(schema, /organizationId String/);
  assert.match(schema, /content\s+Bytes/);
  assert.match(schema, /@@unique\(\[organizationId, sha256\]\)/);
  assert.match(companyPage, /<CompanyDocuments organizationId=\{id\}/);
  assert.match(companyPage, /tab==="documents"&&isAdmin/);
});

test("list rejects nonmembers and ordinary members before hitting document table", async () => {
  for (const role of ["NONE", "MEMBER"]) {
    const h = harness({ role }), req = request(), res = response();
    assert.equal(await authorized(h, req, res), false);
    assert.equal(res.code, 403);
    assert.equal(h.calls.list.length, 0);
  }
});

test("active owner and admin list only their selected company's metadata, no bytes", async () => {
  for (const role of ["OWNER", "ADMIN"]) {
    const h = harness({ role }), req = request("orgB"), res = response();
    assert.equal(await authorized(h, req, res), true);
    await h.routes.get["/"](req, res);
    assert.equal(res.body.success, true);
    assert.equal(h.calls.list[0].where.organizationId, "orgB");
    assert.equal(h.calls.list[0].select.content, undefined);
    assert.equal(h.membershipCalls[0].userId, "user1");
  }
});

test("upload validates PDF magic bytes, stores owner and organization id without leaking content", async () => {
  const h = harness(), req = request("orgB"), res = response();
  req.file = { originalname: "akta.pdf", buffer: Buffer.from("%PDF-1.7\nhello"), size: 14 };
  assert.equal(await authorized(h, req, res), true);
  await h.routes.post["/"](req, res);
  assert.equal(res.code, 201);
  assert.equal(h.calls.create[0].data.organizationId, "orgB");
  assert.equal(h.calls.create[0].data.uploadedById, "user1");
  assert.deepEqual(Buffer.from(h.calls.create[0].data.content), req.file.buffer);
  assert.equal(Object.hasOwn(res.body.item, "content"), false);
});

test("malformed PDF is rejected before any database write", async () => {
  const h = harness(), req = request(), res = response();
  req.file = { originalname: "fake.pdf", buffer: Buffer.from("evil file"), size: 9 };
  await h.routes.post["/"](req, res);
  assert.equal(res.code, 400);
  assert.equal(h.calls.create.length, 0);
});

test("upload quota rejects storage overflow without creating document", async () => {
  const h = harness({ count: 120 }), req = request(), res = response();
  req.file = { originalname: "a.txt", buffer: Buffer.from("hello"), size: 5 };
  await h.routes.post["/"](req, res);
  assert.equal(res.code, 413);
  assert.equal(h.calls.create.length, 0);
});

test("download queries both orgId and documentId and sends attachment safely", async () => {
  const h = harness({ persisted: { name: "umowa.pdf", content: Buffer.from("%PDF-1.7\n"), size: 9 } });
  const req = request("orgB", "doc-321"), res = response();
  assert.equal(await authorized(h, req, res), true);
  await h.routes.get["/:documentId/download"](req, res);
  assert.equal(res.code, 200);
  assert.equal(h.calls.download[0].where.organizationId, "orgB");
  assert.equal(h.calls.download[0].where.id, "doc-321");
  assert.match(res.headers["Content-Disposition"], /^attachment;/);
  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(res.headers["Cache-Control"], "private, no-store");
});

test("document from another company returns 404", async () => {
  const h = harness(), res = response(), req = request("orgB", "other-id");
  await h.routes.get["/:documentId/download"](req, res);
  assert.equal(res.code, 404);
});
