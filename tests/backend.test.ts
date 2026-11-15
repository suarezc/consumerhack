import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { ritualWindow } from "../convex/questions";

const modules = import.meta.glob("../convex/**/*.ts");
const host = "host-device-00000001";
const friend = "friend-device-000001";
const third = "third-device-0000001";
const outsider = "outsider-device-001";

async function fixture(count = 3) {
  const t = convexTest(schema, modules);
  const tree = await t.mutation(api.trees.create, { deviceId: host, name: "Soft mornings", memberName: "Host" });
  if (count >= 2) await t.mutation(api.trees.join, { deviceId: friend, code: tree.code, memberName: "Friend" });
  if (count >= 3) await t.mutation(api.trees.join, { deviceId: third, code: tree.code, memberName: "Third" });
  return { t, ...tree };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("membership and daily scheduling", () => {
  it("normalizes codes and makes concurrent repeat joins idempotent", async () => {
    const { t, treeId, code } = await fixture(1);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const joins = await Promise.all(Array.from({ length: 8 }, () => t.mutation(api.trees.join,
      { deviceId: friend, code: ` ${code.toLowerCase()} `, memberName: "Friend" })));
    expect(new Set(joins.map(j => j.memberId)).size).toBe(1);
    expect((await t.query(api.days.today, { deviceId: host, treeId }))?.memberCount).toBe(2);
    await expect(t.mutation(api.trees.join, { deviceId: outsider, code: "ZZZZZZ", memberName: "Nobody" })).rejects.toThrow("No tree");
  });

  it("creates exactly one question per tree/date and rolls at 06 UTC", async () => {
    const { t, treeId, dayId } = await fixture(1);
    await Promise.all([t.mutation(internal.lifecycle.morning), t.mutation(internal.lifecycle.morning)]);
    expect(await t.run(ctx => ctx.db.query("days").collect())).toHaveLength(1);
    vi.setSystemTime(new Date("2026-11-16T05:59:59Z"));
    expect((await t.query(api.days.today, { treeId, deviceId: host }))?.day.dayId).toBe(dayId);
    vi.setSystemTime(new Date("2026-11-16T06:00:00Z"));
    await t.mutation(internal.lifecycle.morning);
    const today = await t.query(api.days.today, { treeId, deviceId: host });
    expect(today?.day.date).toBe("2026-11-16");
    expect(today?.day.bloomAt).toBe(Date.parse("2026-11-16T21:00:00Z"));
    expect(ritualWindow(Date.parse("2026-11-16T05:00:00Z")).date).toBe("2026-11-15");
  });

  it("rejects malformed identities and empty input without leaking device IDs", async () => {
    const { t, treeId } = await fixture();
    await expect(t.query(api.days.today, { treeId, deviceId: outsider })).rejects.toThrow("membership");
    await expect(t.query(api.trees.list, { deviceId: "short" })).rejects.toThrow("identity");
    await expect(t.mutation(api.trees.create, { deviceId: host, name: "  ", memberName: "Host" })).rejects.toThrow("Tree name");
    const list = await t.query(api.trees.list, { deviceId: host });
    expect(JSON.stringify(list)).not.toContain(host);
    expect(JSON.stringify(await t.query(api.days.today, { treeId, deviceId: host }))).not.toContain(friend);
  });
});

describe("answers, bloom and privacy", () => {
  it("deduplicates simultaneous retries and allocates unique contiguous blossoms", async () => {
    const { t, treeId, dayId, code } = await fixture();
    const devices = Array.from({ length: 12 }, (_, i) => `concurrent-device-${i.toString().padStart(4, "0")}`);
    await Promise.all(devices.map(deviceId => t.mutation(api.trees.join, { deviceId, code, memberName: "Member" })));
    const calls = devices.flatMap(deviceId => Array.from({ length: 3 }, () =>
      t.mutation(api.answers.submit, { deviceId, dayId, text: `Answer from ${deviceId}` })));
    const results = await Promise.all(calls);
    expect(new Set(results.map(r => r.answerId)).size).toBe(12);
    expect([...new Set(results.map(r => r.blossom))].sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i));
    expect((await t.query(api.days.today, { treeId, deviceId: host }))?.answerCount).toBe(12);
    const first = await t.mutation(api.answers.submit, { deviceId: host, dayId, text: "Original" });
    expect(await t.mutation(api.answers.submit, { deviceId: host, dayId, text: "Overwrite" })).toEqual(first);
    expect((await t.run(ctx => ctx.db.get(first.answerId)))?.text).toBe("Original");
  });

  it("requires both participation and bloom, and blooms when everyone answers", async () => {
    const { t, treeId, dayId } = await fixture();
    const a = await t.mutation(api.answers.submit, { deviceId: host, dayId, text: "Host secret" });
    expect((await t.query(api.days.today, { treeId, deviceId: host }))?.answers).toEqual([]);
    expect((await t.query(api.days.today, { treeId, deviceId: friend }))?.answers).toEqual([]);
    await expect(t.mutation(api.notes.send, { deviceId: host, answerId: a.answerId, text: "Too soon" })).rejects.toThrow("not available");
    await t.mutation(api.answers.submit, { deviceId: friend, dayId, text: "Friend secret" });
    await t.mutation(api.answers.submit, { deviceId: third, dayId, text: "Third secret" });
    const state = await t.query(api.days.today, { treeId, deviceId: host });
    expect(state?.answers).toHaveLength(3);
    expect(state?.day.bloomedAt).toBeGreaterThanOrEqual(Date.now());
    expect(state!.day.bloomedAt! - Date.now()).toBeLessThan(10);
    await t.mutation(internal.lifecycle.bloom, { dayId });
    const jobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.filter(j => j.name === "judgeHook:run")).toHaveLength(1);
    expect(JSON.stringify(state)).not.toContain("embedding");
  });

  it("blooms at the deadline without exposing answers to a nonparticipant", async () => {
    const { t, treeId, dayId } = await fixture();
    await t.mutation(api.answers.submit, { deviceId: host, dayId, text: "Only answer" });
    await t.mutation(internal.lifecycle.bloom, { dayId });
    expect((await t.query(api.days.today, { treeId, deviceId: host }))?.day.bloomedAt).toBeUndefined();
    await vi.advanceTimersByTimeAsync(9 * 60 * 60 * 1000);
    await t.finishInProgressScheduledFunctions();
    expect((await t.query(api.days.today, { treeId, deviceId: host }))?.answers).toHaveLength(1);
    const locked = await t.query(api.days.today, { treeId, deviceId: friend });
    expect(locked?.day.bloomedAt).toBeDefined();
    expect(locked?.answers).toEqual([]);
    await expect(t.mutation(api.answers.submit, { deviceId: friend, dayId, text: "Late" })).rejects.toThrow("bloomed");
    await expect(t.mutation(api.answers.submit, { deviceId: outsider, dayId, text: "Intrusion" })).rejects.toThrow("membership");
  });

  it("rejects early/late and invalid answers without allocating blossoms", async () => {
    const { t, dayId } = await fixture();
    await expect(t.mutation(api.answers.submit, { deviceId: host, dayId, text: "  " })).rejects.toThrow("Answer");
    await t.run(ctx => ctx.db.patch(dayId, { opensAt: Date.now() + 1000 }));
    await expect(t.mutation(api.answers.submit, { deviceId: host, dayId, text: "Early" })).rejects.toThrow("not opened");
    await t.run(ctx => ctx.db.patch(dayId, { opensAt: Date.now() - 1000, bloomAt: Date.now() }));
    await expect(t.mutation(api.answers.submit, { deviceId: host, dayId, text: "Late" })).rejects.toThrow("bloomed");
    expect(await t.run(ctx => ctx.db.query("answers").collect())).toEqual([]);
  });

  it("shows private notes only to sender and recipient", async () => {
    const { t, treeId, dayId } = await fixture();
    const a = await t.mutation(api.answers.submit, { deviceId: host, dayId, text: "Host" });
    await t.mutation(api.answers.submit, { deviceId: friend, dayId, text: "Friend" });
    await t.mutation(api.answers.submit, { deviceId: third, dayId, text: "Third" });
    await t.mutation(api.notes.send, { deviceId: friend, answerId: a.answerId, text: "Only us" });
    expect((await t.query(api.days.today, { treeId, deviceId: host }))?.notes.map(n => n.text)).toEqual(["Only us"]);
    expect((await t.query(api.days.today, { treeId, deviceId: friend }))?.notes.map(n => n.text)).toEqual(["Only us"]);
    expect((await t.query(api.days.today, { treeId, deviceId: third }))?.notes).toEqual([]);
    await expect(t.mutation(api.notes.send, { deviceId: outsider, answerId: a.answerId, text: "Intrusion" })).rejects.toThrow("membership");
    await t.mutation(api.trees.join, { deviceId: outsider, code: (await t.query(api.trees.list, { deviceId: host }))[0].code, memberName: "Late join" });
    await expect(t.mutation(api.notes.send, { deviceId: outsider, answerId: a.answerId, text: "Intrusion" })).rejects.toThrow("not available");
    expect((await t.query(api.days.today, { treeId, deviceId: outsider }))?.notes).toEqual([]);
  });

  it("retains missed days as bare saplings and excludes demo history", async () => {
    const { t, treeId, dayId } = await fixture();
    await t.mutation(api.answers.submit, { deviceId: host, dayId, text: "Yesterday" });
    await t.mutation(api.demo.restart, { deviceId: host, treeId });
    await t.mutation(api.demo.stop, { deviceId: host, treeId });
    vi.setSystemTime(new Date("2026-11-16T12:00:00Z"));
    await t.mutation(internal.lifecycle.morning);
    expect(await t.query(api.days.grove, { treeId, deviceId: host })).toMatchObject([{ answered: true, blossom: 0 }]);
    expect(await t.query(api.days.grove, { treeId, deviceId: friend })).toMatchObject([{ answered: false, blossom: null }]);
    expect(JSON.stringify(await t.query(api.days.grove, { treeId, deviceId: friend }))).not.toContain("Yesterday");
  });
});

