import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, mutation } from "./_generated/server";
import { requireMember } from "./access";
import { bundleCents } from "./lib/payments";
import { ensureMemberUser } from "./identity";

export const checkout = action({
  args: { deviceId: v.string(), treeId: v.id("trees"), dayId: v.id("days"),
    bundles: v.union(v.literal(2), v.literal(5), v.literal(10)), answerId: v.optional(v.id("answers")) },
  handler: async (ctx, args): Promise<{ wateringId: Id<"lanterns">; checkoutUrl: string }> => {
    return await ctx.runAction(internal.lanterns.createWateringCheckout, args);
  },
});

export const demoWater = mutation({
  args: { deviceId: v.string(), treeId: v.id("trees"), dayId: v.optional(v.id("days")), runId: v.optional(v.id("days")),
    bundles: v.optional(v.union(v.literal(2), v.literal(5), v.literal(10))), amountCents: v.optional(v.number()), requestId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { deviceId, treeId } = args;
    const bundles = args.bundles ?? (args.amountCents ?? NaN) / 50;
    const amountCents = bundleCents(bundles);
    if (args.amountCents !== undefined && args.amountCents !== amountCents) throw new ConvexError("Bundle price does not match");
    if ((args.dayId && !args.requestId) || (args.requestId && !/^[A-Za-z0-9_-]{16,128}$/.test(args.requestId))) throw new ConvexError("A stable demo request ID is required");
    const runId = args.dayId ?? args.runId;
    if (!runId || (args.dayId && args.runId && args.dayId !== args.runId)) throw new ConvexError("That demo watering is not available");
    const member = await requireMember(ctx, treeId, deviceId);
    const tree = await ctx.db.get(treeId);
    const day = await ctx.db.get(runId);
    if (!day?.isDemo || tree?.demoDayId !== runId || day.treeId !== treeId || !day.ritualDate) throw new ConvexError("That demo watering is not available");
    const answer = await ctx.db.query("answers").withIndex("by_day_member", q => q.eq("dayId", runId).eq("memberId", member._id)).unique();
    if (!answer) throw new ConvexError("That demo watering is not available; answer first");
    const userId = await ensureMemberUser(ctx, member);
    const key = `demo:${runId}:${userId}:${args.requestId ?? "legacy-once"}`;
    const existing = await ctx.db.query("lanterns").withIndex("by_checkout", q => q.eq("whopCheckoutId", key)).first();
    if (existing) {
      if (existing.amountCents !== amountCents || existing.bundles !== bundles) throw new ConvexError("Demo request already has different bundles");
      return { wateringId: existing._id, isDemo: true as const };
    }
    const wateringId = await ctx.db.insert("lanterns", { treeId, memberId: member._id, userId, dayId: runId, bundles, attribution: "checkout_day", amountCents,
      status: "paid", whopCheckoutId: key, createdAt: Date.now(), paidAt: Date.now(), confirmedAt: Date.now(),
      creditedDate: day.ritualDate, source: "demo", demoRunId: runId });
    return { wateringId, isDemo: true as const };
  },
});
