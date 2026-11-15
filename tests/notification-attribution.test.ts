import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { queuePaidUserNotifications } from "../convex/notifications";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const deviceId = "charity-notification-owner-01";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("EXPO_PUSH_ENABLED", "true");
  vi.stubEnv("EXPO_PROJECT_ID", "11111111-1111-4111-8111-111111111111");
  vi.stubEnv("WHOP_ENVIRONMENT", "sandbox");
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function fixture(date: string, priorDates: string[]) {
  vi.setSystemTime(new Date(`${date}T12:00:00Z`));
  const t = convexTest(schema, modules);
  const tree = await t.mutation(api.trees.create, { deviceId, name: "Authorized target", memberName: "Host" });
  await t.mutation(api.trees.join, { deviceId: "charity-notification-friend01", code: tree.code, memberName: "Friend" });
  await t.mutation(api.answers.submit, { deviceId, dayId: tree.dayId, text: "A small kindness" });
  await t.run(async ctx => {
    const day = await ctx.db.get(tree.dayId);
    await ctx.db.patch(day!.causeId!, { childAccountId: "biz_notificationfixture" });
    for (const creditedDate of priorDates) await ctx.db.insert("lanterns", {
      treeId: tree.treeId, memberId: tree.memberId, status: "paid", source: "whop", amountCents: 100,
      paidAt: Date.parse(`${creditedDate}T12:00:00Z`), creditedDate, createdAt: Date.now(), whopCheckoutId: `ch_fixture_${creditedDate}`,
    });
  });
  await t.mutation(api.notifications.updatePreference, {
    deviceId, expectedRevision: 0, optIn: true, permission: "granted", token: "ExpoPushToken[attribution_fixture_token]",
  });
  const intent = await t.mutation(internal.lanterns.prepareWatering, { deviceId, treeId: tree.treeId, dayId: tree.dayId, bundles: 2 });
  await t.mutation(internal.lanterns.attachCheckout, { wateringId: intent.wateringId, checkoutId: "ch_attribution_fixture" });
  const payment = {
    paymentId: "pay_attribution_fixture", checkoutId: "ch_attribution_fixture", treeId: tree.treeId,
    memberId: intent.memberId, answerId: intent.answerId, userId: intent.userId, dayId: intent.dayId,
    bundles: intent.bundles, amountCents: intent.amountCents, recipientAccountId: intent.expectedRecipientAccountId,
  };
  const settle = (paidAt: number | null = Date.now()) => t.mutation(internal.lanterns.applyPayment, { ...payment, paidAt: paidAt ?? undefined });
  const rows = () => t.run(ctx => ctx.db.query("notificationOutbox").collect());
  return { t, tree, intent, payment, settle, rows };
}

describe("charity target-day reminder attribution", () => {
  it("permits today's payment before bloom and queues no at-risk alert after bloom", async () => {
    const f = await fixture("2026-11-15", ["2026-11-14"]);
    expect((await f.t.run(ctx => ctx.db.get(f.tree.dayId)))?.bloomedAt).toBeUndefined();
    await f.settle();
    vi.setSystemTime(new Date("2026-11-15T21:00:00Z"));
    await f.t.mutation(internal.lifecycle.bloom, { dayId: f.tree.dayId });
    expect(await f.rows()).toHaveLength(0);
    expect((await f.t.query(api.streaks.summary, { deviceId, treeId: f.tree.treeId })).giving).toMatchObject({ count: 2, status: "current" });
  });

  it("keeps yesterday's late settlement at risk and discovers today's actual bloom", async () => {
    const f = await fixture("2026-11-14", ["2026-11-12", "2026-11-13"]);
    vi.setSystemTime(new Date("2026-11-15T20:00:00Z"));
    const current = await f.t.mutation(api.trees.create, { deviceId, name: "Current source", memberName: "Host" });
    await f.t.mutation(api.answers.submit, { deviceId, dayId: current.dayId, text: "A new kindness" });
    expect(await f.rows()).toHaveLength(0);
    vi.setSystemTime(new Date("2026-11-15T21:00:00Z"));
    await f.settle();
    expect(await f.t.run(ctx => ctx.db.get(f.intent.wateringId))).toMatchObject({
      status: "paid", dayId: f.tree.dayId, creditedDate: "2026-11-14", paidAt: Date.parse("2026-11-15T21:00:00Z"),
    });
    await f.t.run(ctx => queuePaidUserNotifications(ctx, deviceId));
    await f.t.run(ctx => queuePaidUserNotifications(ctx, deviceId));
    const rows = await f.rows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ dayId: current.dayId, date: "2026-11-15" });
    expect(await f.t.mutation(internal.notifications.claim, { outboxId: rows[0]._id })).toMatchObject({ streak: 3 });
  });

  it("suppresses a queued claim after today's newly verified canonical payment", async () => {
    const f = await fixture("2026-11-15", ["2026-11-14"]);
    vi.setSystemTime(new Date("2026-11-15T21:00:00Z"));
    await f.t.mutation(internal.lifecycle.bloom, { dayId: f.tree.dayId });
    const row = (await f.rows())[0];
    expect(row).toBeDefined();
    await f.settle();
    expect(await f.t.mutation(internal.notifications.claim, { outboxId: row._id })).toBeNull();
    expect((await f.rows())[0].state).toBe("suppressed");
  });

  it("backfills provider time without shifting an authorized prior-day credit or reopening its reminder", async () => {
    const f = await fixture("2026-11-14", ["2026-11-12", "2026-11-13"]);
    vi.setSystemTime(new Date("2026-11-15T20:00:00Z"));
    const current = await f.t.mutation(api.trees.create, { deviceId, name: "Backfill source", memberName: "Host" });
    await f.t.mutation(api.answers.submit, { deviceId, dayId: current.dayId, text: "A little care" });
    await f.settle(null);
    await f.t.run(ctx => queuePaidUserNotifications(ctx, deviceId));
    const row = (await f.rows())[0];
    expect(row).toMatchObject({ dayId: current.dayId, state: "queued" });
    await f.t.mutation(internal.lanterns.backfillPaymentFacts, {
      ...f.payment, rowId: f.intent.wateringId, paidAt: Date.now(),
    });
    await f.t.run(ctx => queuePaidUserNotifications(ctx, deviceId));
    expect(await f.rows()).toHaveLength(1);
    expect(await f.t.run(ctx => ctx.db.get(f.intent.wateringId))).toMatchObject({ creditedDate: "2026-11-14", paidAt: Date.now() });
    expect(await f.t.mutation(internal.notifications.claim, { outboxId: row._id })).toMatchObject({ streak: 3 });
  });
});
