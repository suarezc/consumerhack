import assert from "node:assert/strict";
import { test } from "node:test";
import { createGivingObserver } from "../src/services/giving.ts";

const payment = (id, lightBundles = 5) => ({ id, revision: 2, lightBundles });
function observer() {
  let baseline = 0;
  return createGivingObserver(() => `baseline-${++baseline}`);
}

test("hydrated payments and total-only history updates do not celebrate", () => {
  const store = observer();
  store.observe("tree:day", 24, payment("existing"), 3, false);
  store.observe("tree:day", 24, payment("existing"), 3, false);
  store.observe("tree:day", 29, null, 4, false);
  assert.equal(store.getSnapshot().treeEvent, null);
  assert.equal(store.getSnapshot().feedbackEvent, null);
});

test("one payment forwards its own light quantity, never the day's total or response fruit", () => {
  const store = observer();
  store.observe("tree:day", 24, null, 3, true);
  const event = payment("new-payment", 5);
  store.observe("tree:day", 29, event, 4, true);
  assert.deepEqual(store.getSnapshot().treeEvent, event);
  assert.deepEqual(store.getSnapshot().feedbackEvent, { id: "new-payment", baselineId: "baseline-1", givingCount: 4, isDemo: true });
  assert.equal(Object.isFrozen(store.getSnapshot().treeEvent), true);
  event.lightBundles = 10;
  assert.equal(store.getSnapshot().treeEvent.lightBundles, 5);
  assert.equal("fruitIds" in store.getSnapshot().treeEvent, false);
});

test("text acknowledgement cannot consume the light flourish or replay a payment", () => {
  const store = observer();
  store.observe("tree:day", 0, null, 3, false);
  store.observe("tree:day", 5, payment("paid"), 4, false);
  const lights = store.getSnapshot().treeEvent;
  store.consumeFeedback("paid");
  store.observe("tree:day", 5, payment("paid"), 4, false);
  assert.equal(store.getSnapshot().treeEvent, lights);
  assert.equal(store.getSnapshot().feedbackEvent, null);
});

test("distinct same-day payments can retain the same giving count", () => {
  const store = observer();
  store.observe("tree:day", 0, null, 3, false);
  store.observe("tree:day", 2, payment("first", 2), 4, false);
  store.observe("tree:day", 12, payment("second", 10), 4, false);
  assert.equal(store.getSnapshot().treeEvent.lightBundles, 10);
  assert.equal(store.getSnapshot().feedbackEvent.id, "second");
  assert.equal(store.getSnapshot().feedbackEvent.givingCount, 4);
});

test("a legacy 200-bundle settlement reaches both independent consumers once", () => {
  const store = observer();
  store.observe("tree:day", 24, null, 3, false);
  store.observe("tree:day", 224, payment("legacy", 200), 4, false);
  assert.equal(store.getSnapshot().treeEvent.lightBundles, 200);
  assert.equal(store.getSnapshot().feedbackEvent.id, "legacy");
  store.consumeFeedback("legacy");
  store.observe("tree:day", 224, payment("legacy", 200), 4, false);
  assert.equal(store.getSnapshot().feedbackEvent, null);
});

test("unconfirmed quantities and invalid payloads wait without consuming the payment ID", () => {
  const store = observer();
  store.observe("tree:day", 0, null, 3, false);
  for (const lightBundles of [0, -1, 2.5, NaN, 201]) store.observe("tree:day", 500, payment("paid", lightBundles), 4, false);
  store.observe("tree:day", 4, payment("paid", 5), 4, false);
  store.observe("tree:day", 5, { ...payment("paid"), revision: 3 }, 4, false);
  assert.equal(store.getSnapshot().treeEvent, null);
  store.observe("tree:day", 5, payment("paid"), 4, false);
  assert.equal(store.getSnapshot().treeEvent.id, "paid");
});

test("context changes and resets silently rebaseline old light events", () => {
  const store = observer();
  store.observe("tree:a", 0, null, 3, false);
  store.observe("tree:a", 5, payment("paid"), 4, false);
  store.observe("tree:b", 5, payment("paid"), 4, false);
  assert.equal(store.getSnapshot().treeEvent, null);
  assert.equal(store.getSnapshot().baselineId, "baseline-2");
  store.reset();
  store.observe("tree:a", 5, payment("paid"), 4, false);
  assert.equal(store.getSnapshot().feedbackEvent, null);
});

test("invalid giving count suppresses text without changing confirmed light facts", () => {
  const store = observer();
  store.observe("tree:day", 0, null, 3, false);
  store.observe("tree:day", 5, payment("paid"), NaN, false);
  assert.equal(store.getSnapshot().treeEvent.lightBundles, 5);
  assert.equal(store.getSnapshot().feedbackEvent, null);
});
