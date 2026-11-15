import { v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireMember } from "./access";
import { ritualWindow } from "./questions";
import { contributionScope, dayGiving, userSummary } from "./streaks";
import { sackCharity, wateringLabel } from "./charity";
import { dayImpact } from "./impact";
import { ensureMemberUser } from "./identity";
import { shiftDate, ritualClock } from "./lib/streakLogic";

async function selectedDay(ctx: QueryCtx | MutationCtx, tree: Doc<"trees">) {
  const real = await ctx.db.query("days").withIndex("by_tree_date", q => q.eq("treeId", tree._id)).order("desc")
    .filter(q => q.neq(q.field("isDemo"), true)).first();
  if (tree.demoDayId) return await ctx.db.get(tree.demoDayId);
  return real?.date === ritualWindow(Date.now()).date ? real : null;
}

async function yesterdayResult(ctx: QueryCtx | MutationCtx, tree: Doc<"trees">, today: Doc<"days">, viewer: Doc<"members">) {
  const date = shiftDate(today.ritualDate ?? today.date, -1);
  const day = today.isDemo ? (await ctx.db.query("days").withIndex("by_tree", q => q.eq("treeId", tree._id)).collect())
    .find(day => day.demoRunId === today._id && day.ritualDate === date) :
    await ctx.db.query("days").withIndex("by_tree_date", q => q.eq("treeId", tree._id).eq("date", date)).unique();
  if (!day) return null;
  const impact = await dayImpact(ctx, day, viewer);
  return { dayId: day._id, date, tree: { treeId: tree._id, name: tree.name }, charity: day.charity ?? sackCharity,
    ...impact, fruits: (await dayGiving(ctx, day, viewer._id, today.isDemo ? today : null)).fruits,
    isDemo: !!day.isDemo, closedAt: day.closedAt ?? null };
}

export const today = query({
  args: { deviceId: v.string(), treeId: v.id("trees") },
  handler: async (ctx, { deviceId, treeId }) => {
    const member = await requireMember(ctx, treeId, deviceId);
    const tree = await ctx.db.get(treeId);
    if (!tree) return null;
    const day = await selectedDay(ctx, tree);
    if (!day) return null;
    const members = (await ctx.db.query("members").withIndex("by_tree", q => q.eq("treeId", treeId)).collect())
      .filter(m => day.isDemo ? !m.demoHistory : !m.isDemo);
    const allAnswers = await ctx.db.query("answers").withIndex("by_day", q => q.eq("dayId", day._id)).collect();
    const mine = allAnswers.find(a => a.memberId === member._id);
    const unlocked = !!mine && day.bloomedAt !== undefined;
    const answers = unlocked ? allAnswers.map(a => ({ answerId: a._id, memberId: a.memberId,
      name: members.find(m => m._id === a.memberId)?.name ?? "A friend", text: a.text, blossom: a.blossom })) : [];
    const notes = [];
    if (unlocked) {
      for (const answer of allAnswers) {
        for (const note of await ctx.db.query("notes").withIndex("by_answer", q => q.eq("answerId", answer._id)).collect()) {
          if (note.fromMemberId !== member._id && answer.memberId !== member._id) continue;
          const from = allAnswers.find(a => a.memberId === note.fromMemberId);
          if (!from) continue;
          notes.push({ noteId: note._id, answerId: answer._id, fromMemberId: note.fromMemberId,
            fromName: members.find(m => m._id === note.fromMemberId)?.name ?? "A friend", text: note.text,
            createdAt: note.createdAt, fromBlossom: from.blossom, toBlossom: answer.blossom });
        }
      }
    }
    const paid = (await ctx.db.query("lanterns").withIndex("by_tree", q => q.eq("treeId", treeId)).collect()).filter(l => l.status === "paid" && l.source !== "demo");
    const run = await contributionScope(ctx, treeId);
    const streaks = await userSummary(ctx, deviceId, run);
    const { fruits, wateringEvent } = await dayGiving(ctx, day, member._id, run);
    const impact = await dayImpact(ctx, day, member);
    return {
      tree: { treeId, name: tree.name, code: tree.code, cause: tree.cause, isHost: tree.hostDeviceId === deviceId },
      member: { memberId: member._id, name: member.name },
      day: { dayId: day._id, date: day.date, question: day.question, opensAt: day.opensAt, bloomAt: day.bloomAt, bloomedAt: day.bloomedAt, isDemo: !!day.isDemo },
      memberCount: members.length, answerCount: allAnswers.length,
      myAnswer: mine ? { answerId: mine._id, blossom: mine.blossom } : null,
      answers, notes, lanternCount: paid.length, raisedCents: paid.reduce((total, l) => total + l.amountCents, 0),
      streaks, fruits, wateringEvent,
      charity: day.charity ?? sackCharity, ...impact, wateringLabel,
    };
  },
});

