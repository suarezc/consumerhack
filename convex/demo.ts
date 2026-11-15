import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation } from "./_generated/server";
import { requireHost } from "./access";
import { insertAnswer } from "./answers";
import { ensureDay } from "./lifecycle";

const samples = [
  { name: "Maya", text: "A friend saved me a seat without being asked." },
  { name: "Theo", text: "The light through the kitchen window while the kettle boiled." },
  { name: "June", text: "My dad called just to tell me about a bird he saw." },
];

export const restart = mutation({
  args: { deviceId: v.string(), treeId: v.id("trees") },
  handler: async (ctx, { deviceId, treeId }) => {
    await requireHost(ctx, treeId, deviceId);
    const opensAt = Date.now();
    const bloomAt = opensAt + 60_000;
    const dayId = await ctx.db.insert("days", { treeId, date: `demo:${opensAt}`, question: "What small thing made today feel a little softer?", opensAt, bloomAt, isDemo: true });
    await ctx.db.patch(treeId, { demoDayId: dayId });
    for (let index = 0; index < samples.length; index++) {
      const sample = samples[index];
      const sampleDevice = `$demo:${treeId}:${index}`;
      let member = await ctx.db.query("members").withIndex("by_tree_device", q => q.eq("treeId", treeId).eq("deviceId", sampleDevice)).unique();
      if (!member) {
        const id = await ctx.db.insert("members", { treeId, deviceId: sampleDevice, name: sample.name, joinedAt: opensAt, isDemo: true });
        member = await ctx.db.get(id);
      }
      await ctx.scheduler.runAfter((index + 1) * 10_000, internal.demo.seed, { dayId, memberId: member!._id, text: sample.text });
    }
    await ctx.scheduler.runAt(bloomAt, internal.lifecycle.bloom, { dayId });
    return { dayId, opensAt, bloomAt };
  },
});

export const seed = internalMutation({
  args: { dayId: v.id("days"), memberId: v.id("members"), text: v.string() },
  handler: async (ctx, { dayId, memberId, text }) => {
    const day = await ctx.db.get(dayId);
    if (!day || !day.isDemo || day.bloomedAt !== undefined || Date.now() >= day.bloomAt) return;
    const tree = await ctx.db.get(day.treeId);
    const member = await ctx.db.get(memberId);
    if (tree?.demoDayId !== dayId || !member?.isDemo || member.treeId !== day.treeId) return;
    await insertAnswer(ctx, day, memberId, text);
  },
});

export const stop = mutation({
  args: { deviceId: v.string(), treeId: v.id("trees") },
  handler: async (ctx, { deviceId, treeId }) => {
    await requireHost(ctx, treeId, deviceId);
    await ctx.db.patch(treeId, { demoDayId: undefined });
    await ensureDay(ctx, treeId);
    return null;
  },
});
