import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const deviceId = "atomic-charity-reminder-001";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
  vi.stubEnv("EXPO_PUSH_ENABLED", "true");
  vi.stubEnv("EXPO_PROJECT_ID", "11111111-1111-4111-8111-111111111111");
  vi.stubEnv("WHOP_ENVIRONMENT", "sandbox");
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function fixture() {
  const t = convexTest(schema, modules);
  const prior = await t.mutation(api.trees.create, { deviceId, name: "Prior target", memberName: "Host" });
  await t.mutation(api.answers.submit, { deviceId, dayId: prior.dayId, text: "A small kindness" });
  await t.run(async ctx => {
    const day = await ctx.db.get(prior.dayId);
    await ctx.db.patch(day!.causeId!, { childAccountId: "biz_atomicfixture" });
    for (const date of ["2026-11-12", "2026-11-13"]) await ctx.db.insert("lanterns", {
      treeId: prior.treeId, memberId: prior.memberId, amountCents: 100, status: "paid", source: "whop",
      creditedDate: date, paidAt: Date.parse(`${date}T12:00:00Z`), createdAt: Date.now(), whopCheckoutId: `ch_${date}`,
    });
  });
  await t.mutation(api.notifications.updatePreference, {
    deviceId, expectedRevision: 0, optIn: true, permission: "granted", token: "ExpoPushToken[atomic_fixture_token]",
  });
  const intent = await t.mutation(internal.lanterns.prepareWatering, { deviceId, treeId: prior.treeId, dayId: prior.dayId, bundles: 2 });
  await t.mutation(internal.lanterns.attachCheckout, { wateringId: intent.wateringId, checkoutId: "ch_atomic_intent" });
  vi.setSystemTime(new Date("2026-11-15T20:00:00Z"));
  const current = await t.mutation(api.trees.create, { deviceId, name: "Current bloom", memberName: "Host" });
  await t.mutation(api.answers.submit, { deviceId, dayId: current.dayId, text: "Today is softer" });
  const rows = () => t.run(ctx => ctx.db.query("notificationOutbox").collect());
  expect(await rows()).toHaveLength(0);
  return { t, prior, current, intent, rows };
}

it("actual late canonical settlement queues without an explicit helper call and replay never reopens acceptance", async () => {
  const f = await fixture();
  const payment = { paymentId: "pay_atomic", checkoutId: "ch_atomic_intent", treeId: f.prior.treeId,
    memberId: f.intent.memberId, userId: f.intent.userId, dayId: f.intent.dayId, answerId: f.intent.answerId,
    bundles: f.intent.bundles, amountCents: f.intent.amountCents, recipientAccountId: f.intent.expectedRecipientAccountId,
    paidAt: Date.now() };
  await f.t.mutation(internal.lanterns.applyPayment, payment);
  const row = (await f.rows())[0];
  expect(row).toMatchObject({ dayId: f.current.dayId, date: "2026-11-15", state: "queued" });
  expect(await f.t.mutation(internal.notifications.claim, { outboxId: row._id })).toMatchObject({ streak: 3 });
  await f.t.mutation(internal.notifications.finish, { outboxId: row._id, attempt: 1, result: { kind: "accepted", ticketId: "atomic-ticket" } });
  await f.t.mutation(internal.lanterns.applyPayment, payment);
  expect(await f.rows()).toHaveLength(1);
  expect((await f.rows())[0]).toMatchObject({ _id: row._id, state: "accepted", attempt: 1 });
});

it("actual legacy date backfill newly discovers current risk without an explicit helper call", async () => {
  const f = await fixture();
  const rowId = await f.t.run(ctx => ctx.db.insert("lanterns", {
    treeId: f.prior.treeId, memberId: f.prior.memberId, amountCents: 100, status: "paid", source: "whop",
    whopCheckoutId: "ch_legacy_atomic", whopPaymentId: "pay_legacy_atomic", createdAt: Date.now(),
  }));
  await f.t.mutation(internal.lanterns.backfillPaymentFacts, {
    rowId, paymentId: "pay_legacy_atomic", checkoutId: "ch_legacy_atomic", treeId: f.prior.treeId,
    memberId: f.prior.memberId, amountCents: 100, paidAt: Date.parse("2026-11-14T22:00:00Z"),
  });
  const row = (await f.rows())[0];
  expect(row).toMatchObject({ dayId: f.current.dayId, date: "2026-11-15", state: "queued" });
  expect(await f.t.mutation(internal.notifications.claim, { outboxId: row._id })).toMatchObject({ streak: 3 });
});
