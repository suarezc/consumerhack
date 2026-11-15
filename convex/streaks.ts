import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { requireMember } from "./access";
import { currentStreak, longestStreak, milestone, ritualClock } from "./lib/streakLogic";

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
      if (row.creditedDate && row.paidAt !== undefined) givingDates.add(row.creditedDate);
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

export async function dayGiving(ctx: ReadCtx, treeId: Id<"trees">, date: string, viewer: Id<"members">, run: Doc<"days"> | null, ownOnly = false) {
  const rows = (await ctx.db.query("lanterns").withIndex("by_tree", q => q.eq("treeId", treeId)).collect())
    .filter(row => row.status === "paid" && row.paidAt !== undefined && row.creditedDate === date &&
      (run ? row.demoRunId === run._id : row.source !== "demo") && (!ownOnly || row.memberId === viewer));
  const datesByMember = new Map<string, Set<string>>();
  const fruits = [];
  for (const row of rows.sort((a, b) => a.paidAt! - b.paidAt! || a._id.localeCompare(b._id))) {
    let dates = datesByMember.get(row.memberId);
    if (!dates) {
      const member = await ctx.db.get(row.memberId);
      if (!member) continue;
      dates = (await userContributions(ctx, member.deviceId, run)).givingDates;
      datesByMember.set(row.memberId, dates);
    }
    const reached = milestone(dates, date);
    fruits.push({ fruitId: row._id, date, golden: reached !== null, isMine: row.memberId === viewer,
      milestone: reached, source: row.source ?? "whop" as const, paidAt: row.paidAt! });
  }
  const latest = rows.filter(row => row.memberId === viewer && row.confirmedAt !== undefined)
    .sort((a, b) => a.confirmedAt! - b.confirmedAt! || a._id.localeCompare(b._id)).at(-1);
  return { fruits, wateringEvent: latest ? { id: latest._id, fruitId: latest._id, revision: 1 } : null };
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