export const grove = query({
  args: { deviceId: v.string(), treeId: v.id("trees") },
  handler: async (ctx, { deviceId, treeId }) => {
    const member = await requireMember(ctx, treeId, deviceId);
    const run = await contributionScope(ctx, treeId);
    const current = run?.ritualDate ?? ritualWindow(Date.now()).date;
    const days = (await ctx.db.query("days").withIndex("by_tree", q => q.eq("treeId", treeId)).collect())
      .filter(day => run ? day.demoRunId === run._id && !!day.ritualDate && day.ritualDate < current :
        !day.isDemo && day.date < current && day.opensAt + 86_400_000 > member.joinedAt)
      .sort((a, b) => (b.ritualDate ?? b.date).localeCompare(a.ritualDate ?? a.date));
    return await Promise.all(days.map(async day => {
      const answers = await ctx.db.query("answers").withIndex("by_day", q => q.eq("dayId", day._id)).collect();
      const mine = answers.find(a => a.memberId === member._id);
      const date = day.ritualDate ?? day.date;
      return { dayId: day._id, date, question: day.question, bloomAt: day.bloomAt, bloomedAt: day.bloomedAt,
        answered: !!mine, answerCount: answers.length, blossom: mine?.blossom ?? null,
        fruits: (await dayGiving(ctx, day, member._id, run, true)).fruits, charity: day.charity ?? sackCharity, isDemo: !!run };
    }));
  },
});

export const yesterday = query({
  args: { deviceId: v.string(), treeId: v.id("trees") },
  handler: async (ctx, { deviceId, treeId }) => {
    const member = await requireMember(ctx, treeId, deviceId);
    const tree = await ctx.db.get(treeId);
    const today = tree ? await selectedDay(ctx, tree) : null;
    return tree && today ? await yesterdayResult(ctx, tree, today, member) : null;
  },
});

export const firstOpen = query({
  args: { deviceId: v.string(), treeId: v.id("trees") },
  handler: async (ctx, { deviceId, treeId }) => {
    const member = await requireMember(ctx, treeId, deviceId);
    const tree = await ctx.db.get(treeId);
    const today = tree ? await selectedDay(ctx, tree) : null;
    if (!tree || !today) return null;
    const user = await ctx.db.query("users").withIndex("by_device", q => q.eq("deviceId", deviceId)).unique();
    const viewed = user ? await ctx.db.query("impactViews").withIndex("by_user_tree_day", q =>
      q.eq("userId", user._id).eq("treeId", treeId).eq("dayId", today._id)).unique() : null;
    const yesterday = await yesterdayResult(ctx, tree, today, member);
    return { clock: ritualClock(Date.now()), todayDayId: today._id, shouldShowYesterday: !!yesterday && !viewed, yesterday };
  },
});

export const acknowledgeYesterday = mutation({
  args: { deviceId: v.string(), treeId: v.id("trees"), dayId: v.id("days") },
  handler: async (ctx, { deviceId, treeId, dayId }) => {
    const member = await requireMember(ctx, treeId, deviceId);
    const tree = await ctx.db.get(treeId);
    const day = tree ? await selectedDay(ctx, tree) : null;
    if (!day || day._id !== dayId) throw new Error("That day is no longer current");
    const userId = await ensureMemberUser(ctx, member);
    const existing = await ctx.db.query("impactViews").withIndex("by_user_tree_day", q =>
      q.eq("userId", userId).eq("treeId", treeId).eq("dayId", dayId)).unique();
    if (!existing) await ctx.db.insert("impactViews", { userId, treeId, dayId, seenAt: Date.now() });
    return null;
  },
});
