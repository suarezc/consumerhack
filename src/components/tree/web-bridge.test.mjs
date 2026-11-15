import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../Tree.web.tsx", import.meta.url), "utf8");
const injected = source.match(/`<script>([\s\S]+?)<\/script><script>`/)[1];

function frame(referrer) {
  const posted = [];
  const listeners = [];
  const parent = { postMessage: (data, target) => posted.push([data, target]) };
  const window = {
    parent,
    addEventListener: (name, listener, capture) =>
      listeners.push({ name, listener, capture }),
  };
  vm.runInNewContext(injected, { window, document: { referrer }, URL });
  const deliver = (source, origin) => {
    let stopped = false;
    for (const { name, listener } of listeners)
      if (name === "message")
        listener({
          source,
          origin,
          stopImmediatePropagation: () => (stopped = true),
        });
    return !stopped;
  };
  return { window, parent, posted, deliver };
}

for (const referrer of ["", "https://storytime.example/"]) {
  test(`the tree bridge connects to its parent with referrer "${referrer}"`, () => {
    const { window, parent, posted, deliver } = frame(referrer);
    window.ReactNativeWebView.postMessage("ready");
    assert.deepEqual(posted, [["ready", "*"]]);
    assert.equal(deliver(parent, "null"), true);
    assert.equal(deliver(parent, "https://storytime.example"), true);
    assert.equal(deliver({}, "https://storytime.example"), false);
  });
}
