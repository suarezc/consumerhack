import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireMember } from "./access";
import { ritualWindow } from "./questions";
import { contributionScope, dayGiving, userSummary } from "./streaks";

export const today = query({
  args: { deviceId: v.string(), treeId: v.id("trees") },
  handler: async (ctx, { deviceId, treeId }) => {
    const member = await requireMember(ctx, treeId, deviceId);
    const tree = await ctx.db.get(treeId);
    if (!tree) return null;
    const day = tree.demoDayId ? await ctx.db.get(tree.demoDayId) : await ctx.db.query("days")
      .withIndex("by_tree_date", q => q.eq("treeId", treeId)).order("desc")
      .filter(q => q.neq(q.field("isDemo"), true)).first();
    if (!day || (!day.isDemo && day.date !== ritualWindow(Date.now()).date)) return null;
    const members = (await ctx.db.query("members").withIndex("by_tree", q => q.eq("treeId", treeId)).collect())
      .filter(m => day.isDemo || !m.isDemo);
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
    const { fruits, wateringEvent } = await dayGiving(ctx, treeId, streaks.clock.date, member._id, run);
    return {
      tree: { treeId, name: tree.name, code: tree.code, cause: tree.cause, isHost: tree.hostDeviceId === deviceId },
      member: { memberId: member._id, name: member.name },
      day: { dayId: day._id, date: day.date, question: day.question, opensAt: day.opensAt, bloomAt: day.bloomAt, bloomedAt: day.bloomedAt, isDemo: !!day.isDemo },
      memberCount: members.length, answerCount: allAnswers.length,
      myAnswer: mine ? { answerId: mine._id, blossom: mine.blossom } : null,
      answers, notes, lanternCount: paid.length, raisedCents: paid.reduce((total, l) => total + l.amountCents, 0),
      streaks, fruits, wateringEvent,
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
        fruits: (await dayGiving(ctx, treeId, date, member._id, run, true)).fruits, isDemo: !!run };
    }));
  },
});