describe("one-minute replay", () => {
  it("seeds on cue, invalidates old jobs, blooms and restarts from zero", async () => {
    const { t, treeId } = await fixture(1);
    const old = await t.mutation(api.demo.restart, { deviceId: host, treeId });
    await t.mutation(api.answers.submit, { deviceId: host, dayId: old.dayId, text: "Old run" });
    await vi.advanceTimersByTimeAsync(10_000);
    await t.finishInProgressScheduledFunctions();
    expect((await t.query(api.days.today, { treeId, deviceId: host }))?.answerCount).toBe(2);
    const current = await t.mutation(api.demo.restart, { deviceId: host, treeId });
    expect(current.dayId).not.toBe(old.dayId);
    expect((await t.query(api.days.today, { treeId, deviceId: host }))?.answerCount).toBe(0);
    await expect(t.mutation(api.answers.submit, { deviceId: host, dayId: old.dayId, text: "Stale retry" })).rejects.toThrow("demo has ended");
    await vi.advanceTimersByTimeAsync(30_001);
    await t.finishInProgressScheduledFunctions();
    expect((await t.query(api.days.today, { treeId, deviceId: host }))?.answerCount).toBe(3);
    expect((await t.run(ctx => ctx.db.get(old.dayId)))?.bloomedAt).toBeUndefined();
    await t.mutation(api.answers.submit, { deviceId: host, dayId: current.dayId, text: "New run" });
    expect((await t.query(api.days.today, { treeId, deviceId: host }))?.answers).toHaveLength(4);
    await vi.advanceTimersByTimeAsync(60_000);
    await t.finishInProgressScheduledFunctions();
    expect((await t.run(ctx => ctx.db.get(old.dayId)))?.bloomedAt).toBeUndefined();
    const latest = await t.mutation(api.demo.restart, { deviceId: host, treeId });
    await vi.advanceTimersByTimeAsync(latest.bloomAt - Date.now() + 1);
    await t.finishInProgressScheduledFunctions();
    const locked = await t.query(api.days.today, { treeId, deviceId: host });
    expect(locked?.day.dayId).toBe(latest.dayId);
    expect(locked?.day.bloomedAt).toBeDefined();
    expect(locked?.answers).toEqual([]);
  });

  it("keeps demo members out of normal bloom and restricts host controls", async () => {
    const { t, treeId, dayId } = await fixture(2);
    await expect(t.mutation(api.demo.restart, { deviceId: friend, treeId })).rejects.toThrow("host");
    await t.mutation(api.demo.restart, { deviceId: host, treeId });
    await expect(t.mutation(api.demo.stop, { deviceId: friend, treeId })).rejects.toThrow("host");
    await t.mutation(api.demo.stop, { deviceId: host, treeId });
    await vi.advanceTimersByTimeAsync(60_000);
    await t.finishInProgressScheduledFunctions();
    expect((await t.query(api.days.today, { treeId, deviceId: host }))?.memberCount).toBe(2);
    await t.mutation(api.answers.submit, { deviceId: host, dayId, text: "Real host" });
    await t.mutation(api.answers.submit, { deviceId: friend, dayId, text: "Real friend" });
    expect((await t.query(api.days.today, { treeId, deviceId: host }))?.answers).toHaveLength(2);
    await expect(t.query(api.days.today, { treeId, deviceId: `$demo:${treeId}:0` })).rejects.toThrow("identity");
  });
});
