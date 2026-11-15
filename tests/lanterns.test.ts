import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const deviceId = "lantern-host-device-0001";

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
  const tree = await t.mutation(api.trees.create, {
    deviceId, name: "Lantern test", memberName: "Host", cause: { name: "A shared cause" },
  });
  const pending = { deviceId, treeId: tree.treeId, memberId: tree.memberId, amountCents: 500, checkoutId: "ch_test" };
  const payment = { treeId: tree.treeId, memberId: tree.memberId, amountCents: 500, checkoutId: "ch_test", paymentId: "pay_test" };
  return { t, tree, pending, payment };
}

it("concurrent replays fulfill once, repeated payments count once each, and pending never raises the total", async () => {
  const { t, tree, pending, payment } = await fixture();
  await t.mutation(internal.lanterns.recordPending, pending);
  const before = await t.query(api.days.today, { treeId: tree.treeId, deviceId });
  expect(before?.lanternCount).toBe(0);
  expect(before?.raisedCents).toBe(0);
  await Promise.all(Array.from({ length: 8 }, () => t.mutation(internal.lanterns.applyPayment, payment)));
  const first = await t.query(api.days.today, { treeId: tree.treeId, deviceId });
  expect(first?.lanternCount).toBe(1);
  expect(first?.raisedCents).toBe(500);
  await Promise.all(Array.from({ length: 8 }, () => t.mutation(internal.lanterns.applyPayment, { ...payment, paymentId: "pay_second" })));
  const second = await t.query(api.days.today, { treeId: tree.treeId, deviceId });
  expect(second?.lanternCount).toBe(2);
  expect(second?.raisedCents).toBe(1000);
  expect(await t.run(ctx => ctx.db.query("lanterns").collect())).toHaveLength(2);
});

it("unauthorized checkouts and mismatched payments leave the lantern pending", async () => {
  const { t, pending, payment } = await fixture();
  await expect(t.query(internal.lanterns.checkoutContext, {
    treeId: pending.treeId, amountCents: 500, deviceId: "outsider-device-0001",
  })).rejects.toThrow("membership");
  await t.mutation(internal.lanterns.recordPending, pending);
  await expect(t.mutation(internal.lanterns.applyPayment, { ...payment, amountCents: 100 })).rejects.toThrow();
  expect((await t.run(ctx => ctx.db.query("lanterns").collect()))[0].status).toBe("pending");
});

it("answer checkout requires participation, bloom and the current demo; paid records survive reset", async () => {
  const { t, tree, pending, payment } = await fixture();
  const demo = await t.mutation(api.demo.restart, { treeId: tree.treeId, deviceId });
  const answerId = await t.run(async ctx => ctx.db.insert("answers", {
    treeId: tree.treeId, dayId: demo.dayId, memberId: tree.memberId,
    text: "A moment of kindness", blossom: 0, createdAt: Date.now(),
  }));
  const input = { deviceId, treeId: tree.treeId, answerId, amountCents: 500 };
  await expect(t.query(internal.lanterns.checkoutContext, input)).rejects.toThrow("not available");
  await t.run(async ctx => ctx.db.patch(demo.dayId, { bloomedAt: Date.now() }));
  await t.query(internal.lanterns.checkoutContext, input);
  await t.mutation(internal.lanterns.recordPending, { ...pending, answerId });
  await t.mutation(api.demo.restart, { treeId: tree.treeId, deviceId });
  await expect(t.query(internal.lanterns.checkoutContext, input)).rejects.toThrow("not available");
  await t.mutation(internal.lanterns.applyPayment, { ...payment, answerId });
  expect((await t.query(api.days.today, { treeId: tree.treeId, deviceId }))?.raisedCents).toBe(500);
});
