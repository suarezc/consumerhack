import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { currentStreak, milestone, ritualClock, shiftDate } from "../convex/lib/streakLogic";
import { validateAmount, verifyPayment } from "../convex/lib/payments";
import { notificationGivingContext } from "../convex/streaks";

const modules = import.meta.glob("../convex/**/*.ts");
const deviceId = "watering-user-device-000001";
const outsider = "watering-outsider-00000001";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
  vi.stubEnv("WHOP_ENVIRONMENT", "sandbox");
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function fixture() {
  const t = convexTest(schema, modules);
  const tree = await t.mutation(api.trees.create, { deviceId, name: "A giving tree", memberName: "Host", cause: { name: "A shared cause" } });
  return { t, tree };
}

type Test = Awaited<ReturnType<typeof fixture>>["t"];
type Tree = Awaited<ReturnType<typeof fixture>>["tree"];

async function contribution(t: Test, tree: Tree, date: string, amountCents = 50, answer = true) {
  return await t.run(async ctx => {
    const start = Date.parse(`${date}T06:00:00Z`);
    let day = await ctx.db.query("days").withIndex("by_tree_date", q => q.eq("treeId", tree.treeId).eq("date", date)).unique();
    if (!day) {
      const id = await ctx.db.insert("days", { treeId: tree.treeId, date, question: "A private question", opensAt: start, bloomAt: start + 54_000_000 });
      day = await ctx.db.get(id);
    }
    if (answer) await ctx.db.insert("answers", { treeId: tree.treeId, memberId: tree.memberId, dayId: day!._id,
      text: "Private history", blossom: 0, createdAt: start + 1000 });
    return await ctx.db.insert("lanterns", { treeId: tree.treeId, memberId: tree.memberId, amountCents, status: "paid",
      source: "whop", whopCheckoutId: `ch_${date}_${tree.treeId}_${amountCents}`,
      createdAt: start, paidAt: start + 1000, creditedDate: date });
  });
}

