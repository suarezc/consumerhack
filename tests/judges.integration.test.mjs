import { test } from "node:test";
import assert from "node:assert/strict";
import { getFunctionName } from "convex/server";
import { commit, kindred, prepareDemo, run, snapshot } from "../convex/judges.ts";
import { stubAssessment, fixtureCode } from "../convex/lib/judgeLogic.ts";

function setup() {
  const rows = new Map();
  let sequence = 0;
  const tableRows = (table) => [...rows.values()].filter((row) => row._id.startsWith(`${table}:`));
  const ctx = {
    db: {
      get: async (id) => rows.get(id) ?? null,
      insert: async (table, value) => {
        const _id = `${table}:${++sequence}`;
        rows.set(_id, { ...structuredClone(value), _id, _creationTime: sequence });
        return _id;
      },
      patch: async (id, patch) => { Object.assign(rows.get(id), structuredClone(patch)); },
      query(table) {
        let filtered = tableRows(table);
        const chain = {
          withIndex(_name, callback) {
            const index = { eq(field, value) { filtered = filtered.filter((row) => row[field] === value); return index; } };
            callback(index);
            return chain;
          },
          order(direction) { filtered.sort((a, b) => (a._creationTime - b._creationTime) * (direction === "desc" ? -1 : 1)); return chain; },
          filter(callback) {
            const expr = {
              field: (key) => (row) => row[key],
              neq: (field, value) => (row) => field(row) !== value,
              and: (...conditions) => (row) => conditions.every((condition) => condition(row)),
            };
            filtered = filtered.filter(callback(expr));
            return chain;
          },
          collect: async () => structuredClone(filtered),
          take: async (count) => structuredClone(filtered.slice(0, count)),
          unique: async () => { assert.ok(filtered.length <= 1); return structuredClone(filtered[0] ?? null); },
        };
        return chain;
      },
    },
    scheduler: { runAfter: async (...args) => { ctx.scheduled.push(args); } },
    scheduled: [],
  };
  const handlers = { "judges:prepareDemo": prepareDemo, "judges:snapshot": snapshot, "judges:commit": commit };
  ctx.runMutation = (ref, args) => handlers[getFunctionName(ref)]._handler(ctx, args);
  ctx.runQuery = ctx.runMutation;
  return { ctx, rows, tableRows };
}

async function addDay(ctx, { isDemo = false, bloomed = true, name = "Real tree", deviceId = "test-bearer-identity-never-public", text = "grateful for a kind friend" } = {}) {
  const treeId = await ctx.db.insert("trees", { name, code: `TEST${name}`, hostDeviceId: deviceId, createdAt: 1 });
  const memberId = await ctx.db.insert("members", { treeId, deviceId, name: "Test member", joinedAt: 1 });
  const dayId = await ctx.db.insert("days", {
    treeId, date: "2026-11-15", question: "What did you notice?", opensAt: 1, bloomAt: 100,
    ...(isDemo ? { isDemo: true } : {}), ...(bloomed ? { bloomedAt: 100 } : {}),
  });
  if (isDemo) await ctx.db.patch(treeId, { demoDayId: dayId });
  const answerId = await ctx.db.insert("answers", { treeId, dayId, memberId, text, blossom: 0, createdAt: 1 });
  return { treeId, memberId, dayId, answerId, deviceId, text };
}

test("query enforces membership, source participation and source bloom", async () => {
  const { ctx, rows } = setup();
  const source = await addDay(ctx, { bloomed: false });
  await assert.rejects(kindred._handler(ctx, { dayId: source.dayId, deviceId: "unauthorized" }));
  assert.equal((await kindred._handler(ctx, source)).status, "locked");
  await ctx.db.patch(source.dayId, { bloomedAt: 100 });
  rows.delete(source.answerId);
  assert.equal((await kindred._handler(ctx, source)).status, "locked");
  rows.set(source.answerId, { _id: source.answerId, dayId: source.dayId, memberId: source.memberId, treeId: source.treeId, text: source.text });
  assert.equal((await kindred._handler(ctx, source)).status, "pending");
});

