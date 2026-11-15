import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const reference = readFileSync(
  new URL("../../../design/tree.html", import.meta.url),
  "utf8",
);
const referenceHelpers = reference.slice(
  reference.indexOf("  const clamp ="),
  reference.indexOf("  const hex ="),
);
const referenceGrowth = vm.runInNewContext(
  `${referenceHelpers}\n${reference.match(/const growth = \(v\) => [^;]+;/)[0]}\ngrowth;`,
);
const fruitRuntime = readFileSync(
  new URL("./fruitRuntime.ts", import.meta.url),
  "utf8",
).match(/String.raw`([\s\S]*)`;/)[1];
const html = readFileSync(
  new URL("./html.ts", import.meta.url),
  "utf8",
).replace("${FRUIT_RUNTIME}", fruitRuntime);

function renderer(reducedMotion = true) {
  const messages = [];
  const scheduled = new Map();
  let nextFrame = 0;
  let timestamp = 1000;
  let now = timestamp;
  const receivers = new Map();
  const gradient = { addColorStop() {} };
  const context = new Proxy(
    {},
    {
      get: (_, key) =>
        key === "createLinearGradient" || key === "createRadialGradient"
          ? () => gradient
          : () => {},
    },
  );
  const canvas = () => ({
    width: 0,
    height: 0,
    getContext: () => context,
    addEventListener() {},
    removeEventListener() {},
  });
  const sky = canvas();
  const scene = { clientWidth: 390, clientHeight: 844 };
  const media = {
    matches: reducedMotion,
    addEventListener() {},
    removeEventListener() {},
  };
  const window = {
    devicePixelRatio: 2,
    matchMedia: () => media,
    ReactNativeWebView: {
      postMessage: (data) => messages.push(JSON.parse(data)),
    },
    addEventListener: (name, callback) => receivers.set(name, callback),
    removeEventListener: (name) => receivers.delete(name),
  };
  const document = {
    hidden: false,
    getElementById: (id) => (id === "scene" ? scene : sky),
    createElement: canvas,
    addEventListener() {},
    removeEventListener() {},
  };
  const script = html.match(/<script>([\s\S]+?)<\/script>/)[1].replace(
    "  const observer = new ResizeObserver(resize);",
    `let paints = 0;
    const originalRender = render;
    render = function () { paints++; originalRender(); };
    window.inspect = function () {
      const branches = [];
      (function walk(node) {
        if (!(node.f > 0)) return;
        branches.push([node.depth, node.f, (node.ex - baseX) / U, (node.ey - groundY - 3) / U]);
        node.kids.forEach(walk);
      })(tree.root);
      return { growth: growth(t), branches: branches, shown: tree.buds.slice(0, answerCount).filter(b => b.shown).length, open: tree.buds.slice(0, answerCount).filter(b => b.shown && b.open > .5).length, lanterns: lanternCount, threads: threads.length, revision: revision, paintedRevision: paintedRevision, paints: paints, time: t, clock: clockT, motes: motes.length, moteAges: motes.map(m => clockT - m.t0), bloom: bloom };
    };
    const observer = new ResizeObserver(resize);`,
  );
  vm.runInNewContext(script, {
    window,
    document,
    performance: { now: () => now },
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    requestAnimationFrame: (callback) => {
      const id = ++nextFrame;
      scheduled.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      scheduled.delete(id);
    },
  });
  let revision = 0;
  const inspect = () => ({
    ...JSON.parse(JSON.stringify(window.inspect())),
    pendingFrames: scheduled.size,
  });
  const flush = (elapsed = 34) => {
    const callbacks = [...scheduled.values()];
    scheduled.clear();
    timestamp += elapsed;
    now = timestamp;
    callbacks.forEach((callback) => callback(timestamp));
    return inspect();
  };
  const update = (timeOfDay, answers, extras = {}, paint = true) => {
    receivers.get("message")({
      data: JSON.stringify({
        type: "state",
        session: messages[0].session,
        revision: ++revision,
        timeOfDay,
        answers,
        mine: [],
        notes: [],
        lanterns: 0,
        active: true,
        reduceMotion: reducedMotion,
        ...extras,
      }),
    });
    return paint ? flush() : inspect();
  };
  return Object.assign(update, {
    flush,
    inspect,
    elapse: (elapsed) => {
      now += elapsed;
    },
  });
}

