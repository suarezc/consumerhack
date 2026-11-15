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
const limits = load("limits");
const fruit = load("fruit", { "./limits": limits });
const { normalizeFruits, normalizeWateringEvent, fruitAnchor } = fruit;
const runtime = readFileSync(
  new URL("./fruitRuntime.ts", import.meta.url),
  "utf8",
).match(/String.raw`([\s\S]*)`;/)[1];
const { createWateringTracker, createFruitLayer } = vm.runInNewContext(
  runtime + "\n({createWateringTracker,createFruitLayer});",
);
const { normalizeTreeState } = load("bridge", {
  "./fruit": fruit,
  "./limits": limits,
});
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
  assert.deepEqual(
    plain(state.fruits.map(({ anchor, ...value }) => value)),
    fruits,
  );
  assert.ok(state.fruits.every((value) => Number.isInteger(value.anchor.key)));
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
    { id: "a", fruitId: "b", revision: 1, fruitIds: [] },
    { id: "a", fruitId: "b", revision: 1, fruitIds: null },
    { id: "a", fruitId: "b", revision: 1, fruitIds: [""] },
  ])
    assert.equal(normalizeWateringEvent(value), null);
  const many = Array.from({ length: 100 }, (_, i) => ({
    id: `ledger-${i}`,
    golden: false,
  }));
  assert.equal(normalizeFruits(many).length, 100);
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

const geometry = {
  buds: Array.from({ length: 12 }, (_, i) => ({
    shown: true,
    x: 100 + i * 10,
    y: 200 - i * 3,
  })),
  unit: 100,
  rootX: 160,
  rootY: 400,
  glow: {},
};
const payload = (values) =>
  normalizeTreeState({
    timeOfDay: 1,
    answers: 0,
    mine: [],
    notes: [],
    lanterns: 0,
    fruits: values,
  }).fruits;
function draw(layer, now, reduced = false, scene = geometry) {
  const operations = [];
  const ctx = new Proxy(
    {},
    {
      get(target, key) {
        return key in target
          ? target[key]
          : (...args) =>
              operations.push({
                op: key,
                args,
                fill: target.fillStyle,
                stroke: target.strokeStyle,
              });
      },
    },
  );
  layer.draw(ctx, scene, now, reduced);
  return operations;
}
const hasWater = (operations) =>
  operations.some((x) => x.op === "stroke" && x.stroke === "#d5e6d4");

test("actual layer paints hydrated fruit without a watering replay", () => {
  const layer = createFruitLayer();
  layer.update(
    payload(fruits),
    { id: "baseline", fruitId: "ledger-a", revision: 1 },
    0,
    false,
  );
  const initial = draw(layer, 0.4);
  assert.equal(hasWater(initial), false);
  assert.ok(initial.some((x) => x.op === "fill" && x.fill === "#ffd27a"));
  assert.ok(initial.some((x) => x.op === "fill" && x.fill === "#d78c78"));
  layer.update(
    payload(fruits),
    { id: "baseline", fruitId: "ledger-a", revision: 2 },
    0.5,
    false,
  );
  assert.equal(hasWater(draw(layer, 0.6)), false);
});

test("actual layer responds only to a fresh confirmed event and does not restart it", () => {
  const layer = createFruitLayer();
  layer.update(payload(fruits), null, 0, false);
  const event = { id: "confirmed", fruitId: "ledger-a", revision: 1 };
  layer.update(payload(fruits), event, 1, false);
  assert.equal(hasWater(draw(layer, 1.4)), true);
  layer.update(payload(fruits), { ...event, revision: 99 }, 2, false);
  assert.equal(hasWater(draw(layer, 2.1)), false);
  assert.equal(hasWater(draw(layer, 4)), false);
  layer.update(
    payload([...fruits, { id: "count-only", golden: false }]),
    null,
    5,
    false,
  );
  assert.equal(hasWater(draw(layer, 5.4)), false);
});

test("reduced motion consumes confirmation without a stream or later replay", () => {
  const layer = createFruitLayer();
  layer.update(payload(fruits), null, 0, false);
  const event = { id: "reduced", fruitId: "ledger-b", revision: 1 };
  layer.update(payload(fruits), event, 1, true);
  assert.equal(hasWater(draw(layer, 1.4, true)), false);
  layer.update(payload(fruits), event, 2, false);
  assert.equal(hasWater(draw(layer, 2.4)), false);
});

