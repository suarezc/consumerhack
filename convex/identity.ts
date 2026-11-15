import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export async function ensureUser(ctx: MutationCtx, deviceId: string) {
  const existing = await ctx.db.query("users").withIndex("by_device", q => q.eq("deviceId", deviceId)).unique();
  return existing?._id ?? await ctx.db.insert("users", { deviceId, createdAt: Date.now() });
}

export async function ensureMemberUser(ctx: MutationCtx, member: Doc<"members">) {
  if (member.userId) return member.userId;
  const userId = await ensureUser(ctx, member.deviceId);
  await ctx.db.patch(member._id, { userId });
  return userId;
}

export async function personKey(ctx: QueryCtx | MutationCtx, memberId: Doc<"members">["_id"]) {
  const member = await ctx.db.get(memberId);
  if (!member) return `removed:${memberId}`;
  if (member.userId) return member.userId;
  const user = await ctx.db.query("users").withIndex("by_device", q => q.eq("deviceId", member.deviceId)).unique();
  return user?._id ?? `legacy:${member.deviceId}`;
}
