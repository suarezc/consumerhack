import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import type { FunctionReturnType } from "convex/server";
import { questions } from "../convex/questions";
import { sackCharity, wateringLabel } from "../convex/charity";
import { bundleCents, verifyPayment } from "../convex/lib/payments";
import * as direct from "../convex/lib/whopDirect";

const modules = import.meta.glob("../convex/**/*.ts");
const deviceId = "charity-bearer-owner-0000001";
const friend = "charity-bearer-friend-000001";
let sequence = 0;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
  vi.stubEnv("WHOP_ENVIRONMENT", "sandbox");
  vi.stubEnv("EXPO_PUSH_ENABLED", "false");
  sequence = 0;
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function fixture() {
  const t = convexTest(schema, modules);
  const tree = await t.mutation(api.trees.create, { deviceId, name: "A charity tree", memberName: "Host" });
  await t.mutation(api.trees.join, { deviceId: friend, code: tree.code, memberName: "Friend" });
  await t.mutation(internal.lanterns.recordCauseAccount, { accountId: "biz_childfixture", applicationFeeCents: 0 });
  return { t, tree };
}

type Test = Awaited<ReturnType<typeof fixture>>["t"];
type Tree = Awaited<ReturnType<typeof fixture>>["tree"];

async function answer(t: Test, tree: Tree, identity = deviceId) {
  return await t.mutation(api.answers.submit, { deviceId: identity, dayId: tree.dayId, text: "A private moment of kindness" });
}

async function intent(t: Test, tree: Tree, bundles: 2 | 5 | 10 = 2, identity = deviceId) {
  const prepared = await t.mutation(internal.lanterns.prepareWatering, { deviceId: identity, treeId: tree.treeId, dayId: tree.dayId, bundles });
  const checkoutId = `ch_fixture${++sequence}`;
  await t.mutation(internal.lanterns.attachCheckout, { wateringId: prepared.wateringId, checkoutId });
  return { ...prepared, checkoutId };
}

type Intent = Awaited<ReturnType<typeof intent>>;
function payment(value: Intent, paymentId = `pay_fixture${++sequence}`, paidAt: number | undefined = Date.now()) {
  return { paymentId, checkoutId: value.checkoutId, treeId: value.treeId, memberId: value.memberId,
    userId: value.userId, dayId: value.dayId, answerId: value.answerId, bundles: value.bundles,
    amountCents: value.amountCents, recipientAccountId: value.expectedRecipientAccountId, ...(paidAt === undefined ? {} : { paidAt }) };
}

describe("charity snapshots and transactional questions", () => {
  it("persists the complete daily charity and exact CTA without requiring an old tree cause", async () => {
    const { t, tree } = await fixture();
    const today = await t.query(api.days.today, { deviceId, treeId: tree.treeId });
    expect(today?.charity).toEqual(sackCharity);
    expect(today?.charity.programs).toHaveLength(4);
    expect(today?.charity.link).toBe("https://simpleacts.org/");
    expect(today?.wateringLabel).toBe(wateringLabel);
    expect(today?.wateringLabel).toBe("Water today's tree for S.A.C.K.");
    expect((await t.run(ctx => ctx.db.get(tree.dayId)))?.charity).toEqual(sackCharity);
    expect(today?.totalRaisedCents).toBe(0);
  });

  it("uses every themed question before repeating and does not consume entries on concurrent retries", async () => {
    const { t, tree } = await fixture();
    expect(questions.length).toBeGreaterThanOrEqual(20);
    expect(new Set(questions).size).toBe(questions.length);
    const chosen: string[] = [];
    for (let index = 0; index <= questions.length; index++) {
      vi.setSystemTime(new Date(Date.parse("2026-11-15T12:00:00Z") + index * 86_400_000));
      await Promise.all(Array.from({ length: 4 }, () => t.mutation(internal.lifecycle.morning)));
      const day = await t.query(api.days.today, { deviceId, treeId: tree.treeId });
      chosen.push(day!.day.question);
      expect((await t.run(ctx => ctx.db.get(day!.day.dayId)))?.charity).toEqual(sackCharity);
    }
    expect(new Set(chosen.slice(0, questions.length)).size).toBe(questions.length);
    expect(chosen.slice(0, questions.length)).toEqual(questions);
    expect(chosen[questions.length]).toBe(chosen[0]);
    expect(await t.run(ctx => ctx.db.query("days").withIndex("by_tree", q => q.eq("treeId", tree.treeId)).collect())).toHaveLength(questions.length + 1);
    const cursor = (await t.run(ctx => ctx.db.get(tree.treeId)))?.questionCursor;
    await t.mutation(api.demo.restart, { deviceId, treeId: tree.treeId });
    await t.mutation(api.demo.stop, { deviceId, treeId: tree.treeId });
    expect((await t.run(ctx => ctx.db.get(tree.treeId)))?.questionCursor).toBe(cursor);
  });

  it("initializes a legacy tree's cycle without immediately repeating an already-used catalog question", async () => {
    const { t, tree } = await fixture();
    await t.run(ctx => ctx.db.patch(tree.treeId, { questionCursor: undefined, questionUsed: undefined }));
    vi.setSystemTime(new Date("2026-11-16T12:00:00Z"));
    await t.mutation(internal.lifecycle.morning);
    expect((await t.query(api.days.today, { deviceId, treeId: tree.treeId }))?.day.question).toBe(questions[1]);
    expect((await t.run(ctx => ctx.db.get(tree.dayId)))?.question).toBe(questions[0]);
  });
});