describe("computed user dates", () => {
  it("continues through yesterday as at risk, is current today, and breaks only after a full empty ritual day", () => {
    const dates = new Set(["2026-11-12", "2026-11-13", "2026-11-14"]);
    expect(currentStreak(dates, "2026-11-15")).toEqual({ count: 3, status: "at_risk" });
    dates.add("2026-11-15");
    expect(currentStreak(dates, "2026-11-15")).toEqual({ count: 4, status: "current" });
    expect(currentStreak(dates, "2026-11-16")).toEqual({ count: 4, status: "at_risk" });
    expect(currentStreak(dates, "2026-11-17")).toEqual({ count: 0, status: "none" });
  });

  it("does not roll at UTC/local midnight and rolls exactly at06:00UTC", () => {
    for (const time of ["2026-11-15T23:59:59.999Z", "2026-11-16T00:00:00Z", "2026-11-16T05:59:59.999Z"]) {
      expect(ritualClock(Date.parse(time)).date).toBe("2026-11-15");
    }
    expect(ritualClock(Date.parse("2026-11-16T06:00:00Z"))).toMatchObject({ date: "2026-11-16", nextBoundaryAt: Date.parse("2026-11-17T06:00:00Z") });
    expect(ritualClock(Date.parse("2026-11-16T08:00:00Z")).date).toBe("2026-11-16");
    expect(shiftDate("2026-03-08", 1)).toBe("2026-03-09");
  });

  it("deduplicates two memberships, answers and multiple paid contributions on one date", async () => {
    const { t, tree } = await fixture();
    const other = await t.mutation(api.trees.create, { deviceId, name: "Another tree", memberName: "Host" });
    await contribution(t, tree, "2026-11-13");
    await contribution(t, other, "2026-11-14", 150);
    await contribution(t, tree, "2026-11-14", 200);
    await contribution(t, other, "2026-11-15", 100);
    await contribution(t, tree, "2026-11-15", 50);
    const summary = await t.query(api.streaks.summary, { deviceId, treeId: tree.treeId });
    expect(summary).toMatchObject({ answer: { count: 3, status: "current" }, giving: { count: 3, status: "current", longest: 3, totalCents: 550 }, currency: "USD", isDemo: false });
    const today = await t.query(api.days.today, { deviceId, treeId: tree.treeId });
    expect(today?.fruits).toHaveLength(1);
    expect(today?.fruits[0]).toMatchObject({ golden: true, milestone: 3, isMine: true });
    expect(today?.wateringEvent?.fruitId).toBe(today?.fruits[0].fruitId);
    const serialized = JSON.stringify(today);
    expect(serialized).not.toContain(deviceId);
    expect(serialized).not.toContain("Private history");
    expect(serialized).not.toContain("whopCheckoutId");
    await expect(t.query(api.streaks.summary, { deviceId: outsider, treeId: tree.treeId })).rejects.toThrow("membership");
  });

  it("computes milestones at the historical contribution date, never from today's streak", async () => {
    const { t, tree } = await fixture();
    await t.run(ctx => ctx.db.patch(tree.memberId, { joinedAt: Date.parse("2026-10-01T06:00:00Z") }));
    for (let offset = -29; offset <= 0; offset++) await contribution(t, tree, shiftDate("2026-11-15", offset));
    const summary = await t.query(api.streaks.summary, { deviceId, treeId: tree.treeId });
    expect(summary.giving).toMatchObject({ count: 30, longest: 30, totalCents: 1500 });
    expect((await t.query(api.days.today, { deviceId, treeId: tree.treeId }))?.fruits[0].milestone).toBe(30);
    const grove = await t.query(api.days.grove, { deviceId, treeId: tree.treeId });
    expect(grove.filter(day => day.fruits[0]?.golden).map(day => day.date).sort()).toEqual([shiftDate("2026-11-15", -27), shiftDate("2026-11-15", -23)].sort());
    const dates = new Set(Array.from({ length: 31 }, (_, index) => shiftDate("2026-10-17", index)));
    expect(milestone(dates, "2026-11-15")).toBe(30);
    expect(milestone(dates, "2026-11-16")).toBeNull();
    expect(JSON.stringify(grove)).not.toContain("Private history");
  });

  it("keeps both summary and Today subscribed to the next real-day insertion", async () => {
    const { t, tree } = await fixture();
    await contribution(t, tree, "2026-11-15");
    for (const reference of [api.streaks.summary, api.days.today]) {
      const sources: { indexName?: string; range?: { type: string; fieldPath: string; value: unknown }[]; order?: string }[] = [];
      await t.query(async ctx => {
        const runtime = (globalThis as unknown as { Convex: { syscall: unknown } }).Convex;
        const original = runtime.syscall as (name: string, args: string) => string;
        const spy = vi.spyOn(runtime, "syscall", "get").mockReturnValue((name: string, args: string) => {
          if (name === "1.0/queryStream") sources.push(JSON.parse(args).query.source);
          return original(name, args);
        });
        try { return await ctx.runQuery(reference, { deviceId, treeId: tree.treeId }); } finally { spy.mockRestore(); }
      });
      const dependency = sources.find(source => source.indexName === "days.by_tree_date");
      expect(dependency).toMatchObject({ order: "desc", range: [{ type: "Eq", fieldPath: "treeId", value: tree.treeId }] });
      expect(dependency?.range).toHaveLength(1);
    }
    vi.setSystemTime(new Date("2026-11-16T06:00:00Z"));
    await t.mutation(internal.lifecycle.morning);
    const summary = await t.query(api.streaks.summary, { deviceId, treeId: tree.treeId });
    const today = await t.query(api.days.today, { deviceId, treeId: tree.treeId });
    expect(summary).toMatchObject({ clock: { date: "2026-11-16" }, giving: { count: 1, status: "at_risk" } });
    expect(today?.streaks).toEqual(summary);
    expect(today?.fruits).toEqual([]);
  });
});

