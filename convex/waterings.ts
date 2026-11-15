import { ConvexError, v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, mutation } from "./_generated/server";
import { readableDay, requireMember } from "./access";
import { validateAmount } from "./lib/payments";

export const checkout = action({
  args: { deviceId: v.string(), treeId: v.id("trees"), answerId: v.optional(v.id("answers")), amountCents: v.number() },
  handler: async (ctx, args): Promise<{ wateringId: Id<"lanterns">; checkoutUrl: string }> => {
    const result = await ctx.runAction(api.lanterns.checkout, args);
    return { wateringId: result.lanternId, checkoutUrl: result.checkoutUrl };
  },
});

export const demoWater = mutation({
  args: { deviceId: v.string(), treeId: v.id("trees"), runId: v.id("days"), amountCents: v.number() },
  handler: async (ctx, { deviceId, treeId, runId, amountCents }) => {
    validateAmount(amountCents);
    const member = await requireMember(ctx, treeId, deviceId);
    const tree = await ctx.db.get(treeId);
    const day = await ctx.db.get(runId);
    if (!day?.isDemo || tree?.demoDayId !== runId || day.treeId !== treeId || !day.ritualDate ||
        !(await readableDay(ctx, day, member._id))) throw new ConvexError("That demo watering is not available");
    const key = `demo:${runId}:${member._id}`;
    const existing = await ctx.db.query("lanterns").withIndex("by_checkout", q => q.eq("whopCheckoutId", key)).first();
    if (existing) return { wateringId: existing._id, isDemo: true as const };
    const wateringId = await ctx.db.insert("lanterns", { treeId, memberId: member._id, amountCents,
      status: "paid", whopCheckoutId: key, createdAt: Date.now(), paidAt: Date.now(), confirmedAt: Date.now(),
      creditedDate: day.ritualDate, source: "demo", demoRunId: runId });
    return { wateringId, isDemo: true as const };
  },
});
