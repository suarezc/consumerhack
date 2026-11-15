import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { queueBloomNotifications, queuePaidUserNotifications } from "../convex/notifications";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const owner = "late-settlement-owner-001";
const friend = "late-settlement-friend-01";

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
});

async function fixture(dates = ["2026-11-12", "2026-11-13"]) {
  const t = convexTest(schema, modules);
  const tree = await t.mutation(api.trees.create, { deviceId: owner, name: "Original checkout tree", memberName: "Reader" });
  const second = await t.mutation(api.trees.create, { deviceId: owner, name: "Current bloomed tree", memberName: "Reader" });
  const companion = await t.mutation(api.trees.join, { deviceId: friend, code: second.code, memberName: "Friend" });
  const dayId = await t.run(async ctx => {
    const day = await ctx.db.query("days").withIndex("by_tree", q => q.eq("treeId", second.treeId)).first();
    await ctx.db.patch(day!._id, { bloomedAt: Date.now() });
    return day!._id;
  });
  const settle = async (date: string, source: "whop" | "demo" = "whop", payer = tree.memberId) => t.run(ctx =>
    ctx.db.insert("lanterns", {
      treeId: payer === companion.memberId ? second.treeId : tree.treeId, memberId: payer, amountCents: 100, status: "paid", source,
      whopCheckoutId: `settled-${date}-${source}-${payer}`, paidAt: Date.now(), creditedDate: date, createdAt: Date.now(),
    }));
  for (const date of dates) await settle(date);
  for (const deviceId of [owner, friend]) {
    await t.mutation(api.notifications.updatePreference, {
      deviceId, expectedRevision: 0, optIn: true, permission: "granted", token: `ExpoPushToken[${deviceId}]`,
    });
  }
  const rows = () => t.run(ctx => ctx.db.query("notificationOutbox").collect());
  const recheck = () => t.run(ctx => queuePaidUserNotifications(ctx, owner));
  const bloom = () => t.run(async ctx => queueBloomNotifications(ctx, (await ctx.db.get(dayId))!));
  return { t, tree, second, companion, dayId, rows, settle, recheck, bloom };
}

describe("late real settlement reminder discovery", () => {
  it("discovers a newly at-risk user on a current bloomed membership, not the historical checkout tree", async () => {
    const f = await fixture();
    await f.bloom();
    expect(await f.rows()).toHaveLength(0);
    await f.settle("2026-11-14");
    await f.recheck();
    const rows = await f.rows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ deviceId: owner, dayId: f.dayId, date: "2026-11-15", state: "queued" });
    expect(await f.t.mutation(internal.notifications.claim, { outboxId: rows[0]._id })).toMatchObject({ streak: 3, date: "2026-11-15" });
  });

  it("limits settlement discovery to the paid user and deduplicates across repeated hooks and memberships", async () => {
    const f = await fixture(["2026-11-14"]);
    await f.settle("2026-11-14", "whop", f.companion.memberId);
    await f.t.run(async ctx => {
      const day = await ctx.db.query("days").withIndex("by_tree", q => q.eq("treeId", f.tree.treeId)).first();
      await ctx.db.patch(day!._id, { bloomedAt: Date.now() });
    });
    await Promise.all([f.recheck(), f.recheck(), f.recheck()]);
    const rows = await f.rows();
    expect(rows).toHaveLength(1);
    expect(rows[0].deviceId).toBe(owner);
  });

  it("does not reopen any existing daily row, including ambiguous or accepted dispatch", async () => {
    for (const state of ["queued", "dispatching", "accepted", "handed_off", "unknown", "suppressed", "failed"] as const) {
      const f = await fixture(["2026-11-14"]);
      await f.recheck();
      const row = (await f.rows())[0];
      await f.t.run(ctx => ctx.db.patch(row._id, { state, attempt: 1 }));
      await f.recheck();
      expect(await f.rows()).toHaveLength(1);
      expect((await f.rows())[0]).toMatchObject({ _id: row._id, state, attempt: 1 });
    }
  });

  it("suppresses today's pre-bloom payment and payment after queue but before claim", async () => {
    const f = await fixture(["2026-11-14"]);
    await f.t.run(ctx => ctx.db.patch(f.dayId, { bloomedAt: undefined }));
    await f.settle("2026-11-15");
    await f.t.run(ctx => ctx.db.patch(f.dayId, { bloomedAt: Date.now() }));
    await f.bloom();
    await f.recheck();
    expect(await f.rows()).toHaveLength(0);
    const g = await fixture(["2026-11-14"]);
    await g.recheck();
    await g.settle("2026-11-15");
    await g.recheck();
    const row = (await g.rows())[0];
    expect(await g.t.mutation(internal.notifications.claim, { outboxId: row._id })).toBeNull();
    expect((await g.rows())[0].state).toBe("suppressed");
  });

  it("recomputes the final count when another late prior-day payment extends the run", async () => {
    const f = await fixture(["2026-11-13", "2026-11-14"]);
    await f.recheck();
    await f.settle("2026-11-12");
    await f.recheck();
    expect(await f.rows()).toHaveLength(1);
    expect(await f.t.mutation(internal.notifications.claim, { outboxId: (await f.rows())[0]._id })).toMatchObject({ streak: 3 });
  });

  it("requires a real current bloomed day, real giving and current permission", async () => {
    for (const reason of ["unbloomed", "demoDay", "synthetic", "optOut", "rollover"] as const) {
      const f = await fixture();
      await f.settle("2026-11-14", reason === "synthetic" ? "demo" : "whop");
      if (reason === "unbloomed") await f.t.run(ctx => ctx.db.patch(f.dayId, { bloomedAt: undefined }));
      if (reason === "demoDay") await f.t.run(ctx => ctx.db.patch(f.dayId, { isDemo: true }));
      if (reason === "optOut") await f.t.mutation(api.notifications.updatePreference, {
        deviceId: owner, expectedRevision: 1, optIn: false, permission: "granted",
      });
      if (reason === "rollover") vi.setSystemTime(new Date("2026-11-16T06:00:00Z"));
      await f.recheck();
      expect(await f.rows()).toHaveLength(0);
      vi.setSystemTime(new Date("2026-11-15T21:00:00Z"));
    }
  });
});
