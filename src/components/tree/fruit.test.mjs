import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(name, dependencies = {}) {
  const source = readFileSync(new URL(`./${name}.ts`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { exports: {}, require: (id) => dependencies[id] };
  vm.runInNewContext(code, context);
  return context.exports;
}
const fruit = load("fruit");
const {
  normalizeFruits,
  normalizeWateringEvent,
  fruitAnchor,
  createWateringTracker,
} = fruit;
const { normalizeTreeState } = load("bridge", { "./fruit": fruit });
const plain = (value) => JSON.parse(JSON.stringify(value));
const fruits = Object.freeze([
  Object.freeze({ id: "ledger-a", golden: false, mine: true }),
  Object.freeze({ id: "ledger-b", golden: true }),
]);

test("fruit transport is additive and leaves legacy props and caller arrays unchanged", () => {
  const legacy = {
    timeOfDay: 0.35,
    answers: 3,
    mine: [0],
    notes: [],
    lanterns: 2,
  };
  const before = JSON.stringify(legacy);
  const state = normalizeTreeState({
    ...legacy,
    fruits,
    wateringEvent: { id: "event-a", fruitId: "ledger-a", revision: 1 },
  });
  assert.equal(state.timeOfDay, legacy.timeOfDay);
  assert.equal(state.answers, 3);
  assert.equal(state.lanterns, 2);
  assert.deepEqual(plain(state.fruits), fruits);
  assert.equal(state.wateringEvent.id, "event-a");
  assert.equal(JSON.stringify(legacy), before);
  assert.equal(normalizeTreeState(legacy).wateringEvent, null);
  assert.deepEqual(plain(normalizeTreeState(legacy).fruits), []);
});

test("golden flags are supplied facts, not derived from order or count", () => {
  const input = [
    { id: "day-30", golden: true },
    { id: "day-1", golden: false },
    { id: "day-7", golden: true },
    { id: "day-3", golden: true },
  ];
  const normalized = plain(normalizeFruits(input));
  assert.deepEqual(normalized, plain(normalizeFruits([...input].reverse())));
  assert.equal(normalized.find((x) => x.id === "day-1").golden, false);
  assert.ok(normalized.filter((x) => x.id !== "day-1").every((x) => x.golden));
  assert.equal(normalizeFruits([{ id: "unknown-milestone" }]).length, 0);
});

test("malformed fruit/events are rejected and duplicate fruit identities render once", () => {
  assert.deepEqual(
    plain(
      normalizeFruits([
        null,
        {},
        { id: "", golden: true },
        { id: "a", golden: false },
        { id: "a", golden: true },
        { id: "b", golden: "true" },
      ]),
    ),
    [{ id: "a", golden: false }],
  );
  for (const value of [
    null,
    [],
    {},
    { id: "a", fruitId: "", revision: 1 },
    { id: "a", fruitId: "b", revision: 0 },
    { id: "a", fruitId: "b", revision: 1.5 },
    { id: "a", fruitId: "b", revision: Infinity },
  ])
    assert.equal(normalizeWateringEvent(value), null);
  const many = Array.from({ length: 100 }, (_, i) => ({
    id: `ledger-${i}`,
    golden: false,
  }));
  assert.equal(normalizeFruits(many).length, 64);
  assert.deepEqual(
    plain(normalizeFruits(many)),
    plain(normalizeFruits(many.reverse())),
  );
});

test("anchors depend on identity and site count, never collection position or golden status", () => {
  const before = fruits.map((x) => plain(fruitAnchor(x.id, 422)));
  const reordered = [...fruits]
    .reverse()
    .map((x) => ({ id: x.id, anchor: plain(fruitAnchor(x.id, 422)) }));
  fruits.forEach((x, i) =>
    assert.deepEqual(reordered.find((y) => y.id === x.id).anchor, before[i]),
  );
  assert.deepEqual(plain(fruitAnchor("ledger-a", 422)), before[0]);
  for (const anchor of before) {
    assert.ok(anchor.site >= 0 && anchor.site < 422);
    assert.ok(Math.abs(anchor.offsetX) <= 0.06);
    assert.ok(Math.abs(anchor.offsetY) <= 0.04);
  }
  assert.equal(fruitAnchor("a", 0), null);
  assert.equal(fruitAnchor("", 422), null);
});

test("initial nonnull is suppressed and remembered across payload-version changes", () => {
  const tracker = createWateringTracker();
  const event = { id: "paid-a", fruitId: "ledger-a", revision: 1 };
  assert.equal(tracker.observe(event, fruits), null);
  assert.equal(tracker.observe({ ...event, revision: 2 }, fruits), null);
  assert.equal(tracker.observe(null, fruits), null);
  assert.equal(tracker.observe(event, fruits), null);
});

test("post-hydration verified events animate once by ID, not revision", () => {
  const tracker = createWateringTracker();
  assert.equal(tracker.observe(null, fruits), null);
  const event = { id: "paid-a", fruitId: "ledger-a", revision: 1 };
  assert.deepEqual(plain(tracker.observe(event, fruits)), event);
  assert.equal(tracker.observe({ ...event, revision: 99 }, fruits), null);
  const next = { id: "paid-b", fruitId: "ledger-b", revision: 1 };
  assert.deepEqual(plain(tracker.observe(next, fruits)), next);
  assert.equal(tracker.observe(event, fruits), null);
});

test("fruit count changes alone never animate and unknown targets wait for a real fruit", () => {
  const tracker = createWateringTracker();
  tracker.observe(null, []);
  assert.equal(tracker.observe(null, fruits), null);
  const event = { id: "paid-later", fruitId: "ledger-later", revision: 1 };
  assert.equal(tracker.observe(event, fruits), null);
  const updated = [...fruits, { id: "ledger-later", golden: false }];
  assert.deepEqual(plain(tracker.observe(event, updated)), event);
  assert.equal(tracker.observe(event, updated), null);
  assert.equal(createWateringTracker().observe(event, updated), null);
});
