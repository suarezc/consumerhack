import assert from "node:assert/strict";
import { test } from "node:test";

import { createWateringObserver } from "../src/services/watering.ts";

const paid = (id) => ({ id, fruitId: id, revision: 1 });
function observer() {
  let baseline = 0;
  return createWateringObserver(() => `baseline-${++baseline}`);
}

test("hydration baselines confirmed history without replaying an event", () => {
  const store = observer();
  store.observe("tree:day", ["paid-1", "paid-2"], paid("paid-2"), 3, false);
  assert.deepEqual(store.getSnapshot(), { contextId: "tree:day", baselineId: "baseline-1", treeEvent: null, feedbackEvent: null });
  store.observe("tree:day", ["paid-1", "paid-2"], paid("paid-2"), 3, false);
  assert.equal(store.getSnapshot().treeEvent, null);
});

test("one immutable server confirmation fans out to tree and giving text", () => {
  const store = observer();
  store.observe("tree:day", ["paid-1"], paid("paid-1"), 3, false);
  store.observe("tree:day", ["paid-1", "paid-2"], null, 4, false);
  assert.equal(store.getSnapshot().treeEvent, null);
  store.observe("tree:day", ["paid-1", "paid-2"], paid("paid-2"), 4, false);
  assert.deepEqual(store.getSnapshot().treeEvent, paid("paid-2"));
  assert.deepEqual(store.getSnapshot().feedbackEvent, { id: "paid-2", baselineId: "baseline-1", givingCount: 4, isDemo: false });
  assert.equal(Object.isFrozen(store.getSnapshot().treeEvent), true);
  assert.equal(Object.isFrozen(store.getSnapshot().feedbackEvent), true);
});

test("text acknowledgment cannot swallow the tree's independent dispatch", () => {
  const store = observer();
  store.observe("tree:day", [], null, 3, false);
  store.observe("tree:day", ["paid-1"], paid("paid-1"), 4, false);
  const treeEvent = store.getSnapshot().treeEvent;
  store.consumeFeedback("paid-1");
  assert.equal(store.getSnapshot().feedbackEvent, null);
  assert.equal(store.getSnapshot().treeEvent, treeEvent);
  store.observe("tree:day", ["paid-1"], paid("paid-1"), 4, false);
  assert.equal(store.getSnapshot().feedbackEvent, null);
});

test("same-context remounts preserve text ack and context switches rebaseline silently", () => {
  const store = observer();
  store.observe("tree:day-a", [], null, 3, false);
  store.observe("tree:day-a", ["paid-1"], paid("paid-1"), 4, false);
  store.consumeFeedback("paid-1");
  store.observe("tree:day-b", ["paid-1", "paid-2"], paid("paid-2"), 4, false);
  assert.equal(store.getSnapshot().baselineId, "baseline-2");
  assert.equal(store.getSnapshot().treeEvent, null);
  store.observe("tree:day-a", ["paid-1", "paid-2"], paid("paid-2"), 4, false);
  assert.equal(store.getSnapshot().baselineId, "baseline-3");
  assert.equal(store.getSnapshot().treeEvent, null);
});

test("reload and loading reset cannot restore historical feedback", () => {
  const store = observer();
  store.observe("tree:day", [], null, 3, false);
  store.observe("tree:day", ["paid-1"], paid("paid-1"), 4, false);
  store.reset();
  assert.equal(store.getSnapshot().baselineId, null);
  store.observe("tree:day", ["paid-1"], paid("paid-1"), 4, false);
  assert.equal(store.getSnapshot().treeEvent, null);
  const reloaded = observer();
  reloaded.observe("tree:day", ["paid-1"], paid("paid-1"), 4, false);
  assert.equal(reloaded.getSnapshot().feedbackEvent, null);
});

test("second same-day payment may repeat server giving count with a distinct id", () => {
  const store = observer();
  store.observe("tree:day", [], null, 3, true);
  store.observe("tree:day", ["paid-1"], paid("paid-1"), 4, true);
  store.observe("tree:day", ["paid-1", "paid-2"], paid("paid-2"), 4, true);
  store.consumeFeedback("paid-1");
  assert.equal(store.getSnapshot().feedbackEvent.id, "paid-2");
  assert.equal(store.getSnapshot().feedbackEvent.givingCount, 4);
  assert.equal(store.getSnapshot().feedbackEvent.isDemo, true);
});

test("missing confirmed fruits or unsupported payload revisions do not react", () => {
  const store = observer();
  store.observe("tree:day", [], null, 3, false);
  store.observe("tree:day", [], paid("paid-1"), 4, false);
  assert.equal(store.getSnapshot().treeEvent, null);
  store.observe("tree:day", ["paid-1"], { ...paid("paid-1"), revision: 2 }, 4, false);
  assert.equal(store.getSnapshot().treeEvent, null);
  store.observe("tree:day", ["paid-1"], paid("paid-1"), 4, false);
  assert.equal(store.getSnapshot().treeEvent.id, "paid-1");
});

