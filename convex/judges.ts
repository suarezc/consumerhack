import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireMember } from "./access";
import { assessAnswers } from "./lib/judgeAdapter";
import { demoKindred } from "./lib/judgeFixtures";
import { currentBloom, eligibleTarget, fixtureCode, rankMatches, validAssessment } from "./lib/judgeLogic";

export const kindred = query({
  args: { deviceId: v.string(), dayId: v.id("days") },
  handler: async (ctx, { deviceId, dayId }) => {
    const day = await ctx.db.get(dayId);
    if (!day) throw new Error("Day not found");
    const member = await requireMember(ctx, day.treeId, deviceId);
    const tree = await ctx.db.get(day.treeId);
    const source = await ctx.db.query("answers").withIndex("by_day_member", (q) =>
      q.eq("dayId", dayId).eq("memberId", member._id)).unique();
    if (!source || !currentBloom(day, tree)) return { status: "locked" as const, matches: [] };
    const result = await ctx.db.query("kindred").withIndex("by_answer", (q) => q.eq("answerId", source._id)).unique();
    if (!result) return { status: "pending" as const, matches: [] };
    const matches = [];
    const seen = new Set<string>();
    for (const match of result.matches.slice(0, 3)) {
      if (seen.has(match.answerId)) continue;
      seen.add(match.answerId);
      const target = await ctx.db.get(match.answerId);
      if (!target) continue;
      const targetDay = await ctx.db.get(target.dayId);
      const targetTree = await ctx.db.get(target.treeId);
      if (!targetDay || !targetTree || targetDay.treeId !== target.treeId || !eligibleTarget(day, targetDay, targetTree)) continue;
      matches.push({ answerId: target._id, text: target.text, treeName: targetTree.name, reason: match.reason });
    }
    return { status: "ready" as const, matches };
  },
});

export const prepareDemo = internalMutation({
  args: { dayId: v.id("days"), secrets: v.array(v.string()) },
  handler: async (ctx, { dayId, secrets }) => {
    const day = await ctx.db.get(dayId);
    if (!day || !day.isDemo || !currentBloom(day, await ctx.db.get(day.treeId))) return;
    if (secrets.length !== 3 || secrets.some((secret) => secret.length < 32)) throw new Error("Invalid fixture setup");
    for (const [index, fixture] of demoKindred.entries()) {
      const code = fixtureCode(dayId, index);
      const existing = await ctx.db.query("trees").withIndex("by_code", (q) => q.eq("code", code)).unique();
      if (existing) continue;
      const treeId = await ctx.db.insert("trees", {
        name: fixture.treeName, code, hostDeviceId: secrets[index], createdAt: day.opensAt,
      });
      const memberId = await ctx.db.insert("members", {
        treeId, deviceId: secrets[index], name: "A kindred voice", joinedAt: day.opensAt, isDemo: true,
      });
      const fixtureDayId = await ctx.db.insert("days", {
        treeId, date: day.date, question: day.question, opensAt: day.opensAt,
        bloomAt: day.bloomAt, bloomedAt: day.bloomedAt, isDemo: true,
      });
      await ctx.db.patch(treeId, { demoDayId: fixtureDayId });
      await ctx.db.insert("answers", {
        treeId, dayId: fixtureDayId, memberId, text: fixture.text, blossom: 0, createdAt: day.opensAt,
      });
    }
  },
});