describe("authorized immutable bundle intents", () => {
  it("requires this user's current-day answer, permits watering before and after bloom, and rejects stale or foreign targets", async () => {
    const { t, tree } = await fixture();
    const args = { deviceId, treeId: tree.treeId, dayId: tree.dayId, bundles: 2 as const };
    await expect(t.mutation(internal.lanterns.prepareWatering, args)).rejects.toThrow("Answer");
    await answer(t, tree);
    expect((await t.run(ctx => ctx.db.get(tree.dayId)))?.bloomedAt).toBeUndefined();
    const before = await intent(t, tree);
    expect(before.amountCents).toBe(100);
    expect(before.userId).not.toBe(deviceId);
    expect(JSON.stringify(before)).not.toContain(deviceId);
    expect((await t.run(ctx => ctx.db.get(before.userId)))?.deviceId).toBe(deviceId);
    await expect(t.mutation(internal.lanterns.prepareWatering, { ...args, deviceId: friend })).rejects.toThrow("Answer");
    const other = await t.mutation(api.trees.create, { deviceId, name: "Another membership", memberName: "Host" });
    await answer(t, other);
    const otherIntent = await intent(t, other);
    expect(otherIntent.userId).toBe(before.userId);
    await expect(t.mutation(internal.lanterns.prepareWatering, { ...args, dayId: other.dayId })).rejects.toThrow("current");
    vi.setSystemTime(new Date("2026-11-15T21:00:00Z"));
    await t.mutation(internal.lifecycle.bloom, { dayId: tree.dayId });
    expect((await intent(t, tree, 5)).amountCents).toBe(250);
    vi.setSystemTime(new Date("2026-11-16T06:00:00Z"));
    await expect(t.mutation(internal.lanterns.prepareWatering, args)).rejects.toThrow("current");
  });

  it("offers only2/5/10 bundles, derives cents server-side, and fails closed without a configured child", async () => {
    const { t, tree } = await fixture();
    expect([2, 5, 10].map(bundleCents)).toEqual([100, 250, 500]);
    for (const value of [0, 1, 2.5, 101]) expect(() => bundleCents(value)).toThrow();
    await answer(t, tree);
    await expect(t.action(api.waterings.checkout, { deviceId, treeId: tree.treeId, dayId: tree.dayId, bundles: 2, amountCents: 1 } as never)).rejects.toThrow();
    const causeId = (await t.run(ctx => ctx.db.get(tree.dayId)))!.causeId!;
    await t.run(ctx => ctx.db.patch(causeId, { childAccountId: undefined }));
    await expect(intent(t, tree)).rejects.toThrow("not configured");
    expect(await t.run(ctx => ctx.db.query("lanterns").collect())).toHaveLength(0);
    await expect(t.mutation(internal.lanterns.recordCauseAccount, { accountId: "biz_childfixture", applicationFeeCents: 1 })).rejects.toThrow();
  });

  it("creates one stable fruit per paid bundle and one event per payment, with distinct-person totals", async () => {
    const { t, tree } = await fixture();
    await answer(t, tree);
    const five = await intent(t, tree, 5);
    const args = { deviceId, treeId: tree.treeId };
    expect((await t.query(api.days.today, args))?.totalRaisedCents).toBe(0);
    expect((await t.query(api.days.today, args))?.fruits).toHaveLength(1);
    expect((await t.query(api.days.today, args))?.lightBundles).toBe(0);
    const paid = payment(five);
    await Promise.all(Array.from({ length: 4 }, () => t.mutation(internal.lanterns.applyPayment, paid)));
    const first = await t.query(api.days.today, args);
    expect(first?.fruits.map(fruit => fruit.fruitId)).toEqual([`response:${first?.myAnswer?.answerId}`]);
    expect(first?.lightBundles).toBe(5);
    expect(first?.lightEvent).toEqual({ id: five.wateringId, lightBundles: 5, revision: 2 });
    expect(first).toMatchObject({ totalRaisedCents: 250, myGivenCents: 250, watererCount: 1, answererCount: 1 });
    expect(first?.answers).toEqual([]);
    const secondPay = payment(five, "pay_repeatlink", Date.now() + 1);
    await t.mutation(internal.lanterns.applyPayment, secondPay);
    await t.mutation(internal.lanterns.applyPayment, secondPay);
    const ten = await intent(t, tree, 10);
    await t.mutation(internal.lanterns.applyPayment, payment(ten));
    let state = await t.query(api.days.today, args);
    expect(state).toMatchObject({ totalRaisedCents: 1000, watererCount: 1 });
    expect(state?.fruits).toHaveLength(1);
    expect(state?.fruits).toEqual(first?.fruits);
    expect(state?.lightBundles).toBe(20);
    expect(state?.streaks.giving).toMatchObject({ count: 1, status: "current", totalCents: 1000 });
    await answer(t, tree, friend);
    const other = await intent(t, tree, 2, friend);
    await t.mutation(internal.lanterns.applyPayment, payment(other));
    state = await t.query(api.days.today, args);
    expect(state).toMatchObject({ totalRaisedCents: 1100, myGivenCents: 1000, watererCount: 2, answererCount: 2 });
    expect(state?.fruits).toHaveLength(2);
    expect(state?.lightBundles).toBe(22);
    for (const privateValue of [deviceId, friend, "whopPaymentId", "memberId", "userId"]) expect(JSON.stringify(state?.fruits)).not.toContain(privateValue);
  });

  it("keeps captured recipient and day immutable across cause updates and provider latency", async () => {
    const { t, tree } = await fixture();
    await answer(t, tree);
    const captured = await intent(t, tree, 2);
    await t.mutation(internal.lanterns.recordCauseAccount, { accountId: "biz_replacement", applicationFeeCents: 0 });
    const next = await intent(t, tree, 5);
    expect(captured.expectedRecipientAccountId).toBe("biz_childfixture");
    expect(next.expectedRecipientAccountId).toBe("biz_replacement");
    const paid = payment(captured);
    await expect(t.mutation(internal.lanterns.applyPayment, { ...paid, recipientAccountId: "biz_replacement" })).rejects.toThrow("recipient");
    await expect(t.mutation(internal.lanterns.applyPayment, { ...paid, userId: next.memberId })).rejects.toThrow();
    expect((await t.run(ctx => ctx.db.get(captured.wateringId)))?.status).toBe("pending");
    await t.mutation(internal.lanterns.applyPayment, paid);
    expect((await t.run(ctx => ctx.db.get(captured.wateringId)))?.expectedRecipientAccountId).toBe("biz_childfixture");
  });
});

