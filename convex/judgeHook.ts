import { v } from "convex/values";
import { internalAction } from "./_generated/server";

export const run = internalAction({
  args: { dayId: v.id("days") },
  handler: async () => null,
});
