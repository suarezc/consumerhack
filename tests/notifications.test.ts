import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { queueBloomNotifications } from "../convex/notifications";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const deviceId = "notification-owner-00001";
const otherId = "notification-other-00001";
const token = "ExpoPushToken[owner_private_token]";
const rotated = "ExpoPushToken[rotated_private_token]";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-15T21:00:00Z"));
  vi.stubEnv("EXPO_PUSH_ENABLED", "true");
  vi.stubEnv("EXPO_PROJECT_ID", "11111111-1111-4111-8111-111111111111");
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function fixture() {
  const t = convexTest(schema, modules);
  const tree = await t.mutation(api.trees.create, { deviceId, name: "Notification tree", memberName: "Reader" });
  const second = await t.mutation(api.trees.create, { deviceId, name: "Second tree", memberName: "Reader" });
  await t.mutation(api.trees.join, { deviceId: otherId, code: tree.code, memberName: "Friend" });
  const dayId = await t.run(async ctx => {
    const day = await ctx.db.query("days").withIndex("by_tree", q => q.eq("treeId", tree.treeId)).first();
    await ctx.db.patch(day!._id, { bloomedAt: Date.now() });
    for (const date of ["2026-11-12", "2026-11-13", "2026-11-14"]) {
      await ctx.db.insert("lanterns", {
        treeId: second.treeId, memberId: second.memberId, amountCents: 100, status: "paid",
        whopCheckoutId: `fixture-${date}`, whopPaymentId: `fixture-payment-${date}`,
        createdAt: Date.now(), paidAt: Date.parse(`${date}T12:00:00Z`), creditedDate: date, source: "whop",
      });
    }
    return day!._id;
  });
  await t.mutation(api.notifications.updatePreference, { deviceId, expectedRevision: 0, optIn: true, permission: "granted", token });
  const queue = async (id = dayId) => t.run(async ctx => queueBloomNotifications(ctx, (await ctx.db.get(id))!));
  const rows = () => t.run(ctx => ctx.db.query("notificationOutbox").collect());
  const payToday = async () => t.run(ctx => ctx.db.insert("lanterns", {
    treeId: second.treeId, memberId: second.memberId, amountCents: 100, status: "paid",
    whopCheckoutId: "today-fixture", whopPaymentId: "today-fixture-payment",
    createdAt: Date.now(), paidAt: Date.now(), creditedDate: "2026-11-15", source: "whop",
  }));
  return { t, tree, second, dayId, queue, rows, payToday };
}