describe("closed impact and historical attribution", () => {
  it("colors every bundle by another person's historical cross-tree milestone, unchanged after later giving", async () => {
    const { t, tree } = await fixture();
    const other = await t.mutation(api.trees.create, { deviceId: friend, name: "Private membership", memberName: "Friend" });
    await t.run(async ctx => {
      for (const date of ["2026-11-13", "2026-11-14"]) await ctx.db.insert("lanterns", {
        treeId: other.treeId, memberId: other.memberId, amountCents: 100, status: "paid", source: "whop",
        whopPaymentId: `pay_prior${date}`, whopCheckoutId: `ch_prior${date}`, creditedDate: date,
        paidAt: Date.parse(`${date}T12:00:00Z`), createdAt: Date.now(),
      });
    });
    await answer(t, tree, friend);
    const captured = await intent(t, tree, 5, friend);
    await t.mutation(internal.lanterns.applyPayment, payment(captured));
    let shared = await t.query(api.days.today, { deviceId, treeId: tree.treeId });
    expect(shared?.fruits).toHaveLength(1);
    expect(shared?.fruits.every(fruit => !fruit.golden && !fruit.isMine)).toBe(true);
    expect(shared?.lightBundles).toBe(5);
    expect(shared?.goldenLightBundles).toBe(5);
    expect(shared?.lightEvent).toBeNull();
    vi.setSystemTime(new Date("2026-11-16T12:00:00Z"));
    await t.mutation(internal.lifecycle.morning);
    const next = await t.query(api.days.today, { deviceId: friend, treeId: tree.treeId });
    const currentTree = { ...tree, dayId: next!.day.dayId };
    await answer(t, currentTree, friend);
    const fourth = await intent(t, currentTree, 2, friend);
    await t.mutation(internal.lanterns.applyPayment, payment(fourth));
    shared = await t.query(api.days.today, { deviceId, treeId: tree.treeId });
    expect(shared?.fruits.every(fruit => !fruit.golden)).toBe(true);
    expect(shared?.lightBundles).toBe(2);
    expect(shared?.goldenLightBundles).toBe(0);
    const grove = await t.query(api.days.grove, { deviceId: friend, treeId: tree.treeId });
    const yesterday = grove.find(day => day.date === "2026-11-15");
    expect(yesterday?.fruits).toHaveLength(1);
    expect(yesterday?.fruits.every(fruit => !fruit.golden)).toBe(true);
    expect(yesterday?.lightBundles).toBe(5);
    expect(yesterday?.goldenLightBundles).toBe(5);
    expect((await t.query(api.streaks.summary, { deviceId: friend, treeId: tree.treeId })).giving.count).toBe(4);
  });

  it("closes once at06:00 and idempotently adjusts yesterday for actual late settlement", async () => {
    vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
    const { t, tree } = await fixture();
    await answer(t, tree);
    const first = await intent(t, tree, 2);
    const second = await intent(t, tree, 5);
    vi.setSystemTime(new Date("2026-11-15T00:00:00Z"));
    await t.mutation(internal.lifecycle.morning);
    expect((await t.run(ctx => ctx.db.get(tree.dayId)))?.closedAt).toBeUndefined();
    vi.setSystemTime(new Date("2026-11-15T06:00:00Z"));
    await Promise.all([t.mutation(internal.lifecycle.morning), t.mutation(internal.lifecycle.morning)]);
    expect((await t.run(ctx => ctx.db.get(tree.dayId)))?.impact).toMatchObject({ totalRaisedCents: 0, answererCount: 1, watererCount: 0 });
    const paid = payment(first, "pay_late", Date.parse("2026-11-15T07:00:00Z"));
    await t.mutation(internal.lanterns.applyPayment, paid);
    await t.mutation(internal.lanterns.applyPayment, paid);
    expect(await t.run(ctx => ctx.db.get(first.wateringId))).toMatchObject({ dayId: tree.dayId, creditedDate: "2026-11-14", paidAt: paid.paidAt });
    let yesterday = await t.query(api.days.yesterday, { deviceId, treeId: tree.treeId });
    expect(yesterday).toMatchObject({ totalRaisedCents: 100, answererCount: 1, watererCount: 1, myGivenCents: 100 });
    expect(yesterday?.fruits).toHaveLength(1);
    expect(yesterday?.lightBundles).toBe(2);
    expect((await t.query(api.days.today, { deviceId, treeId: tree.treeId }))?.totalRaisedCents).toBe(0);
    expect((await t.query(api.streaks.summary, { deviceId, treeId: tree.treeId })).giving).toMatchObject({ count: 1, status: "at_risk" });
    await t.mutation(internal.lanterns.applyPayment, payment(second, "pay_secondlate", Date.parse("2026-11-15T08:00:00Z")));
    yesterday = await t.query(api.days.yesterday, { deviceId, treeId: tree.treeId });
    expect(yesterday).toMatchObject({ totalRaisedCents: 350, answererCount: 1, watererCount: 1, myGivenCents: 350 });
    expect((await t.run(ctx => ctx.db.get(tree.dayId)))?.impact).toMatchObject({ totalRaisedCents: 350, watererCount: 1 });
    const closedAt = (await t.run(ctx => ctx.db.get(tree.dayId)))?.closedAt;
    await t.mutation(internal.lifecycle.morning);
    expect((await t.run(ctx => ctx.db.get(tree.dayId)))?.closedAt).toBe(closedAt);
  });

  it("repairs an initially undated canonical payment without shifting target day or fabricating success feedback", async () => {
    const { t, tree } = await fixture();
    await answer(t, tree);
    const captured = await intent(t, tree);
    const { paidAt: _, ...undated } = payment(captured, "pay_undatedcanonical");
    await t.mutation(internal.lanterns.applyPayment, undated);
    let today = await t.query(api.days.today, { deviceId, treeId: tree.treeId });
    expect(today?.fruits).toHaveLength(1);
    expect(today?.fruits[0]).not.toHaveProperty("paidAt");
    expect(today?.lightBundles).toBe(2);
    expect(today?.lightEvent).toBeNull();
    expect(today?.streaks.giving.count).toBe(1);
    vi.setSystemTime(new Date("2026-11-16T12:00:00Z"));
    await t.mutation(internal.lifecycle.morning);
    const paidAt = Date.now();
    await t.mutation(internal.lanterns.backfillPaymentFacts, { ...undated, rowId: captured.wateringId, paidAt });
    await t.mutation(internal.lanterns.applyPayment, { ...undated, paidAt });
    expect(await t.run(ctx => ctx.db.get(captured.wateringId))).toMatchObject({ dayId: tree.dayId, creditedDate: "2026-11-15", paidAt });
    expect((await t.run(ctx => ctx.db.get(captured.wateringId)))?.confirmedAt).toBeUndefined();
    today = await t.query(api.days.today, { deviceId, treeId: tree.treeId });
    expect(today?.lightEvent).toBeNull();
    expect(today?.totalRaisedCents).toBe(0);
    expect(today?.streaks.giving).toMatchObject({ count: 1, status: "at_risk", totalCents: 100 });
    expect((await t.query(api.days.yesterday, { deviceId, treeId: tree.treeId }))?.totalRaisedCents).toBe(100);
  });

  it("preserves legacy nonpreset3-bundle and unknown nondivisible amounts without duplicate money", async () => {
    const { t, tree } = await fixture();
    for (const amountCents of [150, 125]) {
      const checkoutId = `ch_legacy${amountCents}`;
      const paymentId = `pay_legacy${amountCents}`;
      const rowId = await t.run(ctx => ctx.db.insert("lanterns", { treeId: tree.treeId, memberId: tree.memberId,
        amountCents, status: "paid", whopCheckoutId: checkoutId, whopPaymentId: paymentId, createdAt: Date.now() - 1000 }));
      const paid = { rowId, checkoutId, paymentId, treeId: tree.treeId, memberId: tree.memberId, amountCents, paidAt: Date.now() };
      await t.mutation(internal.lanterns.backfillPaymentFacts, paid);
      await t.mutation(internal.lanterns.backfillPaymentFacts, paid);
      const row = await t.run(ctx => ctx.db.get(rowId));
      expect(row).toMatchObject({ attribution: "provider_day", dayId: tree.dayId, creditedDate: "2026-11-15", amountCents });
      expect(row?.bundles).toBe(amountCents === 150 ? 3 : undefined);
      expect(row?.confirmedAt).toBeUndefined();
    }
    const state = await t.query(api.days.today, { deviceId, treeId: tree.treeId });
    expect(state).toMatchObject({ totalRaisedCents: 275, watererCount: 1, myGivenCents: 275 });
    expect(state?.fruits).toEqual([]);
    expect(state?.lightBundles).toBe(3);
    expect(state?.lightEvent).toBeNull();
    expect(await t.run(ctx => ctx.db.query("lanterns").collect())).toHaveLength(2);
  });
});