export const snapshot = internalQuery({
  args: { dayId: v.id("days") },
  handler: async (ctx, { dayId }) => {
    const day = await ctx.db.get(dayId);
    if (!day || !currentBloom(day, await ctx.db.get(day.treeId))) return null;
    const sources = [];
    for (const answer of await ctx.db.query("answers").withIndex("by_day", (q) => q.eq("dayId", dayId)).collect()) {
      const result = await ctx.db.query("kindred").withIndex("by_answer", (q) => q.eq("answerId", answer._id)).unique();
      if (!result) sources.push(answer);
    }
    if (!sources.length) return null;
    const candidates: Doc<"answers">[] = [];
    if (day.isDemo) {
      for (let index = 0; index < 3; index++) {
        const code = fixtureCode(dayId, index);
        const tree = await ctx.db.query("trees").withIndex("by_code", (q) => q.eq("code", code)).unique();
        if (!tree?.demoDayId) continue;
        candidates.push(...await ctx.db.query("answers").withIndex("by_day", (q) => q.eq("dayId", tree.demoDayId!)).collect());
      }
    } else {
      const days = await ctx.db.query("days").order("desc").filter((q) => q.and(
        q.neq(q.field("isDemo"), true), q.neq(q.field("bloomedAt"), undefined), q.neq(q.field("treeId"), day.treeId),
      )).take(32);
      for (const targetDay of days) {
        const tree = await ctx.db.get(targetDay.treeId);
        if (!eligibleTarget(day, targetDay, tree)) continue;
        candidates.push(...await ctx.db.query("answers").withIndex("by_day", (q) => q.eq("dayId", targetDay._id)).take(128 - candidates.length));
        if (candidates.length === 128) break;
      }
    }
    return {
      sources: sources.map(({ _id, treeId, text }) => ({ answerId: _id, treeId, text })),
      candidates: candidates.map(({ _id, treeId, text }) => ({ answerId: _id, treeId, text })),
    };
  },
});

const matchValidator = v.object({ answerId: v.id("answers"), reason: v.string() });

export const commit = internalMutation({
  args: {
    dayId: v.id("days"),
    results: v.array(v.object({
      answerId: v.id("answers"), mood: v.number(), embedding: v.array(v.number()), matches: v.array(matchValidator),
    })),
  },
  handler: async (ctx, { dayId, results }) => {
    const day = await ctx.db.get(dayId);
    if (!day || !currentBloom(day, await ctx.db.get(day.treeId))) return;
    for (const result of results) {
      const source = await ctx.db.get(result.answerId);
      if (!source || source.dayId !== dayId || source.treeId !== day.treeId || !validAssessment(result)) continue;
      const existing = await ctx.db.query("kindred").withIndex("by_answer", (q) => q.eq("answerId", source._id)).unique();
      if (existing) continue;
      const matches = [];
      const seen = new Set<string>();
      for (const match of result.matches.slice(0, 3)) {
        if (seen.has(match.answerId)) continue;
        seen.add(match.answerId);
        const target = await ctx.db.get(match.answerId);
        if (!target) continue;
        const targetDay = await ctx.db.get(target.dayId);
        const targetTree = await ctx.db.get(target.treeId);
        if (targetDay?.treeId !== target.treeId || !eligibleTarget(day, targetDay, targetTree)) continue;
        matches.push({ answerId: target._id, reason: match.reason.replace(/\s+/g, " ").trim().slice(0, 160) });
      }
      await ctx.db.patch(source._id, { mood: result.mood, embedding: result.embedding });
      await ctx.db.insert("kindred", { answerId: source._id, matches });
    }
  },
});

export const run = internalAction({
  args: { dayId: v.id("days"), attempt: v.optional(v.number()) },
  handler: async (ctx, { dayId, attempt = 0 }): Promise<void> => {
    try {
      await ctx.runMutation(internal.judges.prepareDemo, {
        dayId, secrets: demoKindred.map(() => crypto.randomUUID() + crypto.randomUUID()),
      });
      const data = await ctx.runQuery(internal.judges.snapshot, { dayId });
      if (!data) return;
      const answers = [...data.sources, ...data.candidates];
      const assessments = await assessAnswers(answers.map((answer) => answer.text), {
        mode: process.env.STORYTIME_JUDGE_MODE, apiKey: process.env.OPENAI_API_KEY,
      });
      const assessed = answers.map((answer, index) => ({ ...answer, ...assessments[index] }));
      const candidates = assessed.slice(data.sources.length);
      await ctx.runMutation(internal.judges.commit, {
        dayId,
        results: assessed.slice(0, data.sources.length).map((source) => ({
          answerId: source.answerId, mood: source.mood, embedding: source.embedding,
          matches: rankMatches(source, candidates).map((match) => ({ ...match, answerId: match.answerId as Id<"answers"> })),
        })),
      });
    } catch {
      if (attempt < 2) await ctx.scheduler.runAfter((attempt + 1) * 1_000, internal.judges.run, { dayId, attempt: attempt + 1 });
      else throw new Error("Judging could not finish; retry this day");
    }
  },
});