describe("provider payment facts", () => {
  it("validates new half-dollar steps but preserves legacy non-step verification and uses paid_at, not created_at", () => {
    for (const cents of [50, 100, 150, 10000]) expect(() => validateAmount(cents)).not.toThrow();
    for (const cents of [0, -50, 49, 51, 125, 50.5, 10050]) expect(() => validateAmount(cents)).toThrow();
    const money = { amount: "1.25", decimals: 2, currency: "usd" };
    const payment = { id: "pay_legacy", account_id: "biz_test", status: "paid", currency: "usd", subtotal: money, total: money,
      checkout_configuration_id: "ch_test", created_at: "2026-11-14T12:00:00Z", paid_at: "2026-11-16T05:59:59Z",
      metadata: { integration: "storytime-lantern-sandbox", treeId: "tree", memberId: "member" } };
    const verified = verifyPayment(payment, "biz_test", { paymentId: "pay_legacy", accountId: "biz_test" });
    expect(verified).toMatchObject({ amountCents: 125, paidAt: Date.parse("2026-11-16T05:59:59Z") });
    expect(verifyPayment({ ...payment, paid_at: null }, "biz_test", { paymentId: "pay_legacy", accountId: "biz_test" }).paidAt).toBeUndefined();
    for (const paid_at of ["invalid", "2026-11-16", 123]) expect(() => verifyPayment({ ...payment, paid_at }, "biz_test", { paymentId: "pay_legacy", accountId: "biz_test" })).toThrow();
  });

  it("ignores pending, failed and replayed events; credits actual paid ritual dates over reusable checkouts", async () => {
    const { t, tree } = await fixture();
    const input = { deviceId, treeId: tree.treeId, memberId: tree.memberId, amountCents: 150, checkoutId: "ch_time" };
    const rowId = await t.mutation(internal.lanterns.recordPending, input);
    expect((await t.query(api.streaks.summary, { deviceId, treeId: tree.treeId })).giving.count).toBe(0);
    const event = { treeId: tree.treeId, memberId: tree.memberId, amountCents: 150, checkoutId: "ch_time", paymentId: "pay_time", paidAt: Date.parse("2026-11-16T05:59:59.999Z") };
    await expect(t.mutation(internal.lanterns.applyPayment, { ...event, amountCents: 200 })).rejects.toThrow();
    expect((await t.run(ctx => ctx.db.get(rowId)))?.status).toBe("pending");
    vi.setSystemTime(new Date("2026-11-16T12:00:00Z"));
    await t.mutation(internal.lifecycle.morning);
    await Promise.all(Array.from({ length: 5 }, () => t.mutation(internal.lanterns.applyPayment, event)));
    expect((await t.run(ctx => ctx.db.get(rowId)))?.creditedDate).toBe("2026-11-15");
    expect((await t.query(api.streaks.summary, { deviceId, treeId: tree.treeId })).giving).toMatchObject({ count: 1, status: "at_risk", totalCents: 150 });
    await t.mutation(internal.lanterns.applyPayment, { ...event, paymentId: "pay_next", paidAt: Date.parse("2026-11-16T06:00:00Z") });
    await t.mutation(internal.lanterns.applyPayment, { ...event, paymentId: "pay_same_date", paidAt: Date.parse("2026-11-16T07:00:00Z") });
    expect((await t.query(api.streaks.summary, { deviceId, treeId: tree.treeId })).giving).toMatchObject({ count: 2, status: "current", totalCents: 450 });
    expect(await t.run(ctx => ctx.db.query("lanterns").collect())).toHaveLength(3);
  });

  it("preserves undated historical money and fills only missing facts on verified replay or bounded backfill", async () => {
    const { t, tree } = await fixture();
    const input = { deviceId, treeId: tree.treeId, memberId: tree.memberId, amountCents: 100, checkoutId: "ch_legacy" };
    const rowId = await t.mutation(internal.lanterns.recordPending, input);
    const event = { treeId: tree.treeId, memberId: tree.memberId, amountCents: 100, checkoutId: "ch_legacy", paymentId: "pay_legacy" };
    await t.mutation(internal.lanterns.applyPayment, event);
    expect(await t.query(api.streaks.summary, { deviceId, treeId: tree.treeId })).toMatchObject({ undatedPaidCount: 1, giving: { count: 0, totalCents: 100 } });
    const paidAt = Date.parse("2026-11-14T20:00:00Z");
    await t.mutation(internal.lanterns.applyPayment, { ...event, paidAt });
    await t.mutation(internal.lanterns.backfillPaymentFacts, { ...event, rowId, paidAt });
    expect(await t.run(ctx => ctx.db.query("lanterns").collect())).toHaveLength(1);
    expect(await t.query(api.streaks.summary, { deviceId, treeId: tree.treeId })).toMatchObject({ undatedPaidCount: 0, giving: { count: 1, status: "at_risk", totalCents: 100 } });
    await expect(t.mutation(internal.lanterns.backfillPaymentFacts, { ...event, rowId, paidAt: paidAt + 1000 })).rejects.toThrow("Conflicting");
    const pendingId = await t.mutation(internal.lanterns.recordPending, { ...input, checkoutId: "ch_pending" });
    await expect(t.mutation(internal.lanterns.backfillPaymentFacts, { ...event, rowId: pendingId, paidAt })).rejects.toThrow("changed");
    const page = await t.query(internal.lanterns.backfillPage, { cursor: null });
    expect(page.page).toEqual([]);
  });

  it("refuses ambiguous duplicate historical payment IDs without changing ledger rows", async () => {
    const { t, tree } = await fixture();
    const id = await contribution(t, tree, "2026-11-14", 100);
    await t.run(async ctx => {
      await ctx.db.patch(id, { whopPaymentId: "pay_duplicate" });
      const row = (await ctx.db.get(id))!;
      const { _id, _creationTime, ...copy } = row;
      await ctx.db.insert("lanterns", copy);
    });
    const event = { rowId: id, treeId: tree.treeId, memberId: tree.memberId, amountCents: 100, checkoutId: `ch_2026-11-14_${tree.treeId}_100`, paymentId: "pay_duplicate", paidAt: Date.parse("2026-11-14T06:00:01Z") };
    await expect(t.mutation(internal.lanterns.backfillPaymentFacts, event)).rejects.toThrow("Duplicate");
    expect(await t.run(ctx => ctx.db.query("lanterns").collect())).toHaveLength(2);
  });
});