describe("first-open impact and isolated40/12 demo", () => {
  it("returns distinct public impact and only the viewer amount without leaking private content", async () => {
    const { t, tree } = await fixture();
    const run = await t.mutation(api.demo.restart, { deviceId, treeId: tree.treeId });
    const first = await t.query(api.days.firstOpen, { deviceId, treeId: tree.treeId });
    expect(first).toMatchObject({ todayDayId: run.dayId, shouldShowYesterday: true, yesterday: {
      answererCount: 40, watererCount: 12, totalRaisedCents: 1200, myGivenCents: 100, isDemo: true, charity: sackCharity,
    } });
    expect(first?.yesterday?.fruits).toHaveLength(40);
    expect(first?.yesterday?.fruits.filter(fruit => fruit.isMine)).toHaveLength(1);
    expect(first?.yesterday?.fruits.every(fruit => !fruit.golden)).toBe(true);
    expect(first?.yesterday?.lightBundles).toBe(24);
    expect(first?.yesterday?.goldenLightBundles).toBe(2);
    const other = await t.query(api.days.yesterday, { deviceId: friend, treeId: tree.treeId });
    expect(other).toMatchObject({ answererCount: 40, watererCount: 12, totalRaisedCents: 1200, myGivenCents: 0 });
    for (const value of [deviceId, friend, "Private", "text", "userId", "memberId", "whopPaymentId"]) expect(JSON.stringify(other)).not.toContain(value);
    expect((await t.query(api.days.today, { deviceId, treeId: tree.treeId }))?.memberCount).toBe(5);
  });

  it("acknowledges once per user/tree/day and shows a new run/day again", async () => {
    const { t, tree } = await fixture();
    const run = await t.mutation(api.demo.restart, { deviceId, treeId: tree.treeId });
    const args = { deviceId, treeId: tree.treeId, dayId: run.dayId };
    await Promise.all(Array.from({ length: 4 }, () => t.mutation(api.days.acknowledgeYesterday, args)));
    expect((await t.query(api.days.firstOpen, { deviceId, treeId: tree.treeId }))?.shouldShowYesterday).toBe(false);
    expect((await t.query(api.days.firstOpen, { deviceId: friend, treeId: tree.treeId }))?.shouldShowYesterday).toBe(true);
    expect(await t.run(ctx => ctx.db.query("impactViews").collect())).toHaveLength(1);
    const next = await t.mutation(api.demo.restart, { deviceId, treeId: tree.treeId });
    expect((await t.query(api.days.firstOpen, { deviceId, treeId: tree.treeId }))?.shouldShowYesterday).toBe(true);
    await expect(t.mutation(api.days.acknowledgeYesterday, args)).rejects.toThrow("no longer current");
    await t.mutation(api.demo.stop, { deviceId, treeId: tree.treeId });
    await t.mutation(api.days.acknowledgeYesterday, { deviceId, treeId: tree.treeId, dayId: tree.dayId });
    vi.setSystemTime(new Date("2026-11-16T12:00:00Z"));
    await t.mutation(internal.lifecycle.morning);
    const tomorrow = await t.query(api.days.firstOpen, { deviceId, treeId: tree.treeId });
    expect(tomorrow?.shouldShowYesterday).toBe(true);
    expect(tomorrow?.todayDayId).not.toBe(next.dayId);
  });

  it("seeds exactly3 personal dates, supports pre-bloom synthetic bundles and isolates retries/reset from real giving", async () => {
    const { t, tree } = await fixture();
    const run = await t.mutation(api.demo.restart, { deviceId, treeId: tree.treeId });
    const args = { deviceId, treeId: tree.treeId };
    expect(await t.query(api.streaks.summary, args)).toMatchObject({ answer: { count: 3, status: "at_risk" }, giving: { count: 3, status: "at_risk", totalCents: 300 } });
    const data = await t.run(async ctx => ({ days: await ctx.db.query("days").withIndex("by_tree", q => q.eq("treeId", tree.treeId)).collect(),
      own: await ctx.db.query("lanterns").withIndex("by_member", q => q.eq("memberId", tree.memberId)).collect() }));
    expect(data.days.filter(day => day.demoRunId === run.dayId)).toHaveLength(4);
    expect(data.own.filter(row => row.demoRunId === run.dayId)).toHaveLength(3);
    const input = { ...args, dayId: run.dayId, bundles: 5 as const, requestId: "demo-interaction-00001" };
    await expect(t.mutation(api.waterings.demoWater, input)).rejects.toThrow("answer first");
    await t.mutation(api.answers.submit, { deviceId, dayId: run.dayId, text: "An explicitly synthetic demo answer" });
    expect((await t.run(ctx => ctx.db.get(run.dayId)))?.bloomedAt).toBeUndefined();
    const row = await t.mutation(api.waterings.demoWater, input);
    const repeated = await t.mutation(api.waterings.demoWater, input);
    expect(repeated.wateringId).toBe(row.wateringId);
    await expect(t.mutation(api.waterings.demoWater, { ...input, bundles: 2 })).rejects.toThrow("different bundles");
    let state = await t.query(api.days.today, args);
    expect(state?.fruits).toHaveLength(1);
    expect(state?.lightBundles).toBe(5);
    expect(state?.streaks.giving).toMatchObject({ count: 4, status: "current", totalCents: 550 });
    expect(state?.totalRaisedCents).toBe(250);
    expect(state?.raisedCents).toBe(0);
    expect(state?.lightEvent?.lightBundles).toBe(5);
    await t.mutation(api.waterings.demoWater, { ...input, bundles: 2, requestId: "demo-interaction-00002" });
    expect((await t.query(api.days.today, args))?.fruits).toHaveLength(1);
    expect((await t.query(api.days.today, args))?.lightBundles).toBe(7);
    await t.mutation(api.demo.restart, args);
    state = await t.query(api.days.today, args);
    expect(state?.fruits).toEqual([]);
    expect(state?.lightEvent).toBeNull();
    expect(state?.streaks.giving.count).toBe(3);
    await expect(t.mutation(api.waterings.demoWater, input)).rejects.toThrow("not available");
    await t.mutation(api.demo.stop, args);
    expect((await t.query(api.streaks.summary, args)).giving).toMatchObject({ count: 0, totalCents: 0 });
    expect(await t.run(ctx => ctx.db.query("lanterns").filter(q => q.eq(q.field("source"), "whop")).collect())).toHaveLength(0);
  });
});

