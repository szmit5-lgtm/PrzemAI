"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ui = fs.readFileSync(path.join(__dirname, "../frontend/src/app/agents/[key]/page.js"), "utf8");
const api = fs.readFileSync(path.join(__dirname, "../api/services/AgentService.js"), "utf8");

test("agent follow-up panel is visible above results for Sales Agent even before answer", () => {
  assert.match(ui, /id="agent-reply-panel"/);
  assert.match(ui, /Odpowiedz Agentowi Sprzedaży/);
  assert.match(ui, /Brak zakończonej odpowiedzi — agent jeszcze pracuje/);
  assert.ok(ui.indexOf('id="agent-reply-panel"') < ui.indexOf('Wyniki są szkicami do zatwierdzenia'));
});

test("reply panel chooses a real DONE/ERROR assignment and uses the existing guarded endpoint", () => {
  assert.match(ui, /tasks\.filter\(t=>\["DONE","ERROR"\]\.includes\(t\.status\)\)/);
  assert.match(ui, /replyableTasks\.find\(t=>t\.id===replyTargetId\)/);
  assert.match(ui, /onSubmit=\{event=>\{[\s\S]*?if\(currentReplyTarget\)sendReply\(event,currentReplyTarget\)/);
  assert.match(ui, /disabled=\{!currentReplyTarget\|\|!!agent\.enabled\|\|!!replyBusy/);
  assert.match(ui, /replyToAgentAssignment\(key,task\.id,text\)/);
  assert.match(api, /if\(!\["DONE","ERROR"\]\.includes\(task\.status\)\)/);
});

test("follow-up does not claim to send to client or expose agent draft as sent", () => {
  assert.match(ui, /nie jest wysyłana do klienta/);
  assert.match(ui, /Wyniki są szkicami do zatwierdzenia/);
  assert.match(ui, /agent\.enabled/);
});
