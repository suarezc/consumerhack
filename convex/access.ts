import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export function deviceIdentity(deviceId: string) {
  if (deviceId.length < 16 || deviceId.length > 256 || deviceId.startsWith("$demo:")) {
    throw new ConvexError("Invalid device identity");
  }
  return deviceId;
}

export function textValue(value: string, label: string, max: number) {
  const text = value.trim();
  if (!text || text.length > max) throw new ConvexError(`${label} must be 1–${max} characters`);
  return text;
}

export async function requireMember(ctx: QueryCtx | MutationCtx, treeId: Id<"trees">, deviceId: string) {
  deviceIdentity(deviceId);
  const member = await ctx.db.query("members").withIndex("by_tree_device", q =>
    q.eq("treeId", treeId).eq("deviceId", deviceId)).unique();
  if (!member || member.isDemo) throw new ConvexError("Tree membership required");
  return member;
}

export async function requireHost(ctx: MutationCtx, treeId: Id<"trees">, deviceId: string) {
  await requireMember(ctx, treeId, deviceId);
  const tree = await ctx.db.get(treeId);
  if (!tree || tree.hostDeviceId !== deviceId) throw new ConvexError("Only the host can do that");
  return tree;
}

export async function activeDay(ctx: QueryCtx | MutationCtx, day: Doc<"days">) {
  const tree = await ctx.db.get(day.treeId);
  return !!tree && (!day.isDemo || tree.demoDayId === day._id);
}

export async function readableDay(ctx: QueryCtx | MutationCtx, day: Doc<"days">, memberId: Id<"members">) {
  if (day.bloomedAt === undefined || !(await activeDay(ctx, day))) return false;
  return !!await ctx.db.query("answers").withIndex("by_day_member", q =>
    q.eq("dayId", day._id).eq("memberId", memberId)).unique();
}