test("historical backfill may reveal fruit without a fresh paid transition", () => {
  const store = observer();
  store.observe("tree:day", ["already-paid"], paid("already-paid"), 3, false);
  store.observe("tree:day", ["already-paid", "backfilled-row"], null, 3, false);
  assert.equal(store.getSnapshot().treeEvent, null);
  assert.equal(store.getSnapshot().feedbackEvent, null);
  store.observe("tree:day", ["already-paid", "backfilled-row"], paid("already-paid"), 3, false);
  assert.equal(store.getSnapshot().feedbackEvent, null);
  store.observe("tree:day", ["already-paid", "backfilled-row", "newly-confirmed"], paid("newly-confirmed"), 4, false);
  assert.equal(store.getSnapshot().feedbackEvent.id, "newly-confirmed");
});

test("invalid giving count never fabricates text but does not block verified tree facts", () => {
  const store = observer();
  store.observe("tree:day", [], null, 0, false);
  store.observe("tree:day", ["paid-1"], paid("paid-1"), NaN, false);
  assert.equal(store.getSnapshot().feedbackEvent, null);
  assert.equal(store.getSnapshot().treeEvent.id, "paid-1");
});

test("store subscribers observe updates and can unsubscribe", () => {
  const store = observer();
  let calls = 0;
  const unsubscribe = store.subscribe(() => { calls++; });
  store.observe("tree:day", [], null, 0, false);
  assert.equal(calls, 1);
  unsubscribe();
  store.observe("tree:day", ["paid-1"], paid("paid-1"), 1, false);
  assert.equal(calls, 1);
});

test("one payment dispatches all server bundle fruits and one giving notice", () => {
  const store = observer();
  store.observe("tree:day", [], null, 3, false);
  const fruitIds = ["payment-1:0", "payment-1:1", "payment-1:2", "payment-1:3", "payment-1:4"];
  const event = { id: "payment-1", fruitId: fruitIds[0], fruitIds, revision: 1 };
  store.observe("tree:day", fruitIds, event, 4, false);
  const snapshot = store.getSnapshot();
  assert.deepEqual(snapshot.treeEvent, event);
  assert.equal(snapshot.feedbackEvent.id, "payment-1");
  assert.equal(snapshot.feedbackEvent.givingCount, 4);
  assert.equal(Object.isFrozen(snapshot.treeEvent.fruitIds), true);
  fruitIds.push("not-confirmed");
  assert.equal(snapshot.treeEvent.fruitIds.length, 5);
  store.consumeFeedback("payment-1");
  store.observe("tree:day", fruitIds, { ...event, fruitIds: fruitIds.slice(0, 5) }, 4, false);
  assert.equal(store.getSnapshot().feedbackEvent, null);
  assert.equal(store.getSnapshot().treeEvent, snapshot.treeEvent);
});

test("bundle reactions wait for every associated paid fruit without inventing counts", () => {
  const store = observer();
  store.observe("tree:day", [], null, 3, true);
  const event = { id: "payment-1", fruitId: "payment-1:0", fruitIds: ["payment-1:0", "payment-1:1"], revision: 1 };
  store.observe("tree:day", ["payment-1:0"], event, 4, true);
  assert.equal(store.getSnapshot().treeEvent, null);
  store.observe("tree:day", event.fruitIds, event, 4, true);
  assert.deepEqual(store.getSnapshot().treeEvent.fruitIds, event.fruitIds);
  assert.equal(store.getSnapshot().feedbackEvent.isDemo, true);
});

test("empty, duplicate or mismatched bundle lists never dispatch", () => {
  const store = observer();
  store.observe("tree:day", [], null, 3, false);
  const event = { id: "payment-1", fruitId: "payment-1:0", revision: 1 };
  for (const fruitIds of [[], ["payment-1:0", "payment-1:0"], ["payment-1:1", "payment-1:0"]]) {
    store.observe("tree:day", ["payment-1:0", "payment-1:1"], { ...event, fruitIds }, 4, false);
    assert.equal(store.getSnapshot().treeEvent, null);
  }
});

test("bundle hydration and day changes remain silent with separate payment and fruit IDs", () => {
  const store = observer();
  const event = { id: "payment-1", fruitId: "payment-1:0", fruitIds: ["payment-1:0", "payment-1:1"], revision: 1 };
  store.observe("tree:day", event.fruitIds, event, 4, false);
  store.observe("tree:day", event.fruitIds, event, 4, false);
  assert.equal(store.getSnapshot().feedbackEvent, null);
  store.observe("tree:next-day", event.fruitIds, event, 4, false);
  assert.equal(store.getSnapshot().treeEvent, null);
});

test("one newly settled legacy $100 payment delivers all 200 fruits to both consumers once", () => {
  const store = observer();
  store.observe("tree:day", [], null, 3, false);
  const fruitIds = Array.from({ length: 200 }, (_, index) => `legacy-payment:${index}`);
  const event = { id: "legacy-payment", fruitId: fruitIds[0], fruitIds, revision: 1 };
  store.observe("tree:day", fruitIds, event, 4, false);
  const dispatch = store.getSnapshot();
  assert.deepEqual(dispatch.treeEvent.fruitIds, fruitIds);
  assert.deepEqual(dispatch.feedbackEvent, { id: "legacy-payment", baselineId: "baseline-1", givingCount: 4, isDemo: false });
  store.consumeFeedback("legacy-payment");
  assert.equal(store.getSnapshot().treeEvent, dispatch.treeEvent);
  store.observe("tree:day", fruitIds, event, 4, false);
  assert.equal(store.getSnapshot().treeEvent, dispatch.treeEvent);
  assert.equal(store.getSnapshot().feedbackEvent, null);
});
