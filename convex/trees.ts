import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { deviceIdentity, textValue } from "./access";
import { ensureDay } from "./lifecycle";
import { ensureUser } from "./identity";

const cause = v.object({ name: v.string(), goalCents: v.optional(v.number()) });

export const create = mutation({
  args: { deviceId: v.string(), name: v.string(), memberName: v.string(), cause: v.optional(cause) },
  handler: async (ctx, args) => {
    deviceIdentity(args.deviceId);
    const name = textValue(args.name, "Tree name", 80);
    const memberName = textValue(args.memberName, "Your name", 60);
    const treeCause = args.cause ? { ...args.cause, name: textValue(args.cause.name, "Cause", 120) } : undefined;
    if (treeCause?.goalCents !== undefined && (!Number.isSafeInteger(treeCause.goalCents) || treeCause.goalCents <= 0)) {
      throw new ConvexError("Goal must be a positive number of cents");
    }
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let attempt = 0; attempt < 20; attempt++) {
      code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
      if (!(await ctx.db.query("trees").withIndex("by_code", q => q.eq("code", code)).unique())) break;
      code = "";
    }
    if (!code) throw new ConvexError("Please try creating your tree again");
    const now = Date.now();
    const userId = await ensureUser(ctx, args.deviceId);
    const treeId = await ctx.db.insert("trees", { name, code, hostDeviceId: args.deviceId, cause: treeCause, createdAt: now });
    const memberId = await ctx.db.insert("members", { treeId, deviceId: args.deviceId, userId, name: memberName, joinedAt: now });
    const dayId = await ensureDay(ctx, treeId);
    return { treeId, memberId, code, dayId };
  },
});

export const join = mutation({
  args: { deviceId: v.string(), code: v.string(), memberName: v.string() },
  handler: async (ctx, args) => {
    deviceIdentity(args.deviceId);
    const name = textValue(args.memberName, "Your name", 60);
    const code = args.code.trim().toUpperCase();
    const tree = await ctx.db.query("trees").withIndex("by_code", q => q.eq("code", code)).unique();
    if (!tree) throw new ConvexError("No tree has that invite code");
    const existing = await ctx.db.query("members").withIndex("by_tree_device", q =>
      q.eq("treeId", tree._id).eq("deviceId", args.deviceId)).unique();
    const userId = await ensureUser(ctx, args.deviceId);
    const memberId = existing?._id ?? await ctx.db.insert("members", { treeId: tree._id, deviceId: args.deviceId, userId, name, joinedAt: Date.now() });
    if (existing && !existing.userId) await ctx.db.patch(existing._id, { userId });
    const dayId = await ensureDay(ctx, tree._id);
    return { treeId: tree._id, memberId, code, dayId: tree.demoDayId ?? dayId };
  },
});

export const list = query({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    deviceIdentity(deviceId);
    const memberships = await ctx.db.query("members").withIndex("by_device", q => q.eq("deviceId", deviceId)).collect();
    const result = [];
    for (const member of memberships) {
      const tree = await ctx.db.get(member.treeId);
      if (tree && !member.isDemo) result.push({ treeId: tree._id, name: tree.name, code: tree.code, memberId: member._id,
        memberName: member.name, isHost: tree.hostDeviceId === deviceId, cause: tree.cause });
    }
    return result;
  },
});
