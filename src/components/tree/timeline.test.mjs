import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}) {
  const code = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  const context = { exports: {}, require: (id) => dependencies[id] };
  vm.runInNewContext(code, context);
  return context.exports;
}
const limits = load("./limits.ts"),
  fruit = load("./fruit.ts", { "./limits": limits });
const bridge = load("./bridge.ts", { "./limits": limits, "./fruit": fruit });
const { timelineSnapshot, TIMELINE_DURATION_MS } = load(
  "../../preview/timeline.ts",
);
const lightSource = readFileSync(
  new URL("./lightRuntime.ts", import.meta.url),
  "utf8",
).match(/String.raw`([\s\S]*)`;/)[1];
const weatherSource = readFileSync(
  new URL("./weatherRuntime.ts", import.meta.url),
  "utf8",
).match(/String.raw`([\s\S]*)`;/)[1];
const { createBundleLightLayer, createWeatherLayer } = vm.runInNewContext(
  lightSource +
    weatherSource +
    "\n({createBundleLightLayer,createWeatherLayer});",
);
const scene = {
  width: 390,
  height: 844,
  rootX: 190,
  rootY: 700,
  groundAt: () => 700,
  unit: 100,
  night: 1,
  glow: {},
  buds: Array.from({ length: 12 }, (_, i) => ({
    shown: true,
    x: 50 + i * 20,
    y: 300 + i * 5,
  })),
};
function capture(layer, now, reduced = false) {
  const ops = [];
  const ctx = new Proxy(
    {},
    {
      get: (target, key) =>
        key in target
          ? target[key]
          : (...args) =>
              ops.push({
                op: key,
                args,
                fill: target.fillStyle,
                stroke: target.strokeStyle,
              }),
    },
  );
  layer.draw(ctx, scene, now, reduced);
  return ops;
}
test("response samples create one fruit and bundles never create a response fruit", () => {
  assert.equal(TIMELINE_DURATION_MS, 15000);
  assert.equal(timelineSnapshot(0, []).fruits.length, 0);
  const before = timelineSnapshot(1, []);
  const response = { id: "sample-extra", at: 1, type: "response" };
  const added = timelineSnapshot(1, [response]);
  assert.equal(added.fruits.length, before.fruits.length + 1);
  const actions = [
    response,
    ...[2, 5, 10].map((bundles, i) => ({
      id: `sample-light-${i}`,
      at: 1,
      type: "bundles",
      bundles,
    })),
  ];
  const paid = timelineSnapshot(1, actions);
  assert.equal(paid.fruits.length, added.fruits.length);
  assert.equal(paid.lightBundles, 17);
  assert.equal(paid.lightEvent.lightBundles, 10);
  assert.ok(paid.fruits.every((f) => f.golden === false));
  assert.equal(timelineSnapshot(0, actions).lightBundles, 0);
});

test("verified light totals are never silently clipped at the visual budget", () => {
  const props = {
    timeOfDay: 1,
    answers: 0,
    mine: [],
    notes: [],
    lanterns: 0,
    fruits: [],
    lightBundles: 1001,
    goldenLightBundles: 1001,
  };
  const normalized = bridge.normalizeTreeState(props);
  assert.equal(normalized.lightBundles, 1001);
  assert.equal(normalized.goldenLightBundles, 1001);
  const status = bridge.getTreeDataStatus(props);
  assert.equal(status.status, "unavailable");
  assert.equal(status.reason, "capacity");
  assert.equal(status.detail, "lights");
  assert.equal(
    bridge.serializeTreeState(props, "session", 1, true, false),
    null,
  );
});
test("each sample bundle adds exactly one fairy light and one firefly, one flourish by ID", () => {
  for (const bundles of [2, 5, 10]) {
    const layer = createBundleLightLayer();
    layer.update(0, 0, null, 0, false);
    const event = {
      id: `sample-${bundles}`,
      revision: 1,
      lightBundles: bundles,
    };
    layer.update(bundles, 0, event, 1, false);
    const ops = capture(layer, 1.4);
    assert.equal(
      ops.filter((x) => x.op === "fill" && x.fill === "#ffdf99").length,
      bundles,
    );
    assert.equal(
      ops.filter((x) => x.op === "fill" && x.fill === "#fff4c8").length,
      bundles,
    );
    assert.equal(
      ops.filter((x) => x.op === "stroke" && x.stroke === "#ffdf99").length,
      1,
    );
    layer.update(bundles, 0, { ...event, revision: 2 }, 4, false);
    assert.equal(
      capture(layer, 4.4).filter(
        (x) => x.op === "stroke" && x.stroke === "#ffdf99",
      ).length,
      0,
    );
    const hydrated = createBundleLightLayer();
    hydrated.update(0, 0, event, 0, false);
    hydrated.update(bundles, 0, event, 1, false);
    assert.equal(
      capture(hydrated, 1.4).filter(
        (x) => x.op === "stroke" && x.stroke === "#ffdf99",
      ).length,
      0,
    );
  }
});
test("weather is independent and bounded, with quiet static reduced-motion treatment", () => {
  const inputs = {
    timeOfDay: 1,
    answers: 0,
    mine: [],
    notes: [],
    lanterns: 0,
    fruits: [{ id: "response-a", golden: true, mine: true }],
    lightBundles: 7,
    goldenLightBundles: 2,
    lightEvent: { id: "sample-light", revision: 1, lightBundles: 5 },
  };
  const serialize = bridge.createTreeStateSerializer();
  const initial = JSON.parse(serialize(inputs, "session", 1, true, false));
  assert.equal(initial.fruits[0].golden, false);
  const transition = bridge.createTreeStateSerializer();
  transition(
    {
      ...inputs,
      lightBundles: undefined,
      goldenLightBundles: undefined,
      lightEvent: undefined,
    },
    "transition",
    1,
    true,
    false,
  );
  const revised = JSON.parse(transition(inputs, "transition", 2, true, false));
  assert.equal(revised.fruits[0].golden, false);
  assert.equal(revised.fruits[0].responseIndex, 0);
  for (const [i, weather] of ["rain", "snow", "clear"].entries()) {
    const tick = JSON.parse(
      serialize({ ...inputs, weather }, "session", i + 2, true, false),
    );
    assert.equal(tick.lightBundles, 7);
    assert.equal(tick.goldenLightBundles, 2);
    assert.equal(tick.lightEvent.id, "sample-light");
    assert.equal("fruits" in tick, false);
  }
  for (const mode of ["rain", "snow"]) {
    const weather = createWeatherLayer();
    weather.update(mode);
    const render = (time, reduced) => {
      const ops = [];
      const ctx = new Proxy(
        {},
        {
          get:
            (_, key) =>
            (...args) =>
              ops.push([key, args]),
        },
      );
      weather.background(ctx, scene, time, reduced);
      weather.canopy(ctx, scene);
      return ops;
    };
    assert.notDeepEqual(render(0, false), render(1, false));
    assert.deepEqual(render(0, true), render(10, true));
    assert.ok(render(0, false).filter((x) => x[0] === "arc").length <= 48);
    assert.ok(render(0, false).length < 600);
  }
});