test("a confirmed watering pulses roots without changing an ungrown tree", () => {
  const scene = {
    ...geometry,
    buds: geometry.buds.map((bud) => ({ ...bud, shown: false })),
  };
  const before = JSON.stringify(scene);
  const layer = createFruitLayer();
  layer.update(payload(fruits), null, 0, false);
  layer.update(
    payload(fruits),
    { id: "root-only", fruitId: "ledger-a", revision: 1 },
    1,
    false,
  );
  const operations = draw(layer, 1.4, false, scene);
  assert.equal(hasWater(operations), true);
  assert.ok(
    operations.some((x) => x.op === "stroke" && x.stroke === "#ffd27a"),
  );
  assert.equal(
    operations.some((x) => x.op === "fill" && x.fill === "#d78c78"),
    false,
  );
  assert.equal(JSON.stringify(scene), before);
});

for (const count of [2, 3, 5, 10]) {
  test(`${count} paid bundle fruits get one payment flourish and all arrive`, () => {
    const paid = Array.from({ length: count }, (_, i) => ({
      id: `fixture-payment-${count}:${i}`,
      golden: count === 5,
    }));
    const event = {
      id: `fixture-payment-${count}`,
      fruitId: paid[0].id,
      fruitIds: Object.freeze(paid.map((x) => x.id)),
      revision: 1,
    };
    assert.deepEqual(plain(normalizeWateringEvent(event)), event);
    const layer = createFruitLayer();
    layer.update([], null, 0, false);
    layer.update(payload(paid), event, 1, false);
    const stream = draw(layer, 1.4);
    assert.equal(
      stream.filter((x) => x.op === "stroke" && x.stroke === "#d5e6d4").length,
      1,
    );
    assert.equal(
      stream.filter((x) => x.op === "stroke" && x.stroke === "#ffd27a").length,
      1,
    );
    const arrivals = draw(layer, 2);
    assert.equal(
      arrivals.filter((x) => x.op === "arc" && x.args[2] === 2.2).length,
      count,
    );
    const settled = draw(layer, 3);
    assert.equal(
      settled.filter(
        (x) =>
          x.op === "fill" && x.fill === (count === 5 ? "#ffd27a" : "#d78c78"),
      ).length,
      count,
    );
    layer.update(
      payload([...paid].reverse()),
      { ...event, revision: 2 },
      4,
      false,
    );
    assert.equal(hasWater(draw(layer, 4.4)), false);
    assert.deepEqual(draw(layer, 5), settled);
    const reloaded = createFruitLayer();
    reloaded.update(payload(paid), event, 0, false);
    assert.equal(hasWater(draw(reloaded, 0.4)), false);
    assert.equal(
      draw(reloaded, 0.4).filter(
        (x) =>
          x.op === "fill" && x.fill === (count === 5 ? "#ffd27a" : "#d78c78"),
      ).length,
      count,
    );
  });
}

test("a supplied full list is authoritative and waits for every paid fruit", () => {
  const tracker = createWateringTracker();
  tracker.observe(null, fruits);
  const event = {
    id: "bundle-payment",
    fruitId: "ledger-a",
    fruitIds: ["paid-1", "paid-2"],
    revision: 1,
  };
  assert.equal(tracker.observe(event, fruits), null);
  const partial = [...fruits, { id: "paid-1", golden: false }];
  assert.equal(tracker.observe(event, partial), null);
  const complete = [...partial, { id: "paid-2", golden: false }];
  assert.deepEqual(plain(tracker.observe(event, complete)), event);
  assert.equal(
    tracker.observe(
      { ...event, fruitIds: ["ledger-a"], revision: 2 },
      complete,
    ),
    null,
  );
  const withoutFallback = createWateringTracker();
  withoutFallback.observe(null, []);
  assert.deepEqual(
    plain(
      withoutFallback.observe(
        event,
        complete.filter((x) => x.id !== "ledger-a"),
      ),
    ),
    event,
  );
});

test("paid fruit collections larger than the former display cap remain complete", () => {
  const paid = Array.from({ length: 100 }, (_, i) => ({
    id: `fixture-ledger-${i}`,
    golden: false,
  }));
  const layer = createFruitLayer();
  const normalized = payload(paid);
  assert.equal(normalized.length, 100);
  layer.update(normalized, null, 0, false);
  assert.equal(
    draw(layer, 0).filter((x) => x.op === "fill" && x.fill === "#d78c78")
      .length,
    100,
  );
});