describe("canonical verification and bounded migration failures", () => {
  it("separately verifies child/parent signed routes, provider facts and replay before atomic settlement", async () => {
    const { t, tree } = await fixture();
    await answer(t, tree);
    const captured = await intent(t, tree, 5);
    const money = { amount: "2.50", currency: "usd", decimals: 2 };
    let provider = { id: "pay_signedchild", account_id: "biz_childfixture", status: "paid", currency: "usd",
      checkout_configuration_id: captured.checkoutId, subtotal: money, total: money, paid_at: "2026-11-15T12:00:00Z",
      metadata: { integration: "storytime-watering-sandbox-v2", treeId: tree.treeId, memberId: captured.memberId,
        answerId: captured.answerId, userId: captured.userId, dayId: captured.dayId, bundles: 5 } };
    const retrieve = vi.fn(async () => provider);
    vi.spyOn(direct, "sandboxDirectClient").mockReturnValue({ payments: { retrieve }, accounts: { me: async () => ({ id: "biz_platform" }) } } as unknown as ReturnType<typeof direct.sandboxDirectClient>);
    const parentSecret = "parent-signature-unit-test";
    const childSecret = "child-signature-unit-test";
    vi.stubEnv("WHOP_API_KEY", "not-a-real-api-key");
    vi.stubEnv("WHOP_WEBHOOK_SECRET", parentSecret);
    vi.stubEnv("WHOP_CHILD_WEBHOOK_SECRET", childSecret);
    const body = JSON.stringify({ id: "msg_child", type: "payment.succeeded", account_id: "biz_childfixture", data: { id: provider.id } });
    const signed = async (secret: string) => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`msg_child.${timestamp}.${body}`));
      const signature = btoa(String.fromCharCode(...new Uint8Array(digest)));
      return { method: "POST", body, headers: { "webhook-id": "msg_child", "webhook-timestamp": timestamp, "webhook-signature": `v1,${signature}` } };
    };
    expect((await t.fetch("/whop/children", (await signed(parentSecret)))).status).toBe(401);
    expect(retrieve).not.toHaveBeenCalled();
    expect((await t.fetch("/whop", (await signed(parentSecret)))).status).toBe(503);
    expect((await t.run(ctx => ctx.db.get(captured.wateringId)))?.status).toBe("pending");
    provider = { ...provider, account_id: "biz_otherownedchild" };
    expect((await t.fetch("/whop/children", (await signed(childSecret)))).status).toBe(503);
    provider = { ...provider, account_id: "biz_childfixture", status: "pending" };
    expect((await t.fetch("/whop/children", (await signed(childSecret)))).status).toBe(503);
    provider = { ...provider, status: "paid" };
    expect((await t.fetch("/whop/children", { ...(await signed(childSecret)), body: `${body} ` })).status).toBe(401);
    expect((await t.fetch("/whop/children", (await signed(childSecret)))).status).toBe(200);
    expect((await t.fetch("/whop/children", (await signed(childSecret)))).status).toBe(200);
    const state = await t.query(api.days.today, { deviceId, treeId: tree.treeId });
    expect(state).toMatchObject({ totalRaisedCents: 250, watererCount: 1 });
    expect(state?.fruits).toHaveLength(1);
    expect(state?.lightBundles).toBe(5);
    expect(await t.run(ctx => ctx.db.query("lanterns").collect())).toHaveLength(1);
  });

  it("verifies exact bundle/metadata/recipient facts while retaining genuine legacy nonstep charges", () => {
    const money = { amount: "2.50", currency: "usd", decimals: 2 };
    const value = { id: "pay_canonical", account_id: "biz_childfixture", status: "paid", currency: "usd",
      checkout_configuration_id: "ch_canonical", subtotal: money, total: money, paid_at: "2026-11-16T07:00:00Z",
      metadata: { integration: "storytime-watering-sandbox-v2", treeId: "tree", memberId: "member", userId: "opaque-user", dayId: "target-day", bundles: 5 } };
    const event = { paymentId: value.id, accountId: value.account_id };
    expect(verifyPayment(value, event.accountId, event)).toMatchObject({ amountCents: 250, userId: "opaque-user", dayId: "target-day", bundles: 5, recipientAccountId: "biz_childfixture" });
    for (const metadata of [{ ...value.metadata, bundles: 2 }, { ...value.metadata, bundles: 3 }, { ...value.metadata, userId: null }, { ...value.metadata, dayId: 123 }]) {
      expect(() => verifyPayment({ ...value, metadata }, event.accountId, event)).toThrow();
    }
    expect(() => verifyPayment(value, "biz_platform", event)).toThrow();
    expect(() => verifyPayment({ ...value, status: "pending" }, event.accountId, event)).toThrow();
    const legacyMoney = { ...money, amount: "1.25" };
    expect(verifyPayment({ ...value, subtotal: legacyMoney, total: legacyMoney,
      metadata: { integration: "storytime-lantern-sandbox", treeId: "tree", memberId: "member" } }, event.accountId, event).amountCents).toBe(125);
  });

  it("paginates bounded legacy candidates without skipping rows or selecting synthetic/pending money", async () => {
    const { t, tree } = await fixture();
    const expected = await t.run(async ctx => {
      const ids = [];
      for (let index = 0; index < 57; index++) {
        const id = await ctx.db.insert("lanterns", { treeId: tree.treeId, memberId: tree.memberId, amountCents: 100,
          status: "paid", whopCheckoutId: `ch_page${index}`, whopPaymentId: `pay_page${index}`, createdAt: Date.now() });
        ids.push(id);
      }
      await ctx.db.insert("lanterns", { treeId: tree.treeId, memberId: tree.memberId, amountCents: 100,
        status: "pending", whopCheckoutId: "ch_pendingpage", createdAt: Date.now() });
      return ids;
    });
    let cursor: string | null = null;
    const seen: string[] = [];
    for (let page = 0; page < 4; page++) {
      const result: FunctionReturnType<typeof internal.lanterns.backfillPage> = await t.query(internal.lanterns.backfillPage, { cursor });
      expect(result.page.length).toBeLessThanOrEqual(25);
      seen.push(...result.page.map(row => row.rowId));
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    expect(new Set(seen)).toEqual(new Set(expected));
    expect(seen).toHaveLength(expected.length);
  });

  it("counts provider failures without leaking details, promoting pending records or adding money", async () => {
    const { t, tree } = await fixture();
    const kinds = ["good", "network", "pending", "undated"];
    await t.run(async ctx => {
      for (const kind of kinds) await ctx.db.insert("lanterns", { treeId: tree.treeId, memberId: tree.memberId,
        amountCents: 100, status: "paid", whopCheckoutId: `ch_${kind}`, whopPaymentId: `pay_${kind}`, createdAt: Date.now() });
      await ctx.db.insert("lanterns", { treeId: tree.treeId, memberId: tree.memberId, amountCents: 100,
        status: "pending", whopCheckoutId: "ch_unpaid", createdAt: Date.now() });
    });
    const retrieve = vi.fn(async ({ id }: { id: string }) => {
      if (id === "pay_network") throw new Error("provider-private-detail");
      const kind = id.slice(4);
      const money = { amount: "1.00", currency: "usd", decimals: 2 };
      return { id, account_id: "biz_platform", status: kind === "pending" ? "pending" : "paid", currency: "usd",
        checkout_configuration_id: `ch_${kind}`, subtotal: money, total: money,
        paid_at: kind === "undated" ? null : "2026-11-15T12:00:00Z",
        metadata: { integration: "storytime-lantern-sandbox", treeId: tree.treeId, memberId: tree.memberId } };
    });
    vi.spyOn(direct, "sandboxDirectClient").mockReturnValue({ payments: { retrieve }, accounts: { me: async () => ({ id: "biz_platform" }) } } as unknown as ReturnType<typeof direct.sandboxDirectClient>);
    const result = await t.action(internal.lanterns.backfillPaidDates, { cursor: null });
    expect(result).toMatchObject({ attempted: 4, failed: 3, isDone: true });
    expect(retrieve).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(result)).not.toContain("provider-private-detail");
    const rows = await t.run(ctx => ctx.db.query("lanterns").collect());
    expect(rows).toHaveLength(5);
    expect(rows.filter(row => row.status === "paid").reduce((sum, row) => sum + row.amountCents, 0)).toBe(400);
    expect(rows.find(row => row.whopCheckoutId === "ch_unpaid")?.status).toBe("pending");
    expect(rows.find(row => row.whopPaymentId === "pay_good")?.paidAt).toBe(Date.parse("2026-11-15T12:00:00Z"));
    expect(rows.every(row => row.confirmedAt === undefined)).toBe(true);
  });
});