test("fixed answer counts cannot force or suppress reference time-driven growth", () => {
  for (const time of [0, 0.1, 0.35, 0.5, 0.78, 1]) {
    const baseline = renderer()(time, 0);
    assert.equal(baseline.growth, referenceGrowth(time));
    for (const count of [1, 12, 36, 422]) {
      const state = renderer()(time, count);
      assert.equal(
        state.growth,
        referenceGrowth(time),
        `time=${time}, answers=${count}`,
      );
      assert.deepEqual(
        state.branches,
        baseline.branches,
        `count must not change branch geometry at t=${time}`,
      );
    }
  }
});

test("the same 36 answers show visibly different dawn, midday and night geometry", () => {
  const update = renderer();
  const dawn = update(0, 36);
  const midday = update(0.35, 36);
  const night = update(1, 36);
  assert.equal(dawn.growth, 0.07);
  assert.equal(night.growth, 1);
  assert.ok(dawn.branches.length < midday.branches.length);
  assert.ok(midday.branches.length < night.branches.length);
  assert.equal(dawn.shown, 0);
  assert.equal(dawn.open, 0);
  assert.equal(night.shown, 36);
  assert.equal(night.open, 36);
  assert.deepEqual(update(0, 36).branches, dawn.branches);
});

test("notes, lanterns and mine do not change growth or force early bloom", () => {
  const update = renderer();
  const baseline = update(0.35, 36);
  const decorated = update(0.35, 36, {
    mine: [0],
    notes: [{ from: 0, to: 1, count: 3, own: true }],
    lanterns: 3,
  });
  assert.deepEqual(decorated.branches, baseline.branches);
  assert.equal(decorated.open, 0);
  assert.equal(decorated.lanterns, 3);
  assert.equal(decorated.threads, 1);
  assert.equal(update(1, 36).open, 36);
});

test("a burst of snapshots paints only the latest state on the next frame", () => {
  const update = renderer();
  const initial = update.inspect();
  for (const time of [0, 0.1, 0.35, 0.5, 1]) update(time, 36, {}, false);
  const queued = update.inspect();
  assert.equal(queued.paints, initial.paints);
  assert.equal(queued.revision, 5);
  assert.equal(queued.pendingFrames, 1);
  assert.equal(queued.paintedRevision, -1);
  const painted = update.flush();
  assert.equal(painted.paints, initial.paints + 1);
  assert.equal(painted.paintedRevision, 5);
  assert.deepEqual(painted.branches, renderer()(1, 36).branches);
});

test("active animation elapsed time survives a delayed frame without lingering motes", () => {
  const update = renderer(false);
  const initial = update(0, 36);
  update(1, 37, { mine: [36] }, false);
  assert.equal(update.inspect().motes, 1);
  const painted = update.flush(3000);
  assert.ok(Math.abs(painted.clock - initial.clock - 3) < 1e-9);
  assert.equal(painted.motes, 0);
  assert.ok(painted.bloom > 0.999);
});

test("a late arrival does not inherit time from before it was received", () => {
  const update = renderer(false);
  const initial = update(0, 36);
  update.elapse(2900);
  update(1, 37, { mine: [36] }, false);
  const painted = update.flush(3000);
  assert.ok(Math.abs(painted.clock - initial.clock - 3) < 1e-9);
  assert.equal(painted.motes, 1);
  assert.ok(Math.abs(painted.moteAges[0] - 0.1) < 1e-9);
});

test("resume anchors active time before a delayed first resumed frame", () => {
  const update = renderer(false);
  update(0, 36);
  update(1, 37, { mine: [36] }, false);
  update.flush(100);
  const paused = update(1, 37, { active: false });
  assert.ok(Math.abs(paused.moteAges[0] - 0.1) < 1e-9);
  update.elapse(5000);
  update(1, 37, { active: false }, false);
  assert.equal(update.flush(5000).clock, paused.clock);
  update(1, 37, { active: true }, false);
  const resumed = update.flush(3000);
  assert.ok(Math.abs(resumed.clock - paused.clock - 3) < 1e-9);
  assert.equal(resumed.motes, 0);
});
