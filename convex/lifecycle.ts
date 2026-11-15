import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { activeDay } from "./access";
import { questions, ritualWindow } from "./questions";
import { queueBloomNotifications } from "./notifications";
import { sackCharity, ensureSackCause } from "./charity";
import { closeDay } from "./impact";

export async function ensureDay(ctx: MutationCtx, treeId: Id<"trees">) {
  const window = ritualWindow(Date.now());
  const causeId = await ensureSackCause(ctx);
  const existing = await ctx.db.query("days").withIndex("by_tree_date", q =>
    q.eq("treeId", treeId).eq("date", window.date)).unique();
  if (existing) {
    if (!existing.charity || !existing.causeId) await ctx.db.patch(existing._id, { charity: existing.charity ?? sackCharity, causeId: existing.causeId ?? causeId });
    return existing._id;
  }
  const tree = await ctx.db.get(treeId);
  if (!tree) throw new Error("Tree not found");
  const cursor = tree.questionCursor ?? 0;
  const questionIndex = cursor % questions.length;
  const dayId = await ctx.db.insert("days", { treeId, ...window, question: questions[questionIndex], questionIndex, charity: sackCharity, causeId });
  await ctx.db.patch(treeId, { questionCursor: cursor + 1 });
  await ctx.scheduler.runAt(Math.max(Date.now(), window.bloomAt), internal.lifecycle.bloom, { dayId });
  return dayId;
}

export async function maybeBloom(ctx: MutationCtx, day: Doc<"days">) {
  if (day.bloomedAt !== undefined || !(await activeDay(ctx, day))) return;
  const answers = await ctx.db.query("answers").withIndex("by_day", q => q.eq("dayId", day._id)).collect();
  const members = (await ctx.db.query("members").withIndex("by_tree", q => q.eq("treeId", day.treeId)).collect())
    .filter(member => day.isDemo ? !member.demoHistory : !member.isDemo);
  const everyone = members.length > 0 && members.every(member => answers.some(a => a.memberId === member._id));
  if (Date.now() < day.bloomAt && !everyone) return;
  const now = Date.now();
  await ctx.db.patch(day._id, { bloomedAt: now, judgeQueuedAt: now });
  await queueBloomNotifications(ctx, { ...day, bloomedAt: now, judgeQueuedAt: now });
  await ctx.scheduler.runAfter(0, internal.judgeHook.run, { dayId: day._id });
}

export const bloom = internalMutation({
  args: { dayId: v.id("days") },
  handler: async (ctx, { dayId }) => {
    const day = await ctx.db.get(dayId);
    if (day) await maybeBloom(ctx, day);
  },
});

export const morning = internalMutation({
  args: {},
  handler: async ctx => {
    for (const tree of await ctx.db.query("trees").collect()) {
      const days = await ctx.db.query("days").withIndex("by_tree", q => q.eq("treeId", tree._id)).collect();
      for (const day of days) {
        if (day.isDemo || day.opensAt + 86_400_000 > Date.now()) continue;
        await maybeBloom(ctx, day);
        await closeDay(ctx, day);
      }
      await ensureDay(ctx, tree._id);
    }
  },
});
