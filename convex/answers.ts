import { ConvexError, v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { activeDay, requireMember, textValue } from "./access";
import { maybeBloom } from "./lifecycle";

export async function insertAnswer(ctx: MutationCtx, day: Doc<"days">, memberId: Doc<"members">["_id"], text: string) {
  if (!(await activeDay(ctx, day))) throw new ConvexError("That demo has ended");
  const existing = await ctx.db.query("answers").withIndex("by_day_member", q =>
    q.eq("dayId", day._id).eq("memberId", memberId)).unique();
  if (existing) return { answerId: existing._id, blossom: existing.blossom };
  if (day.bloomedAt !== undefined || Date.now() >= day.bloomAt) throw new ConvexError("This day has already bloomed");
  if (Date.now() < day.opensAt) throw new ConvexError("This day has not opened yet");
  const answers = await ctx.db.query("answers").withIndex("by_day", q => q.eq("dayId", day._id)).collect();
  const blossom = answers.length;
  const answerId = await ctx.db.insert("answers", { dayId: day._id, treeId: day.treeId, memberId, text, blossom, createdAt: Date.now() });
  await maybeBloom(ctx, day);
  return { answerId, blossom };
}

export const submit = mutation({
  args: { deviceId: v.string(), dayId: v.id("days"), text: v.string() },
  handler: async (ctx, { deviceId, dayId, text }) => {
    const day = await ctx.db.get(dayId);
    if (!day) throw new ConvexError("Day not found");
    const member = await requireMember(ctx, day.treeId, deviceId);
    return await insertAnswer(ctx, day, member._id, textValue(text, "Answer", 2000));
  },
});