test("commit and public read revalidate target bloom and never expose private fields", async () => {
  const { ctx, rows } = setup();
  const source = await addDay(ctx);
  const target = await addDay(ctx, { name: "Other tree" });
  const closed = await addDay(ctx, { name: "Unbloomed tree", bloomed: false });
  const demo = await addDay(ctx, { name: "Demo tree", isDemo: true });
  await ctx.db.insert("notes", { answerId: target.answerId, text: "private-note-sentinel", fromMemberId: target.memberId });
  await commit._handler(ctx, { dayId: source.dayId, results: [{
    answerId: source.answerId, ...stubAssessment(source.text), matches: [target, closed, demo].map(({ answerId }) => ({ answerId, reason: "A shared warmth." })),
  }] });
  const result = await kindred._handler(ctx, source);
  assert.equal(result.matches.length, 1);
  assert.deepEqual(Object.keys(result.matches[0]).sort(), ["answerId", "reason", "text", "treeName"]);
  assert.ok(!JSON.stringify(result).includes("private-note-sentinel"));
  assert.ok(!JSON.stringify(result).includes(source.deviceId));
  await ctx.db.patch(target.dayId, { bloomedAt: undefined });
  assert.equal((await kindred._handler(ctx, source)).matches.length, 0);
  rows.delete(target.answerId);
  assert.equal((await kindred._handler(ctx, source)).matches.length, 0);
});

test("fresh demo yields three isolated distinct matches and retries are idempotent", async () => {
  const { ctx, tableRows } = setup();
  const source = await addDay(ctx, { isDemo: true });
  await addDay(ctx, { name: "Unrelated real tree" });
  await run._handler(ctx, { dayId: source.dayId });
  const result = await kindred._handler(ctx, source);
  assert.equal(result.status, "ready");
  assert.equal(result.matches.length, 3);
  assert.equal(new Set(result.matches.map((match) => match.answerId)).size, 3);
  assert.equal(tableRows("trees").filter((tree) => tree.code.startsWith("judge-fixture:")).length, 3);
  const counts = [tableRows("trees").length, tableRows("answers").length, tableRows("kindred").length];
  await run._handler(ctx, { dayId: source.dayId });
  assert.deepEqual([tableRows("trees").length, tableRows("answers").length, tableRows("kindred").length], counts);
  assert.deepEqual(await kindred._handler(ctx, source), result);
});

test("reset invalidates queued jobs, in-flight commits and old query results", async () => {
  const { ctx, tableRows } = setup();
  const source = await addDay(ctx, { isDemo: true });
  await prepareDemo._handler(ctx, { dayId: source.dayId, secrets: [0, 1, 2].map((i) => `test-fixture-secret-${i}`.padEnd(40, "x")) });
  const before = await snapshot._handler(ctx, { dayId: source.dayId });
  assert.equal(before.candidates.length, 3);
  await ctx.db.patch(source.treeId, { demoDayId: "days:new-run" });
  await commit._handler(ctx, { dayId: source.dayId, results: [{
    answerId: source.answerId, ...stubAssessment(source.text),
    matches: before.candidates.map(({ answerId }) => ({ answerId, reason: "Shared warmth." })),
  }] });
  assert.equal(tableRows("kindred").length, 0);
  assert.equal(await snapshot._handler(ctx, { dayId: source.dayId }), null);
  await run._handler(ctx, { dayId: source.dayId });
  assert.equal((await kindred._handler(ctx, source)).status, "locked");
  assert.equal(tableRows("trees").length, 4);
});

test("normal matching ignores fixtures even after many replays and returns honest scarcity", async () => {
  const { ctx } = setup();
  const source = await addDay(ctx);
  const target = await addDay(ctx, { name: "Only real candidate" });
  for (let i = 0; i < 40; i++) await addDay(ctx, { isDemo: true, name: fixtureCode(`run${i}`, 0) });
  await run._handler(ctx, { dayId: source.dayId });
  const result = await kindred._handler(ctx, source);
  assert.equal(result.status, "ready");
  assert.deepEqual(result.matches.map((match) => match.answerId), [target.answerId]);
});

test("action retries bounded infrastructure failures without logging payloads", async () => {
  const { ctx } = setup();
  ctx.runMutation = async () => { throw new Error("private infrastructure diagnostic"); };
  await run._handler(ctx, { dayId: "days:source" });
  assert.equal(ctx.scheduled.length, 1);
  assert.equal(ctx.scheduled[0][2].attempt, 1);
  await assert.rejects(run._handler(ctx, { dayId: "days:source", attempt: 2 }), /Judging could not finish/);
});
