import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { requireMember } from "./access";
import { currentStreak, longestStreak, milestone, ritualClock } from "./lib/streakLogic";
import { bundleCount, hasCreditedDate, paidForDay } from "./lib/wateringFacts";

type ReadCtx = QueryCtx | MutationCtx;

export async function contributionScope(ctx: ReadCtx, treeId: Id<"trees">) {
  const tree = await ctx.db.get(treeId);
  const run = tree?.demoDayId ? await ctx.db.get(tree.demoDayId) : null;
  return run?.isDemo ? run : null;
}

export async function userContributions(ctx: ReadCtx, deviceId: string, run: Doc<"days"> | null) {
  const memberships = await ctx.db.query("members").withIndex("by_device", q => q.eq("deviceId", deviceId)).collect();
  const answerDates = new Set<string>();
  const givingDates = new Set<string>();
  const paid: Doc<"lanterns">[] = [];
  for (const member of memberships) {
    if (member.isDemo) continue;
    for (const answer of await ctx.db.query("answers").withIndex("by_member", q => q.eq("memberId", member._id)).collect()) {
      const day = await ctx.db.get(answer.dayId);
      if (!day || (run ? day.demoRunId !== run._id : day.isDemo)) continue;
      const date = day.isDemo ? day.ritualDate : day.date;
      if (date) answerDates.add(date);
    }
    for (const row of await ctx.db.query("lanterns").withIndex("by_member", q => q.eq("memberId", member._id)).collect()) {
      if (row.status !== "paid" || (run ? row.demoRunId !== run._id : row.source === "demo")) continue;
      paid.push(row);
      if (hasCreditedDate(row)) givingDates.add(row.creditedDate!);
    }
  }
  return { answerDates, givingDates, paid };
}

export async function userSummary(ctx: ReadCtx, deviceId: string, run: Doc<"days"> | null, now = Date.now()) {
  const data = await userContributions(ctx, deviceId, run);
  const clock = ritualClock(now);
  if (run?.ritualDate) clock.date = run.ritualDate;
  return {
    clock,
    answer: currentStreak(data.answerDates, clock.date),
    giving: { ...currentStreak(data.givingDates, clock.date), longest: longestStreak(data.givingDates),
      totalCents: data.paid.reduce((sum, row) => sum + row.amountCents, 0) },
    undatedPaidCount: data.paid.filter(row => row.paidAt === undefined || !row.creditedDate).length,
    currency: "USD" as const,
    isDemo: !!run,
  };
}

export async function dayGiving(ctx: ReadCtx, day: Doc<"days">, viewer: Id<"members">, run: Doc<"days"> | null, ownOnly = false) {
  const rows = (await ctx.db.query("lanterns").withIndex("by_tree", q => q.eq("treeId", day.treeId)).collect())
    .filter(row => paidForDay(row, day) && (!ownOnly || row.memberId === viewer));
  let lightBundles = 0;
  let goldenLightBundles = 0;
  const datesByMember = new Map<string, Set<string>>();
  for (const row of rows) {
    const bundles = bundleCount(row);
    lightBundles += bundles;
    if (bundles === 0) continue;
    let dates = datesByMember.get(row.memberId);
    if (!dates) {
      const member = await ctx.db.get(row.memberId);
      if (!member) continue;
      dates = (await userContributions(ctx, member.deviceId, run)).givingDates;
      datesByMember.set(row.memberId, dates);
    }
    if (milestone(dates, day.ritualDate ?? day.date) !== null) goldenLightBundles += bundles;
  }
  const latest = rows.filter(row => row.memberId === viewer && row.confirmedAt !== undefined && bundleCount(row) > 0)
    .sort((a, b) => a.confirmedAt! - b.confirmedAt! || a._id.localeCompare(b._id)).at(-1);
  return { lightBundles, goldenLightBundles,
    lightEvent: latest ? { id: latest._id, lightBundles: bundleCount(latest), revision: 2 as const } : null };
}

export const summary = query({
  args: { deviceId: v.string(), treeId: v.id("trees") },
  handler: async (ctx, { deviceId, treeId }) => {
    await requireMember(ctx, treeId, deviceId);
    await ctx.db.query("days").withIndex("by_tree_date", q => q.eq("treeId", treeId)).order("desc")
      .filter(q => q.neq(q.field("isDemo"), true)).first();
    return await userSummary(ctx, deviceId, await contributionScope(ctx, treeId));
  },
});

export async function notificationGivingContext(ctx: ReadCtx, deviceId: string, now: number) {
  const { clock, giving } = await userSummary(ctx, deviceId, null, now);
  return { dayKey: clock.date, nextDayAt: clock.nextBoundaryAt,
    giving: { count: giving.count, atRisk: giving.status === "at_risk" }, isDemo: false as const };
}
