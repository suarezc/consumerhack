import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { fixtureCode, stubAssessment } from "../convex/lib/judgeLogic";

const modules = import.meta.glob("../convex/**/*.ts");
const backend = () => convexTest(schema, modules);

async function addDay(t: ReturnType<typeof backend>, options: {
  isDemo?: boolean; bloomed?: boolean; name?: string; answered?: boolean;
} = {}) {
  const { isDemo = false, bloomed = true, name = "Real tree", answered = true } = options;
  const deviceId = "test-bearer-identity-never-public";
  const text = "grateful for a kind friend";
  return t.run(async (ctx) => {
    const treeId = await ctx.db.insert("trees", { name, code: `TEST${name}`, hostDeviceId: deviceId, createdAt: 1 });
    const memberId = await ctx.db.insert("members", { treeId, deviceId, name: "Test member", joinedAt: 1 });
    const dayId = await ctx.db.insert("days", {
      treeId, date: "2026-11-15", question: "What did you notice?", opensAt: 1, bloomAt: 100,
      ...(isDemo ? { isDemo: true } : {}), ...(bloomed ? { bloomedAt: 100 } : {}),
    });
    if (isDemo) await ctx.db.patch(treeId, { demoDayId: dayId });
    const answerId = answered ? await ctx.db.insert("answers", { treeId, dayId, memberId, text, blossom: 0, createdAt: 1 }) : null;
    return { treeId, memberId, dayId, answerId, deviceId, text };
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("STORYTIME_JUDGE_MODE", "stub");
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it("enforces membership, source participation and source bloom", async () => {
  const t = backend();
  const source = await addDay(t, { bloomed: false });
  const args = { dayId: source.dayId, deviceId: source.deviceId };
  await expect(t.query(api.judges.kindred, { ...args, deviceId: "outsider-bearer-identity" })).rejects.toThrow("membership");
  expect((await t.query(api.judges.kindred, args)).status).toBe("locked");
  await t.run((ctx) => ctx.db.patch(source.dayId, { bloomedAt: 100 }));
  expect((await t.query(api.judges.kindred, args)).status).toBe("pending");
  await t.run((ctx) => ctx.db.delete(source.answerId!));
  expect((await t.query(api.judges.kindred, args)).status).toBe("locked");
});

it("revalidates target bloom at commit and read without exposing private fields", async () => {
  const t = backend();
  const source = await addDay(t);
  const target = await addDay(t, { name: "Other tree" });
  const closed = await addDay(t, { name: "Unbloomed tree", bloomed: false });
  const demo = await addDay(t, { name: "Demo tree", isDemo: true });
  await t.run((ctx) => ctx.db.insert("notes", {
    answerId: target.answerId!, text: "private-note-sentinel", fromMemberId: target.memberId, createdAt: 1,
  }));
  await t.mutation(internal.judges.commit, { dayId: source.dayId, results: [{
    answerId: source.answerId!, ...stubAssessment(source.text),
    matches: [target, closed, demo].map(({ answerId }) => ({ answerId: answerId!, reason: "A shared warmth." })),
  }] });
  const args = { dayId: source.dayId, deviceId: source.deviceId };
  const result = await t.query(api.judges.kindred, args);
  expect(result.matches).toHaveLength(1);
  expect(Object.keys(result.matches[0]).sort()).toEqual(["answerId", "reason", "text", "treeName"]);
  expect(JSON.stringify(result)).not.toContain("private-note-sentinel");
  expect(JSON.stringify(result)).not.toContain(source.deviceId);
  await t.run((ctx) => ctx.db.patch(target.dayId, { bloomedAt: undefined }));
  expect((await t.query(api.judges.kindred, args)).matches).toHaveLength(0);
});

it("a fresh demo hook produces three distinct isolated matches and concurrent retries are idempotent", async () => {
  const t = backend();
  const source = await addDay(t, { isDemo: true });
  await addDay(t, { name: "Unrelated real tree" });
  await t.action(internal.judgeHook.run, { dayId: source.dayId });
  const args = { dayId: source.dayId, deviceId: source.deviceId };
  const result = await t.query(api.judges.kindred, args);
  expect(result.status).toBe("ready");
  expect(result.matches).toHaveLength(3);
  expect(new Set(result.matches.map((match) => match.answerId)).size).toBe(3);
  await Promise.all(Array.from({ length: 4 }, () => t.action(internal.judges.run, { dayId: source.dayId })));
  expect(await t.query(api.judges.kindred, args)).toEqual(result);
  expect(await t.run((ctx) => ctx.db.query("kindred").collect())).toHaveLength(1);
  expect(await t.run((ctx) => ctx.db.query("trees").collect())).toHaveLength(5);
  const fixture = await t.run((ctx) => ctx.db.query("trees").withIndex("by_code", (q) => q.eq("code", fixtureCode(source.dayId, 0))).unique());
  await expect(t.query(api.judges.kindred, { dayId: fixture!.demoDayId!, deviceId: fixture!.hostDeviceId })).rejects.toThrow("identity");
});

it("a reset invalidates queued jobs, in-flight commits and old query results", async () => {
  const t = backend();
  const source = await addDay(t, { isDemo: true });
  const next = await addDay(t, { isDemo: true, name: "Next run" });
  await t.mutation(internal.judges.prepareDemo, { dayId: source.dayId });
  const before = await t.query(internal.judges.snapshot, { dayId: source.dayId });
  expect(before!.candidates).toHaveLength(3);
  await t.run((ctx) => ctx.db.patch(source.treeId, { demoDayId: next.dayId }));
  await t.mutation(internal.judges.commit, { dayId: source.dayId, results: [{
    answerId: source.answerId!, ...stubAssessment(source.text),
    matches: before!.candidates.map(({ answerId }) => ({ answerId, reason: "Shared warmth." })),
  }] });
  expect(await t.run((ctx) => ctx.db.query("kindred").collect())).toHaveLength(0);
  expect(await t.query(internal.judges.snapshot, { dayId: source.dayId })).toBeNull();
  await t.action(internal.judgeHook.run, { dayId: source.dayId });
  expect((await t.query(api.judges.kindred, { dayId: source.dayId, deviceId: source.deviceId })).status).toBe("locked");
  expect(await t.run((ctx) => ctx.db.query("trees").collect())).toHaveLength(5);
});

it("normal matching ignores replay fixtures before applying its candidate cap and returns honest scarcity", async () => {
  const t = backend();
  const source = await addDay(t);
  const target = await addDay(t, { name: "Only real candidate" });
  for (let i = 0; i < 40; i++) await addDay(t, { isDemo: true, name: fixtureCode(`run${i}`, 0) });
  await t.action(internal.judges.run, { dayId: source.dayId });
  const result = await t.query(api.judges.kindred, { dayId: source.dayId, deviceId: source.deviceId });
  expect(result.status).toBe("ready");
  expect(result.matches.map((match) => match.answerId)).toEqual([target.answerId]);
});

it("concurrent first commits write one immutable kindred result per answer", async () => {
  const t = backend();
  const source = await addDay(t);
  const args = { dayId: source.dayId, results: [{ answerId: source.answerId!, ...stubAssessment(source.text), matches: [] }] };
  await Promise.all(Array.from({ length: 8 }, () => t.mutation(internal.judges.commit, args)));
  expect(await t.run((ctx) => ctx.db.query("kindred").collect())).toHaveLength(1);
  expect((await t.query(api.judges.kindred, { dayId: source.dayId, deviceId: source.deviceId })).matches).toHaveLength(0);
});