describe("notification transactional outbox", () => {
  it("deduplicates a user's ritual date across trees and repeated bloom hooks", async () => {
    const f = await fixture();
    const secondDay = await f.t.run(async ctx => {
      const day = await ctx.db.query("days").withIndex("by_tree", q => q.eq("treeId", f.second.treeId)).first();
      await ctx.db.patch(day!._id, { bloomedAt: Date.now() });
      return day!._id;
    });
    await Promise.all([f.queue(), f.queue(), f.queue(secondDay)]);
    const rows = await f.rows();
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2026-11-15");
    expect(rows[0].deviceId).toBe(deviceId);
    const claims = await Promise.all(Array.from({ length: 4 }, () => f.t.mutation(internal.notifications.claim, { outboxId: rows[0]._id })));
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(claims.find(Boolean)?.streak).toBe(3);
  });

  it("suppresses a payment committed after queue and before dispatch claim", async () => {
    const f = await fixture();
    await f.queue();
    await f.payToday();
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    await f.t.action(internal.notifications.dispatch, { outboxId: (await f.rows())[0]._id });
    expect(request).not.toHaveBeenCalled();
    expect((await f.rows())[0].state).toBe("suppressed");
  });

  it("reads token rotation at claim and protects a newer token from old revocation receipts", async () => {
    const f = await fixture();
    await f.queue();
    await f.t.mutation(api.notifications.updatePreference, {
      deviceId, expectedRevision: 1, optIn: true, permission: "granted", token: rotated,
    });
    const outboxId = (await f.rows())[0]._id;
    const claim = await f.t.mutation(internal.notifications.claim, { outboxId });
    expect(claim?.token).toBe(rotated);
    await f.t.mutation(internal.notifications.finish, { outboxId, attempt: 1, result: { kind: "accepted", ticketId: "fixture-ticket" } });
    await f.t.mutation(api.notifications.updatePreference, {
      deviceId, expectedRevision: 2, optIn: true, permission: "granted", token,
    });
    await f.t.mutation(internal.notifications.finishReceipt, {
      outboxId, check: 0, result: { kind: "rejected", error: "DeviceNotRegistered", retryable: false },
    });
    expect((await f.t.query(api.notifications.preference, { deviceId })).registered).toBe(true);
    expect((await f.rows())[0].state).toBe("failed");
  });

  it("suppresses opt-out, denied permissions, missing membership, missing bloom and expired date", async () => {
    for (const reason of ["optOut", "denied", "member", "bloom", "date", "disabled"] as const) {
      const f = await fixture();
      await f.queue();
      const outboxId = (await f.rows())[0]._id;
      if (reason === "optOut" || reason === "denied") {
        await f.t.mutation(api.notifications.updatePreference, {
          deviceId, expectedRevision: 1, optIn: reason !== "optOut", permission: reason === "denied" ? "denied" : "granted",
        });
      }
      if (reason === "member") await f.t.run(ctx => ctx.db.delete(f.tree.memberId));
      if (reason === "bloom") await f.t.run(ctx => ctx.db.patch(f.dayId, { bloomedAt: undefined }));
      if (reason === "date") vi.setSystemTime(new Date("2026-11-16T06:00:00Z"));
      if (reason === "disabled") vi.stubEnv("EXPO_PUSH_ENABLED", "false");
      expect(await f.t.mutation(internal.notifications.claim, { outboxId })).toBeNull();
      expect((await f.rows())[0].state).toBe("suppressed");
      vi.setSystemTime(new Date("2026-11-15T21:00:00Z"));
      vi.stubEnv("EXPO_PUSH_ENABLED", "true");
    }
  });

  it("does not enqueue no-streak, current-streak, or synthetic demo eligibility", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (const row of await ctx.db.query("lanterns").collect()) await ctx.db.patch(row._id, { source: "demo" });
    });
    await f.queue();
    expect(await f.rows()).toHaveLength(0);
    await f.t.run(async ctx => {
      for (const row of await ctx.db.query("lanterns").collect()) await ctx.db.patch(row._id, { source: "whop" });
      await ctx.db.patch(f.dayId, { isDemo: true });
    });
    await f.queue();
    expect(await f.rows()).toHaveLength(0);
    await f.t.run(ctx => ctx.db.patch(f.dayId, { isDemo: false }));
    await f.payToday();
    await f.queue();
    expect(await f.rows()).toHaveLength(0);
  });

  it("allows calendar midnight but not ritual rollover, and ignores pending payments", async () => {
    const f = await fixture();
    await f.queue();
    await f.t.run(ctx => ctx.db.insert("lanterns", {
      treeId: f.tree.treeId, memberId: f.tree.memberId, amountCents: 100, status: "pending",
      whopCheckoutId: "pending-fixture", createdAt: Date.now(),
    }));
    vi.setSystemTime(new Date("2026-11-16T00:00:00Z"));
    expect(await f.t.mutation(internal.notifications.claim, { outboxId: (await f.rows())[0]._id })).toMatchObject({ streak: 3 });
  });

  it("keeps ambiguous provider results terminal even when action is invoked again", async () => {
    const f = await fixture();
    await f.queue();
    const outboxId = (await f.rows())[0]._id;
    const request = vi.fn(async () => { throw new Error("Network interrupted with private token"); });
    vi.stubGlobal("fetch", request);
    await f.t.action(internal.notifications.dispatch, { outboxId });
    await f.t.action(internal.notifications.dispatch, { outboxId });
    expect(request).toHaveBeenCalledTimes(1);
    expect((await f.rows())[0]).toMatchObject({ state: "unknown", attempt: 1, error: "ProviderAcceptanceUnknown" });
    await f.queue();
    expect(await f.rows()).toHaveLength(1);
  });

  it("records honest accepted/handoff states and never retries a receipt rejection", async () => {
    const f = await fixture();
    await f.queue();
    const outboxId = (await f.rows())[0]._id;
    const request = vi.fn(async () => new Response(JSON.stringify({ data: { status: "ok", id: "fixture-ticket" } })));
    vi.stubGlobal("fetch", request);
    await f.t.action(internal.notifications.dispatch, { outboxId });
    expect((await f.rows())[0].state).toBe("accepted");
    request.mockImplementation(async () => new Response(JSON.stringify({ data: { "fixture-ticket": { status: "ok" } } })));
    await f.t.action(internal.notifications.receipt, { outboxId, check: 0 });
    expect((await f.rows())[0].state).toBe("handed_off");
    await f.t.action(internal.notifications.dispatch, { outboxId });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("bounds retries for explicit rate rejection and rechecks payment on retry", async () => {
    const f = await fixture();
    await f.queue();
    const outboxId = (await f.rows())[0]._id;
    await f.t.mutation(internal.notifications.claim, { outboxId });
    await f.t.mutation(internal.notifications.finish, {
      outboxId, attempt: 1, result: { kind: "rejected", error: "MessageRateExceeded", retryable: true },
    });
    expect((await f.rows())[0].state).toBe("queued");
    await f.payToday();
    expect(await f.t.mutation(internal.notifications.claim, { outboxId })).toBeNull();
    expect((await f.rows())[0].state).toBe("suppressed");
    const g = await fixture();
    await g.queue();
    const id = (await g.rows())[0]._id;
    for (let attempt = 1; attempt <= 3; attempt++) {
      await g.t.mutation(internal.notifications.claim, { outboxId: id });
      await g.t.mutation(internal.notifications.finish, {
        outboxId: id, attempt, result: { kind: "rejected", error: "MessageRateExceeded", retryable: true },
      });
    }
    expect((await g.rows())[0]).toMatchObject({ state: "failed", attempt: 3 });
    expect(await g.t.mutation(internal.notifications.claim, { outboxId: id })).toBeNull();
  });

  it("marks an interrupted claimed send unknown and never reclaims it", async () => {
    const f = await fixture();
    await f.queue();
    const outboxId = (await f.rows())[0]._id;
    await f.t.mutation(internal.notifications.claim, { outboxId });
    await f.t.mutation(internal.notifications.expireClaim, { outboxId, attempt: 1 });
    expect((await f.rows())[0].state).toBe("unknown");
    expect(await f.t.mutation(internal.notifications.claim, { outboxId })).toBeNull();
  });
});

