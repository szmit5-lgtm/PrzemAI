"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { relevantMemories } = require("../lib/aiContext");

test("chat retrieves Polish keyword matches ahead of unrelated memories", () => {
  const rows = [
    { title: "Preferowany styl", content: "Krótkie odpowiedzi" },
    { title: "Przegląd", content: "Żółkiew i projekty szkolne" },
    { title: "Żółkiew", tags: ["modernizacja"], content: "Notatka" }
  ];
  assert.deepEqual(relevantMemories(rows, "Zolkiew: modernizacja"), [rows[2], rows[1], rows[0]]);
  assert.deepEqual(relevantMemories(rows, "co?"), rows);
  assert.deepEqual(relevantMemories(rows, "całkowicie nieznane"), rows);
  assert.equal(rows[0].title, "Preferowany styl");
});
