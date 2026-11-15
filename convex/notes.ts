import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { readableDay, requireMember, textValue } from "./access";

export const send = mutation({
  args: { deviceId: v.string(), answerId: v.id("answers"), text: v.string() },
  handler: async (ctx, { deviceId, answerId, text }) => {
    const answer = await ctx.db.get(answerId);
    if (!answer) throw new ConvexError("Answer not available");
    const member = await requireMember(ctx, answer.treeId, deviceId);
    const day = await ctx.db.get(answer.dayId);
    if (!day || !(await readableDay(ctx, day, member._id))) throw new ConvexError("Answer not available");
    const noteId = await ctx.db.insert("notes", { answerId, fromMemberId: member._id, text: textValue(text, "Note", 1000), createdAt: Date.now() });
    return { noteId };
  },
});
