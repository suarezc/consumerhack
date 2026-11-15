import assert from "node:assert/strict";
import { test } from "node:test";

import { createWateringObserver } from "../src/services/watering.ts";

const paid = (id) => ({ id, fruitId: id, revision: 1 });

test("hydration baselines confirmed history without replaying an event", () => {
  const observer = createWateringObserver();
  assert.equal(observer.observe("tree:day", ["paid-1", "paid-2"], paid("paid-2")), null);
  assert.equal(observer.observe("tree:day", ["paid-1", "paid-2"], paid("paid-2")), null);
});

test("only a new server event with a confirmed fruit emits once", () => {
  const observer = createWateringObserver();
  observer.observe("tree:day", ["paid-1"], paid("paid-1"));
  assert.equal(observer.observe("tree:day", ["paid-1", "paid-2"], null), null);
  assert.deepEqual(observer.observe("tree:day", ["paid-1", "paid-2"], paid("paid-2")), paid("paid-2"));
  assert.equal(observer.observe("tree:day", ["paid-1", "paid-2"], paid("paid-2")), null);
});

test("day-key remounts and disappearing ids never replay consumed events", () => {
  const observer = createWateringObserver();
  observer.observe("tree:day-a", [], null);
  observer.observe("tree:day-a", ["paid-1"], paid("paid-1"));
  assert.equal(observer.observe("tree:day-b", ["paid-1", "paid-2"], paid("paid-2")), null);
  assert.equal(observer.observe("tree:day-a", [], null), null);
  assert.equal(observer.observe("tree:day-a", ["paid-1", "paid-2"], paid("paid-2")), null);
  assert.deepEqual(observer.observe("tree:day-b", ["paid-3"], paid("paid-3")), paid("paid-3"));
});

test("a reload baselines current facts instead of restoring an animation", () => {
  const observer = createWateringObserver();
  observer.observe("tree:day", [], null);
  observer.observe("tree:day", ["paid-1"], paid("paid-1"));
  assert.equal(createWateringObserver().observe("tree:day", ["paid-1"], paid("paid-1")), null);
});

test("same-count replacements use ids rather than a frontend count", () => {
  const observer = createWateringObserver();
  observer.observe("tree:day", ["paid-1"], paid("paid-1"));
  assert.deepEqual(observer.observe("tree:day", ["paid-2"], paid("paid-2")), paid("paid-2"));
  assert.equal(observer.observe("tree:day", ["paid-2"], paid("paid-2")), null);
});

test("events without a confirmed fruit and unsupported payload revisions do not react", () => {
  const observer = createWateringObserver();
  observer.observe("tree:day", [], null);
  assert.equal(observer.observe("tree:day", [], paid("paid-1")), null);
  assert.equal(observer.observe("tree:day", ["paid-1"], { ...paid("paid-1"), revision: 2 }), null);
  assert.deepEqual(observer.observe("tree:day", ["paid-1"], paid("paid-1")), paid("paid-1"));
});
