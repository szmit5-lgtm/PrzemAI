"use strict";
const { BrowserAccessPolicy } = require("./BrowserAccessPolicy");

/**
 * One short-lived, isolated context per agent task. Supply a hardened Chromium
 * browser from the worker runtime; never reuse the user's local Chrome profile.
 * This module is not a network security boundary: deploy behind an outbound
 * proxy/firewall that rejects private IP ranges and DNS rebinding.
 */
class AgentBrowserSession {
  constructor({ browser, policy, maxPages = 3 } = {}) {
    if (!browser || typeof browser.newContext !== "function") throw new Error("Browser runtime required");
    if (!(policy instanceof BrowserAccessPolicy)) throw new Error("Browser policy required");
    if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 5) throw new Error("Invalid page limit");
    this.browser = browser;
    this.policy = policy;
    this.maxPages = maxPages;
    this.context = null;
    this.pages = new Set();
    this.closed = false;
  }

  async start() {
    if (this.closed || this.context) throw new Error("Session unavailable");
    this.context = await this.browser.newContext({
      acceptDownloads: false,
      permissions: [],
      serviceWorkers: "block",
      javaScriptEnabled: false
    });
    // Restrict every request, including redirects and subresources. A separate
    // network egress policy is still mandatory before untrusted websites are opened.
    await this.context.route("**/*", async route => {
      try {
        this.policy.navigate(route.request().url());
        await route.continue();
      } catch {
        await route.abort("blockedbyclient");
      }
    });
    return this;
  }

  async open(url) {
    if (this.closed || !this.context) throw new Error("Session not started");
    const approvedUrl = this.policy.navigate(url);
    if (this.pages.size >= this.maxPages) throw new Error("Session page limit reached");
    const page = await this.context.newPage();
    this.pages.add(page);
    try {
      await page.goto(approvedUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      this.policy.navigate(page.url());
      return page;
    } catch (error) {
      this.pages.delete(page);
      await page.close().catch(() => {});
      throw error;
    }
  }

  async inspect(page) {
    if (this.closed || !this.pages.has(page)) throw new Error("Page does not belong to this session");
    this.policy.navigate(page.url());
    return { url: page.url(), title: await page.title() };
  }

  async closePage(page) {
    if (!this.pages.delete(page)) throw new Error("Page does not belong to this session");
    await page.close();
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    this.pages.clear();
    if (this.context) await this.context.close();
    this.context = null;
  }
}

module.exports = { AgentBrowserSession };
