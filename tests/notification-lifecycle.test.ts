import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const deviceId = "lifecycle-notify-user-0001";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
  vi.stubEnv("EXPO_PUSH_ENABLED", "true");
  vi.stubEnv("EXPO_PROJECT_ID", "11111111-1111-4111-8111-111111111111");
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it("queues atomically from the freshly bloomed real day and deduplicates across trees", async () => {
  const t = convexTest(schema, modules);
  const tree = await t.mutation(api.trees.create, { deviceId, name: "One tree", memberName: "Host" });
  const other = await t.mutation(api.trees.create, { deviceId, name: "Other tree", memberName: "Host" });
  await t.run(ctx => ctx.db.insert("lanterns", { treeId: tree.treeId, memberId: tree.memberId,
    amountCents: 100, status: "paid", source: "whop", whopCheckoutId: "ch_prior_day", createdAt: Date.now(),
    paidAt: Date.parse("2026-11-14T12:00:00Z"), creditedDate: "2026-11-14" }));
  await t.mutation(api.notifications.updatePreference, { deviceId, expectedRevision: 0, optIn: true, permission: "granted", token: "ExpoPushToken[test_lifecycle_token]" });
  await t.mutation(api.answers.submit, { deviceId, dayId: tree.dayId, text: "A gentle moment" });
  const rows = await t.run(ctx => ctx.db.query("notificationOutbox").collect());
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ dayId: tree.dayId, date: "2026-11-15", state: "queued", attempt: 0 });
  expect((await t.run(ctx => ctx.db.get(rows[0].dayId)))?.bloomedAt).toBeDefined();
  await t.mutation(internal.lifecycle.bloom, { dayId: tree.dayId });
  await t.mutation(api.answers.submit, { deviceId, dayId: other.dayId, text: "Another small thing" });
  expect(await t.run(ctx => ctx.db.query("notificationOutbox").collect())).toHaveLength(1);
  const jobs = await t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  expect(jobs.filter(job => job.name === "notifications:dispatch")).toHaveLength(1);
  expect(jobs.filter(job => job.name === "judgeHook:run")).toHaveLength(2);
});

it("does not let a synthetic three-day demo streak enqueue from a real or demo bloom", async () => {
  const t = convexTest(schema, modules);
  const tree = await t.mutation(api.trees.create, { deviceId, name: "Demo tree", memberName: "Host" });
  await t.mutation(api.notifications.updatePreference, { deviceId, expectedRevision: 0, optIn: true, permission: "granted", token: "ExpoPushToken[test_lifecycle_token]" });
  const run = await t.mutation(api.demo.restart, { deviceId, treeId: tree.treeId });
  expect((await t.query(api.streaks.summary, { deviceId, treeId: tree.treeId })).giving.count).toBe(3);
  await t.mutation(api.answers.submit, { deviceId, dayId: tree.dayId, text: "The real day" });
  await t.mutation(api.answers.submit, { deviceId, dayId: run.dayId, text: "The demo day" });
  const samples = await t.run(ctx => ctx.db.query("members").withIndex("by_tree", q => q.eq("treeId", tree.treeId)).collect());
  for (const member of samples.filter(member => member.isDemo)) {
    await t.mutation(internal.demo.seed, { dayId: run.dayId, memberId: member._id, text: "A demo sample" });
  }
  expect((await t.run(ctx => ctx.db.get(run.dayId)))?.bloomedAt).toBeDefined();
  expect(await t.run(ctx => ctx.db.query("notificationOutbox").collect())).toEqual([]);
});
