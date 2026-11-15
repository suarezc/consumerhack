import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const context = { exports: {}, require: (id) => dependencies[id] };
  vm.runInNewContext(code, context);
  return context.exports;
}
const limits = load("./limits.ts");
const fruit = load("./fruit.ts", { "./limits": limits });
const bridge = load("./bridge.ts", { "./limits": limits, "./fruit": fruit });

function adapter(web) {
  const slots = [],
    layout = [],
    effects = [],
    sent = [],
    warnings = [];
  const listeners = new Map();
  let cursor = 0;
  let node;
  const useCallback = (value, dependencies) => {
    const index = cursor++;
    const previous = slots[index];
    if (
      !previous ||
      dependencies.some(
        (value, i) => !Object.is(value, previous.dependencies[i]),
      )
    )
      slots[index] = { value, dependencies };
    return slots[index].value;
  };
  const scheduleEffect = (queue) => (effect, dependencies) => {
    const index = cursor++;
    const previous = slots[index];
    if (
      !previous ||
      dependencies.some(
        (value, i) => !Object.is(value, previous.dependencies[i]),
      )
    ) {
      queue.push(() => {
        previous?.cleanup?.();
        slots[index] = { dependencies, cleanup: effect() };
      });
    }
  };
  const childWindow = { postMessage: (data) => sent.push(JSON.parse(data)) };
  const window = {
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name) => listeners.delete(name),
  };
  const document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  };
  const react = {
    useRef: (value) => {
      const index = cursor++;
      return slots[index] ?? (slots[index] = { current: value });
    },
    useCallback,
    useLayoutEffect: scheduleEffect(layout),
    useEffect: scheduleEffect(effects),
  };
  const rn = {
    View: "View",
    StyleSheet: { create: (value) => value },
    AppState: {
      currentState: "active",
      addEventListener: () => ({ remove() {} }),
    },
    AccessibilityInfo: {
      addEventListener: () => ({ remove() {} }),
      isReduceMotionEnabled: () => new Promise(() => {}),
    },
  };
  const dependencies = {
    react,
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
    "react-native": rn,
    "react-native-webview": { WebView: "WebView" },
    "./tree/bridge": bridge,
    "./tree/html": { TREE_HTML: "<script></script>" },
  };
  const source = readFileSync(
    new URL(web ? "../Tree.web.tsx" : "../Tree.tsx", import.meta.url),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const context = {
    exports: {},
    require: (id) => dependencies[id],
    window,
    document,
    console: { warn: (...args) => warnings.push(args) },
  };
  vm.runInNewContext(code, context);
  const render = (props) => {
    cursor = 0;
    node = context.exports.Tree(props).props.children;
    node.props.ref.current = web ? { contentWindow: childWindow } : childWindow;
    while (layout.length) layout.shift()();
    while (effects.length) effects.shift()();
  };
  const deliver = (message) => {
    const data = JSON.stringify(message);
    if (web)
      listeners.get("message")({ data, source: childWindow, origin: "null" });
    else node.props.onMessage({ nativeEvent: { data } });
  };
  return { render, deliver, sent, warnings };
}

for (const web of [false, true]) {
  test(`${web ? "web" : "native"} adapter suppresses taps after whole-snapshot rejection and recovers`, () => {
    const view = adapter(web);
    const taps = [];
    const props = {
      timeOfDay: 0.3,
      answers: 1,
      mine: [],
      notes: [],
      lanterns: 0,
      fruits: [],
      onTapBlossom: () => taps.push("accepted"),
    };
    view.render(props);
    view.deliver({ type: "ready", session: "fixture-session" });
    assert.equal(view.sent.at(-1).revision, 1);
    const tap = {
      type: "tap",
      session: "fixture-session",
      revision: 1,
      index: 0,
    };
    view.deliver(tap);
    assert.deepEqual(taps, ["accepted"]);
    const next = {
      ...props,
      timeOfDay: 0.8,
      onTapBlossom: () => taps.push("next"),
    };
    const paid = Array.from({ length: limits.TREE_MAX_FRUITS + 1 }, (_, i) => ({
      id: `fixture-${i}`,
      golden: false,
    }));
    const before = view.sent.length;
    view.render({ ...next, fruits: paid });
    assert.equal(view.sent.length, before);
    assert.equal(paid.length, limits.TREE_MAX_FRUITS + 1);
    assert.equal(view.warnings.length, 1);
    assert.deepEqual(view.warnings[0], [
      "Tree snapshot exceeds supported transport limits; no fruits were truncated.",
    ]);
    view.deliver(tap);
    assert.deepEqual(taps, ["accepted"]);
    view.render(next);
    assert.equal(view.sent.at(-1).revision, 2);
    assert.equal(view.sent.at(-1).timeOfDay, 0.8);
    view.deliver(tap);
    assert.deepEqual(taps, ["accepted"]);
    view.deliver({ ...tap, revision: 2 });
    assert.deepEqual(taps, ["accepted", "next"]);
  });
}
