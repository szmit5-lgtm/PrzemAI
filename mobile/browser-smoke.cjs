"use strict";
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const { spawnSync } = require("node:child_process");
const { chromium } = require("playwright");

async function main() {
  const api = "https://api.example.test";
  const build = spawnSync(process.execPath, ["build.cjs"], {
    cwd: __dirname, env: { ...process.env, PRZEMAI_MOBILE_API_ORIGIN: api }, stdio: "inherit"
  });
  assert.equal(build.status, 0);
  const files = { "/": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"], "/app.css": ["app.css", "text/css"] };
  const server = createServer(async (request, response) => {
    const file = files[request.url];
    if (!file) return response.writeHead(404).end();
    response.writeHead(200, { "content-type": file[1] }).end(await readFile(__dirname + "/www/" + file[0]));
  }).listen(0, "127.0.0.1");
  let browser;
  try {
    await once(server, "listening");
    browser = await chromium.launch({
      executablePath: process.env.PRZEMAI_CHROMIUM || "/usr/bin/chromium", args: ["--no-sandbox"]
    });
    const page = await browser.newPage({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
    let chat;
    let denyDocuments = false;
    await page.route(api + "/api/**", async route => {
      const request = route.request();
      const url = new URL(request.url());
      const headers = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "authorization, content-type", "content-type": "application/json" };
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      let result;
      let status = 200;
      assert.equal(request.headers().authorization, url.pathname === "/api/auth/login" ? undefined : "Bearer synthetic");
      if (url.pathname === "/api/auth/login") result = { success: true, token: "synthetic" };
      else if (url.pathname === "/api/organizations") result = { data: [
        { id: "alpha", name: "Dekonica" }, { id: "beta", name: "Deherus" }
      ] };
      else if (url.pathname.includes("/invoice-dashboard/")) {
        const organizationId = url.searchParams.get("organizationId");
        result = { data: {
          organizationId, included: organizationId ? 1 : 2,
          year: Number(url.pathname.split("/").pop()),
          rows: [{ month: 1, direction: "OUTGOING", count: 1,
            net: organizationId === "beta" ? "25.00" : "100.00", gross: organizationId === "beta" ? "27.00" : "123.00" }]
        } };
      } else if (url.pathname.endsWith("/workspace")) result = { data: { tasks: [] } };
      else if (url.pathname === "/api/chat") {
        chat = request.postDataJSON();
        result = { conversationId: "demo-id", answer: "Wynik z lokalnej atrapy" };
      } else if (url.pathname.endsWith("/investments")) result = { data: { items: [{ id: "m", name: "Mielno", progress: 25 }] } };
      else if (url.pathname.endsWith("/investments/m")) result = { data: {
        investment: { description: "Inwestycja syntetyczna" }, tasks: [], reports: [], documents: [{ name: "Protokół.pdf" }]
      } };
      else if (url.pathname.endsWith("/documents")) {
        status = denyDocuments ? 401 : 200;
        result = { items: [{ name: "Dokument spółki", createdAt: "2026-10-01" }] };
      } else return route.abort();
      await route.fulfill({ status, headers, json: result });
    });
    const login = async () => {
      await page.getByLabel("E-mail").fill("demo@example.test");
      await page.getByLabel("Hasło").fill("synthetic");
      await page.getByRole("button", { name: "Zaloguj się" }).click();
      await page.getByRole("heading", { name: "Pulpit", exact: true }).waitFor();
    };
    await page.goto("http://127.0.0.1:" + server.address().port);
    await login();
    await page.getByText("100,00 zł netto").waitFor();
    await page.getByText("123,00 zł brutto").waitFor();
    await page.getByLabel("Spółka", { exact: true }).selectOption("beta");
    await page.getByText("25,00 zł netto").waitFor();
    await page.getByText("27,00 zł brutto").waitFor();
    await page.getByLabel("Okres faktur", { exact: true }).selectOption("m2");
    await page.getByRole("article").filter({ hasText: "Faktury sprzedażowe PLN" }).getByText("0,00 zł netto").waitFor();
    await page.getByRole("button", { name: "General Agent" }).click();
    await page.getByLabel("Wiadomość do General Agenta").fill("Pokaż zadania");
    await page.getByRole("button", { name: "Wyślij" }).click();
    await page.getByText("Wynik z lokalnej atrapy").waitFor();
    assert.equal(chat.organizationId, "beta");
    await page.getByRole("button", { name: "Inwestycje" }).click();
    await page.getByRole("button", { name: "Szczegóły" }).click();
    await page.getByText("Protokół.pdf").waitFor();
    await page.getByRole("button", { name: "Dokumenty", exact: true }).click();
    await page.getByText("Dokument spółki").waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []);
    await page.reload();
    await page.getByRole("heading", { name: "Zaloguj się" }).waitFor();
    await login();
    await page.getByLabel("Spółka", { exact: true }).selectOption("beta");
    denyDocuments = true;
    await page.getByRole("button", { name: "Dokumenty", exact: true }).click();
    await page.getByText("Sesja wygasła. Zaloguj się ponownie.").waitFor();
    assert.equal(await page.getByText("Dokument spółki").count(), 0);
    console.log("Mobile Chromium 360 px: login, volatile session, company scope, invoices, chat, investments, documents and 401 passed.");
  } finally {
    await browser?.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
