import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const deviceId = "response-light-owner-000001";
const friend = "response-light-friend-00001";
const observer = "response-light-observer-001";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
  vi.stubEnv("WHOP_ENVIRONMENT", "sandbox");
  vi.stubEnv("EXPO_PUSH_ENABLED", "false");
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function fixture() {
  const t = convexTest(schema, modules);
  const tree = await t.mutation(api.trees.create, { deviceId, name: "Response tree", memberName: "Private owner name", cause: { name: "Legacy cause" } });
  await t.mutation(api.trees.join, { deviceId: friend, code: tree.code, memberName: "Private friend name" });
  await t.mutation(api.trees.join, { deviceId: observer, code: tree.code, memberName: "Observer" });
  await t.mutation(internal.lanterns.recordCauseAccount, { accountId: "biz_responsefixture", applicationFeeCents: 0 });
  const args = { deviceId, treeId: tree.treeId };
  return { t, tree, args };
}

describe("response fruit and paid giving lights", () => {
  it("adds one opaque fruit per answer without any payment and does not expose authors or text before participation and bloom", async () => {
    const { t, tree, args } = await fixture();
    expect((await t.query(api.days.today, args))?.fruits).toEqual([]);
    const own = await t.mutation(api.answers.submit, { deviceId, dayId: tree.dayId, text: "Private owner response" });
    await t.mutation(api.answers.submit, { deviceId: friend, dayId: tree.dayId, text: "Private friend's response" });
    const state = await t.query(api.days.today, args);
    expect(state?.fruits).toHaveLength(2);
    expect(state?.fruits.find(fruit => fruit.isMine)).toEqual({ fruitId: `response:${own.answerId}`, isMine: true, golden: false });
    expect(state?.lightBundles).toBe(0);
    expect(state?.goldenLightBundles).toBe(0);
    expect(state?.lightEvent).toBeNull();
    expect(state?.answers).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("lanterns").collect())).toEqual([]);
    const publicState = await t.query(api.days.today, { ...args, deviceId: observer });
    expect(publicState?.fruits.every(fruit => !fruit.isMine && !fruit.golden)).toBe(true);
    for (const fruit of publicState!.fruits) expect(Object.keys(fruit).sort()).toEqual(["fruitId", "golden", "isMine"]);
    for (const privateValue of [deviceId, friend, "Private owner", "Private friend", "memberId", "userId", "answerId", "text", "whop"]) expect(JSON.stringify(publicState?.fruits)).not.toContain(privateValue);
    vi.setSystemTime(new Date("2026-11-15T21:00:00Z"));
    await t.mutation(internal.lifecycle.bloom, { dayId: tree.dayId });
    expect((await t.query(api.days.today, { ...args, deviceId: observer }))?.answers).toEqual([]);
    expect((await t.query(api.days.today, args))?.answers).toHaveLength(2);
  });

  it.each([2, 5, 10] as const)("settles %i bundles into lights only, with a stable per-payment event rather than cumulative quantity", async bundles => {
    const { t, tree, args } = await fixture();
    await t.mutation(api.answers.submit, { deviceId, dayId: tree.dayId, text: "One response, independent of payment" });
    const before = await t.query(api.days.today, args);
    const intent = await t.mutation(internal.lanterns.prepareWatering, { ...args, dayId: tree.dayId, bundles });
    await t.mutation(internal.lanterns.attachCheckout, { wateringId: intent.wateringId, checkoutId: "ch_response" });
    expect((await t.query(api.days.today, args))?.lightBundles).toBe(0);
    const payment = { paymentId: "pay_response", checkoutId: "ch_response", treeId: tree.treeId,
      memberId: intent.memberId, answerId: intent.answerId, userId: intent.userId, dayId: intent.dayId,
      bundles, amountCents: bundles * 50, recipientAccountId: intent.expectedRecipientAccountId, paidAt: Date.now() };
    await t.mutation(internal.lanterns.applyPayment, payment);
    const confirmed = await t.query(api.days.today, args);
    expect(confirmed?.fruits).toEqual(before?.fruits);
    expect(confirmed?.fruits).toHaveLength(1);
    expect(confirmed?.lightBundles).toBe(bundles);
    expect(confirmed?.lightEvent).toEqual({ id: intent.wateringId, revision: 2, lightBundles: bundles });
    expect(confirmed?.totalRaisedCents).toBe(bundles * 50);
    await Promise.all(Array.from({ length: 3 }, () => t.mutation(internal.lanterns.applyPayment, payment)));
    const reload = await t.query(api.days.today, args);
    expect(reload?.fruits).toEqual(confirmed?.fruits);
    expect(reload?.lightEvent).toEqual(confirmed?.lightEvent);
    expect(reload?.lightBundles).toBe(bundles);
    expect(await t.run(ctx => ctx.db.query("lanterns").collect())).toHaveLength(1);
    await t.mutation(internal.lanterns.applyPayment, { ...payment, paymentId: "pay_secondresponse", paidAt: Date.now() + 1 });
    const second = await t.query(api.days.today, args);
    expect(second?.fruits).toEqual(before?.fruits);
    expect(second?.lightBundles).toBe(bundles * 2);
    expect(second?.lightEvent?.lightBundles).toBe(bundles);
    expect(second?.lightEvent?.id).not.toBe(confirmed?.lightEvent?.id);
    expect(second?.streaks.giving.count).toBe(1);
  });

  it("keeps Yesterday shared and Grove viewer-only, with historical light events quiet", async () => {
    const { t, tree, args } = await fixture();
    const run = await t.mutation(api.demo.restart, args);
    const first = await t.query(api.days.firstOpen, args);
    expect(first?.yesterday?.fruits).toHaveLength(40);
    expect(first?.yesterday?.fruits.filter(fruit => fruit.isMine)).toHaveLength(1);
    expect(first?.yesterday?.fruits.every(fruit => !fruit.golden)).toBe(true);
    expect(first?.yesterday).toMatchObject({ lightBundles: 24, goldenLightBundles: 2, lightEvent: null, myGivenCents: 100 });
    const other = await t.query(api.days.yesterday, { ...args, deviceId: observer });
    expect(other).toMatchObject({ lightBundles: 24, goldenLightBundles: 2, myGivenCents: 0 });
    expect(other?.fruits.every(fruit => !fruit.isMine)).toBe(true);
    const grove = await t.query(api.days.grove, args);
    expect(grove).toHaveLength(9);
    expect(grove.every(day => day.fruits.length === 1 && day.fruits[0].isMine && !day.fruits[0].golden && day.lightBundles === 2 && day.lightEvent === null)).toBe(true);
    expect(grove.map(day => day.goldenLightBundles)).toEqual([2, 0, 0]);
    await t.mutation(api.days.acknowledgeYesterday, { ...args, dayId: run.dayId });
    expect((await t.query(api.days.firstOpen, args))?.shouldShowYesterday).toBe(false);
  });

  it("keeps demo response growth independent from watering and hides stopped/reset run projections", async () => {
    const { t, args } = await fixture();
    const run = await t.mutation(api.demo.restart, args);
    await t.mutation(api.answers.submit, { deviceId, dayId: run.dayId, text: "A demo response" });
    const before = await t.query(api.days.today, args);
    expect(before?.fruits).toHaveLength(1);
    const input = { ...args, dayId: run.dayId, bundles: 10 as const, requestId: "response-lights-request-001" };
    await t.mutation(api.waterings.demoWater, input);
    const paid = await t.query(api.days.today, args);
    expect(paid?.fruits).toEqual(before?.fruits);
    expect(paid).toMatchObject({ lightBundles: 10, goldenLightBundles: 0, streaks: { giving: { count: 4 } } });
    await vi.advanceTimersByTimeAsync(30_001);
    await t.finishInProgressScheduledFunctions();
    const responses = await t.query(api.days.today, args);
    expect(responses?.fruits).toHaveLength(4);
    expect(responses?.lightBundles).toBe(10);
    await t.mutation(api.waterings.demoWater, input);
    expect((await t.query(api.days.today, args))?.lightEvent).toEqual(paid?.lightEvent);
    await t.mutation(api.demo.restart, args);
    const reset = await t.query(api.days.today, args);
    expect(reset).toMatchObject({ fruits: [], lightBundles: 0, goldenLightBundles: 0, lightEvent: null });
    await expect(t.mutation(api.waterings.demoWater, input)).rejects.toThrow();
    await t.mutation(api.demo.stop, args);
    const real = await t.query(api.days.today, args);
    expect(real).toMatchObject({ fruits: [], lightBundles: 0, goldenLightBundles: 0, lightEvent: null, totalRaisedCents: 0 });
  });

  it("preserves a legacy200-bundle payment as lights without fabricating any response", async () => {
    const { t, tree, args } = await fixture();
    const rowId = await t.mutation(internal.lanterns.recordPending, { ...args, memberId: tree.memberId, amountCents: 10000, checkoutId: "ch_legacylights" });
    await t.mutation(internal.lanterns.applyPayment, { treeId: tree.treeId, memberId: tree.memberId,
      paymentId: "pay_legacylights", checkoutId: "ch_legacylights", amountCents: 10000, paidAt: Date.now() });
    const state = await t.query(api.days.today, args);
    expect(state).toMatchObject({ fruits: [], lightBundles: 200, totalRaisedCents: 10000,
      lightEvent: { id: rowId, lightBundles: 200, revision: 2 } });
  });
});
