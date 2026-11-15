import assert from "node:assert/strict";
import { test } from "node:test";

import { createSessionStore } from "../src/services/session.ts";

function memory(initial = null) {
  let value = initial;
  return { getItem: async () => value, setItem: async (next) => { value = next; } };
}

test("first launch persists one identity even with concurrent readers", async () => {
  let count = 0;
  const storage = memory();
  const store = createSessionStore(storage, () => `identity-${++count}`);
  const [first, second] = await Promise.all([store.load(), store.load()]);
  assert.deepEqual(first, second);
  assert.equal(count, 1);
  assert.deepEqual(await createSessionStore(storage, () => "wrong").load(), first);
});

test("chosen tree survives restart and switching preserves identity", async () => {
  const storage = memory();
  const store = createSessionStore(storage, () => "identity");
  await store.selectTree("tree-a");
  assert.deepEqual(await createSessionStore(storage, () => "wrong").load(), { deviceId: "identity", treeId: "tree-a" });
  assert.deepEqual(await store.selectTree(null), { deviceId: "identity", treeId: null });
});

test("unreadable or corrupt storage never silently replaces identity", async () => {
  for (const invalid of ["invalid-json", "{}", '{"deviceId":"","treeId":null}']) {
    let writes = 0;
    const store = createSessionStore({ getItem: async () => invalid, setItem: async () => { writes++; } }, () => "wrong");
    await assert.rejects(store.load());
    assert.equal(writes, 0);
  }
});

test("failed writes do not select a tree or permit an ephemeral identity", async () => {
  let fail = false;
  const storage = memory();
  const store = createSessionStore({ ...storage, setItem: async (value) => {
    if (fail) throw new Error("disk unavailable");
    await storage.setItem(value);
  } }, () => "identity");
  await store.load();
  fail = true;
  await assert.rejects(store.selectTree("tree-a"));
  assert.equal((await store.load()).treeId, null);
  await assert.rejects(createSessionStore({ getItem: async () => null, setItem: async () => { throw new Error("disk unavailable"); } }, () => "identity").load());
});
