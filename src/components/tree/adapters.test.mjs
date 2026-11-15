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
  let root;
  let renderPending = false;
  let failSend = false;
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
  const childWindow = {
    postMessage: (data) => {
      if (failSend) {
        failSend = false;
        throw new Error("fixture send failed");
      }
      sent.push(JSON.parse(data));
    },
  };
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
    useState: (initial) => {
      const index = cursor++;
      if (!slots[index])
        slots[index] = {
          value: initial,
          set(value) {
            if (!Object.is(slots[index].value, value)) {
              slots[index].value = value;
              renderPending = true;
            }
          },
        };
      return [slots[index].value, slots[index].set];
    },
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
    "react/jsx-runtime": {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
    "react-native": rn,
    "react-native-webview": { WebView: "WebView" },
    "./tree/bridge": bridge,
    "./tree/limits": limits,
    "./tree/TreeDataError": { TreeDataError: "TreeDataError" },
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
    do {
      renderPending = false;
      cursor = 0;
      root = context.exports.Tree(props);
      node = root.props.children[0];
      node.props.ref.current = web
        ? { contentWindow: childWindow }
        : childWindow;
      while (layout.length) layout.shift()();
      while (effects.length) effects.shift()();
    } while (renderPending);
  };
  const deliver = (message) => {
    const data = JSON.stringify(message);
    if (web)
      listeners.get("message")({ data, source: childWindow, origin: "null" });
    else node.props.onMessage({ nativeEvent: { data } });
  };
  return {
    render,
    deliver,
    sent,
    warnings,
    error: () => root.props.children[1],
    failSend: () => {
      failSend = true;
    },
  };
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
    assert.equal(view.error().props.reason, "capacity");
    assert.equal(paid.length, limits.TREE_MAX_FRUITS + 1);
    assert.equal(view.warnings.length, 1);
    assert.deepEqual(view.warnings[0], [
      "Tree snapshot exceeds supported transport limits; no fruits were truncated.",
    ]);
    view.deliver(tap);
    assert.deepEqual(taps, ["accepted"]);
    view.render(next);
    assert.equal(view.error(), null);
    assert.equal(view.sent.at(-1).revision, 2);
    assert.equal(view.sent.at(-1).timeOfDay, 0.8);
    view.deliver(tap);
    assert.deepEqual(taps, ["accepted"]);
    view.deliver({ ...tap, revision: 2 });
    assert.deepEqual(taps, ["accepted", "next"]);
  });

  test(`${web ? "web" : "native"} collection cache resends full after failed delivery or new session`, () => {
    const view = adapter(web);
    const props = {
      timeOfDay: 0.3,
      answers: 1,
      mine: [],
      notes: [],
      lanterns: 0,
      fruits: [{ id: "fixture-a", golden: false }],
      wateringEvent: null,
    };
    view.render(props);
    view.deliver({ type: "ready", session: "fixture-session" });
    assert.equal(view.sent.at(-1).fruits.length, 1);
    view.render({
      ...props,
      timeOfDay: 0.4,
      fruits: props.fruits.map((f) => ({ ...f })),
    });
    assert.equal("fruits" in view.sent.at(-1), false);
    assert.equal("wateringEvent" in view.sent.at(-1), false);
    const changed = { ...props, fruits: [{ id: "fixture-b", golden: true }] };
    view.failSend();
    view.render(changed);
    assert.equal(view.error().props.reason, "invalid-data");
    view.render({ ...changed, timeOfDay: 0.8 });
    assert.equal(view.error(), null);
    assert.equal(view.sent.at(-1).fruits[0].id, "fixture-b");
    assert.equal(view.sent.at(-1).revision, 3);
    view.deliver({ type: "ready", session: "new-session" });
    assert.equal(view.sent.at(-1).fruits[0].id, "fixture-b");
    assert.equal(view.sent.at(-1).wateringEvent, null);
  });
}
