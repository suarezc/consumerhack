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
const html = readFileSync(new URL("./html.ts", import.meta.url), "utf8");

function renderer() {
  const messages = [];
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
    matches: true,
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
    `window.inspect = function () {
      const branches = [];
      (function walk(node) {
        if (!(node.f > 0)) return;
        branches.push([node.depth, node.f, (node.ex - baseX) / U, (node.ey - groundY - 3) / U]);
        node.kids.forEach(walk);
      })(tree.root);
      return { growth: growth(t), branches: branches, shown: tree.buds.slice(0, answerCount).filter(b => b.shown).length, open: tree.buds.slice(0, answerCount).filter(b => b.shown && b.open > .5).length, lanterns: lanternCount, threads: threads.length };
    };
    const observer = new ResizeObserver(resize);`,
  );
  vm.runInNewContext(script, {
    window,
    document,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
  });
  let revision = 0;
  return (timeOfDay, answers, extras = {}) => {
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
        reduceMotion: true,
        ...extras,
      }),
    });
    return JSON.parse(JSON.stringify(window.inspect()));
  };
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
