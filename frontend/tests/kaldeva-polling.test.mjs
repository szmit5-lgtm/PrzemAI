import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { pollKaldevaJob } from "../src/lib/kaldevaPolling.mjs";

test("polls unchanged job states and a transient failure until completion", async () => {
  const responses = ["queued", "queued", "temporary error", "running", "running", "completed"];
  const jobs = [];
  const errors = [];
  let calls = 0;
  const stop = pollKaldevaJob({
    status: "queued",
    delay: 1,
    async load() {
      const status = responses[calls++];
      if (status === "temporary error") throw new Error(status);
      return { status };
    },
    onJob(job) { jobs.push(job.status); },
    onError(error) { errors.push(error.message); }
  });
  try {
    for (let attempt = 0; calls < responses.length && attempt < 200; attempt++) await delay(2);
    await delay(5);
    assert.equal(calls, responses.length);
    assert.deepEqual(jobs, ["queued", "queued", "running", "running", "completed"]);
    assert.deepEqual(errors, ["temporary error"]);
  } finally {
    stop();
  }
});

test("stopping the previous selection ignores an obsolete reply", async () => {
  let signal;
  let answer;
  let notified = false;
  const stop = pollKaldevaJob({
    status: "queued",
    load(s) { signal = s; return new Promise(resolve => { answer = resolve; }); },
    onJob() { notified = true; },
    onError() { notified = true; }
  });
  stop();
  answer({ status: "completed" });
  await delay(2);
  assert.equal(signal.aborted, true);
  assert.equal(notified, false);
});

test("an inaccessible job reports the error once and stops polling", async () => {
  let calls = 0;
  const errors = [];
  const stop = pollKaldevaJob({
    status: "running",
    delay: 1,
    async load() {
      calls++;
      throw Object.assign(new Error("Brak dostępu"), { status: 403 });
    },
    onJob() { assert.fail("Inaccessible job must not be published"); },
    onError(error) { errors.push(error.message); }
  });
  try {
    await delay(10);
    assert.equal(calls, 1);
    assert.deepEqual(errors, ["Brak dostępu"]);
  } finally {
    stop();
  }
});
