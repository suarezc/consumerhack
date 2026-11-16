import assert from "node:assert/strict";
import { test } from "node:test";

import { firstOpenView } from "../src/services/ritual.ts";
import { createDemoWateringIntent } from "../src/services/watering.ts";

test("intro waits for matching authoritative day snapshots", () => {
  const intro = { todayDayId: "day-a", shouldShowYesterday: true, yesterday: { dayId: "previous" } };
  assert.equal(firstOpenView(undefined, intro), "loading");
  assert.equal(firstOpenView("day-a", undefined), "loading");
  assert.equal(firstOpenView("day-a", null), "loading");
  assert.equal(firstOpenView("day-b", intro), "loading");
});

test("reading and reloading cannot consume yesterday; only server acknowledgement dismisses it", () => {
  const intro = { todayDayId: "day-a", shouldShowYesterday: true, yesterday: { dayId: "previous" } };
  for (let i = 0; i < 3; i++) assert.equal(firstOpenView("day-a", structuredClone(intro)), "yesterday");
  assert.equal(firstOpenView("day-a", { ...intro, shouldShowYesterday: false }), "today");
  assert.equal(firstOpenView("day-a", { ...intro, yesterday: null }), "today");
  assert.equal(firstOpenView("new-demo-run", { ...intro, todayDayId: "new-demo-run" }), "yesterday");
});

test("the next ritual day waits for fresh authority instead of carrying yesterday's acknowledgement", () => {
  const acknowledged = { todayDayId: "day-a", shouldShowYesterday: false, yesterday: {} };
  assert.equal(firstOpenView("day-b", acknowledged), "loading");
  assert.equal(firstOpenView("day-b", { ...acknowledged, todayDayId: "day-b", shouldShowYesterday: true }), "yesterday");
});

test("demo mutation retries reuse their intent key and a new interaction gets a fresh key", () => {
  let keys = 0;
  const intent = createDemoWateringIntent(() => `request-${++keys}`);
  const first = intent.forBundles(5);
  assert.equal(intent.forBundles(5), first);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(keys, 1);
  intent.reset();
  assert.notEqual(intent.forBundles(5).requestId, first.requestId);
  assert.equal(keys, 2);
});

test("changed bundles never reuse an incompatible demo mutation key", () => {
  let keys = 0;
  const intent = createDemoWateringIntent(() => `request-${++keys}`);
  const two = intent.forBundles(2);
  const ten = intent.forBundles(10);
  assert.notEqual(ten.requestId, two.requestId);
  assert.equal(ten.bundles, 10);
  assert.equal(intent.forBundles(10), ten);
  assert.notEqual(intent.forBundles(2).requestId, two.requestId);
});
