import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const run = internalAction({
  args: { dayId: v.id("days") },
  handler: async (ctx, { dayId }): Promise<void> => {
    await ctx.runAction(internal.judges.run, { dayId });
  },
});