describe("isolated demo history and paid reaction", () => {
  it("starts both streaks at3 at risk, next explicit demo watering shows4, and replay/reset cannot contaminate real facts", async () => {
    const { t, tree } = await fixture();
    await contribution(t, tree, "2026-11-14", 100);
    const run = await t.mutation(api.demo.restart, { deviceId, treeId: tree.treeId });
    expect(await t.query(api.streaks.summary, { deviceId, treeId: tree.treeId })).toMatchObject({ answer: { count: 3, status: "at_risk" }, giving: { count: 3, status: "at_risk", totalCents: 150 }, isDemo: true });
    const grove = await t.query(api.days.grove, { deviceId, treeId: tree.treeId });
    expect(grove).toHaveLength(3);
    expect(grove[0].fruits[0]).toMatchObject({ golden: true, source: "demo", milestone: 3, isMine: true });
    await expect(t.mutation(api.waterings.demoWater, { deviceId, treeId: tree.treeId, runId: run.dayId, amountCents: 50 })).rejects.toThrow("not available");
    await t.mutation(api.answers.submit, { deviceId, dayId: run.dayId, text: "Today's demo answer" });
    await vi.advanceTimersByTimeAsync(30_001);
    await t.finishInProgressScheduledFunctions();
    const args = { deviceId, treeId: tree.treeId, runId: run.dayId, amountCents: 50 };
    const results = await Promise.all(Array.from({ length: 5 }, () => t.mutation(api.waterings.demoWater, args)));
    expect(new Set(results.map(row => row.wateringId)).size).toBe(1);
    const today = await t.query(api.days.today, { deviceId, treeId: tree.treeId });
    expect(today?.streaks).toMatchObject({ answer: { count: 4, status: "current" }, giving: { count: 4, status: "current", totalCents: 200 } });
    expect(today?.fruits[0]).toMatchObject({ golden: false, source: "demo" });
    expect(today?.wateringEvent?.id).toBe(results[0].wateringId);
    expect(today?.raisedCents).toBe(100);
    const realContext = await t.query(ctx => notificationGivingContext(ctx, deviceId, Date.now()));
    expect(realContext).toMatchObject({ giving: { count: 1, atRisk: true }, isDemo: false });
    const next = await t.mutation(api.demo.restart, { deviceId, treeId: tree.treeId });
    await expect(t.mutation(api.waterings.demoWater, args)).rejects.toThrow("not available");
    expect((await t.query(api.days.today, { deviceId, treeId: tree.treeId }))?.wateringEvent).toBeNull();
    expect((await t.query(api.days.grove, { deviceId, treeId: tree.treeId }))).toHaveLength(3);
    expect((await t.query(api.streaks.summary, { deviceId, treeId: tree.treeId })).giving.count).toBe(3);
    await t.mutation(api.demo.stop, { deviceId, treeId: tree.treeId });
    expect((await t.query(api.streaks.summary, { deviceId, treeId: tree.treeId })).giving).toMatchObject({ count: 1, totalCents: 100 });
    expect(next.dayId).not.toBe(run.dayId);
  });

  it("keeps late genuine demo checkout callbacks in real totals but out of a newer run's fruit/reaction", async () => {
    const { t, tree } = await fixture();
    const run = await t.mutation(api.demo.restart, { deviceId, treeId: tree.treeId });
    await t.mutation(internal.lanterns.recordPending, { deviceId, treeId: tree.treeId, memberId: tree.memberId, amountCents: 150, checkoutId: "ch_demo_real" });
    await t.mutation(api.demo.restart, { deviceId, treeId: tree.treeId });
    const paidAt = Date.now();
    const event = { treeId: tree.treeId, memberId: tree.memberId, amountCents: 150, checkoutId: "ch_demo_real", paymentId: "pay_real_demo", paidAt };
    await t.mutation(internal.lanterns.applyPayment, event);
    await t.mutation(internal.lanterns.applyPayment, event);
    const today = await t.query(api.days.today, { deviceId, treeId: tree.treeId });
    expect(today?.raisedCents).toBe(150);
    expect(today?.wateringEvent).toBeNull();
    expect(today?.fruits).toEqual([]);
    expect(today?.streaks.giving).toMatchObject({ count: 3, totalCents: 150 });
    await t.mutation(api.demo.stop, { deviceId, treeId: tree.treeId });
    const real = await t.query(api.days.today, { deviceId, treeId: tree.treeId });
    expect(real?.streaks.giving).toMatchObject({ count: 1, totalCents: 150 });
    expect(real?.fruits[0]).toMatchObject({ source: "whop" });
    const paid = await t.run(ctx => ctx.db.query("lanterns").withIndex("by_payment", q => q.eq("whopPaymentId", "pay_real_demo")).collect());
    expect(paid).toHaveLength(1);
    expect(paid[0].demoRunId).toBe(run.dayId);
  });
});