describe("registration privacy and concurrency", () => {
  it("returns no bearer identity/token and rejects stale updates and token theft", async () => {
    const f = await fixture();
    const value = await f.t.query(api.notifications.preference, { deviceId });
    expect(value).toEqual({ revision: 1, optIn: true, permission: "granted", registered: true, available: true });
    await expect(f.t.mutation(api.notifications.updatePreference, {
      deviceId, expectedRevision: 0, optIn: true, permission: "granted", token: rotated,
    })).rejects.toThrow("preferences changed");
    await expect(f.t.mutation(api.notifications.updatePreference, {
      deviceId: otherId, expectedRevision: 0, optIn: true, permission: "granted", token,
    })).rejects.toThrow("registration unavailable");
    await f.t.mutation(api.notifications.updatePreference, {
      deviceId, expectedRevision: 1, optIn: false, permission: "granted", token,
    });
    expect((await f.t.query(api.notifications.preference, { deviceId })).registered).toBe(false);
  });

  it("invalidates the current token on provider revocation without turning consent on", async () => {
    const f = await fixture();
    await f.queue();
    const outboxId = (await f.rows())[0]._id;
    await f.t.mutation(internal.notifications.claim, { outboxId });
    await f.t.mutation(internal.notifications.finish, {
      outboxId, attempt: 1, result: { kind: "rejected", error: "DeviceNotRegistered", retryable: false },
    });
    expect(await f.t.query(api.notifications.preference, { deviceId })).toMatchObject({ revision: 2, registered: false, optIn: true });
    expect((await f.rows())[0].state).toBe("failed");
  });

  it("rechecks real eligibility for foreground display and denies after payment", async () => {
    const f = await fixture();
    await f.queue();
    const outboxId = (await f.rows())[0]._id;
    await f.t.mutation(internal.notifications.claim, { outboxId });
    expect(await f.t.query(api.notifications.foregroundEligibility, { deviceId, date: "2026-11-15" })).toBe(true);
    expect(await f.t.query(api.notifications.foregroundEligibility, { deviceId: otherId, date: "2026-11-15" })).toBe(false);
    await f.payToday();
    expect(await f.t.query(api.notifications.foregroundEligibility, { deviceId, date: "2026-11-15" })).toBe(false);
    expect(await f.t.query(api.notifications.foregroundEligibility, { deviceId, date: "2026-11-14" })).toBe(false);
  });
});
