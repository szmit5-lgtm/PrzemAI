"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {BrowserAccessPolicy} = require("../core/browser/BrowserAccessPolicy");
const {AgentBrowserSession} = require("../core/browser/AgentBrowserSession");

function mockBrowser() {
  const calls = { route: null, options: null, pages: [], closed: false };
  const context = {
    async route(glob, fn) { calls.route = fn; },
    async newPage() {
      const page = {
        location: "",
        closed: false,
        async goto(url) { this.location = url; },
        url() { return this.location; },
        async title() { return "Example"; },
        async close() { this.closed = true; }
      };
      calls.pages.push(page);
      return page;
    },
    async close() { calls.closed = true; }
  };
  return { calls, async newContext(options) { calls.options = options; return context; } };
}
const policy = () => new BrowserAccessPolicy({companyId:"dekonica",agentId:"allegro",allowedDomains:["allegro.pl"]});

test("session isolates browsing and blocks unapproved domains", async () => {
  const browser = mockBrowser();
  const session = new AgentBrowserSession({browser,policy:policy(),maxPages:1});
  await session.start();
  assert.equal(browser.calls.options.acceptDownloads,false);
  assert.equal(browser.calls.options.javaScriptEnabled,false);
  const page = await session.open("https://allegro.pl/oferta/123");
  assert.deepEqual(await session.inspect(page),{url:"https://allegro.pl/oferta/123",title:"Example"});
  await assert.rejects(session.open("https://other.example/"),/not approved/);
  await assert.rejects(session.open("https://allegro.pl/oferta/2"),/page limit/);
  const outcomes = [];
  await browser.calls.route({
    request(){ return {url(){return "https://allegro.pl/image.png";}}; },
    async continue(){outcomes.push("allowed");},
    async abort(){outcomes.push("blocked");}
  });
  await browser.calls.route({
    request(){ return {url(){return "http://169.254.169.254/latest/meta-data";}}; },
    async continue(){outcomes.push("allowed");},
    async abort(){outcomes.push("blocked");}
  });
  assert.deepEqual(outcomes,["allowed","blocked"]);
  await session.close();
  assert.equal(browser.calls.closed,true);
  await assert.rejects(session.open("https://allegro.pl"),/not started/);
});

test("session cannot be used without an authenticated company-bound policy", () => {
  assert.throws(() => new AgentBrowserSession({browser:mockBrowser()}),/policy/);
  assert.throws(() => new AgentBrowserSession({browser:mockBrowser(),policy:policy(),maxPages:10}),/limit/);
});
