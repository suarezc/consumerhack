import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction, internalMutation, mutation, query, type MutationCtx, type QueryCtx,
} from "./_generated/server";
import { activeDay, deviceIdentity } from "./access";
import { eligibleNotification, validExpoToken } from "./lib/notificationPolicy";
import { getPushReceipt, sendPush } from "./lib/notificationProvider";
import { notificationGivingContext } from "./streaks";

const permission = v.union(v.literal("granted"), v.literal("denied"), v.literal("undetermined"));

function configured() {
  return process.env.EXPO_PUSH_ENABLED === "true" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(process.env.EXPO_PROJECT_ID ?? "");
}

function publicPreference(preference: Doc<"notificationPreferences"> | null) {
  return {
    revision: preference?.revision ?? 0,
    optIn: preference?.optIn ?? false,
    permission: preference?.permission ?? "undetermined" as const,
    registered: !!preference?.optIn && preference.permission === "granted" && validExpoToken(preference.token),
    available: configured(),
  };
}

export const preference = query({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    deviceIdentity(deviceId);
    return publicPreference(await ctx.db.query("notificationPreferences")
      .withIndex("by_device", q => q.eq("deviceId", deviceId)).unique());
  },
});

export const updatePreference = mutation({
  args: {
    deviceId: v.string(), expectedRevision: v.number(), optIn: v.boolean(), permission,
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    deviceIdentity(args.deviceId);
    const members = await ctx.db.query("members").withIndex("by_device", q => q.eq("deviceId", args.deviceId)).collect();
    if (!members.some(member => !member.isDemo)) throw new ConvexError("Tree membership required");
    const current = await ctx.db.query("notificationPreferences")
      .withIndex("by_device", q => q.eq("deviceId", args.deviceId)).unique();
    if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision !== (current?.revision ?? 0)) {
      throw new ConvexError("Notification preferences changed; refresh and try again");
    }
    let token: string | undefined;
    if (configured() && args.optIn && args.permission === "granted" && args.token !== undefined) {
      if (!validExpoToken(args.token)) throw new ConvexError("Invalid notification registration");
      const owner = await ctx.db.query("notificationPreferences").withIndex("by_token", q => q.eq("token", args.token)).unique();
      if (owner && owner.deviceId !== args.deviceId) throw new ConvexError("Notification registration unavailable");
      token = args.token;
    }
    const value = {
      deviceId: args.deviceId, optIn: args.optIn, permission: args.permission, token,
      revision: (current?.revision ?? 0) + 1, updatedAt: Date.now(),
    };
    const id = current?._id ?? await ctx.db.insert("notificationPreferences", value);
    if (current) await ctx.db.patch(id, value);
    return publicPreference(await ctx.db.get(id));
  },
});

async function context(ctx: QueryCtx | MutationCtx, dayId: Id<"days">, deviceId: string) {
  const day = await ctx.db.get(dayId);
  if (!day) return null;
  const member = await ctx.db.query("members").withIndex("by_tree_device", q =>
    q.eq("treeId", day.treeId).eq("deviceId", deviceId)).unique();
  const preference = await ctx.db.query("notificationPreferences")
    .withIndex("by_device", q => q.eq("deviceId", deviceId)).unique();
  const now = Date.now();
  const giving = await notificationGivingContext(ctx, deviceId, now);
  const eligible = eligibleNotification({
    now, giving, preference,
    source: { ...day, active: await activeDay(ctx, day), member: !!member && !member.isDemo },
  });
  return { eligible, preference, giving };
}

async function queueUserNotification(ctx: MutationCtx, day: Doc<"days">, deviceId: string) {
  const existing = await ctx.db.query("notificationOutbox").withIndex("by_device_date", q =>
    q.eq("deviceId", deviceId).eq("date", day.date)).unique();
  if (existing) return;
  const candidate = await context(ctx, day._id, deviceId);
  if (!candidate?.eligible) return;
  const now = Date.now();
  const outboxId = await ctx.db.insert("notificationOutbox", {
    deviceId, date: day.date, dayId: day._id, state: "queued",
    attempt: 0, createdAt: now, updatedAt: now,
  });
  await ctx.scheduler.runAfter(0, internal.notifications.dispatch, { outboxId });
}

export async function queueBloomNotifications(ctx: MutationCtx, day: Doc<"days">) {
  if (!configured() || day.isDemo || day.bloomedAt === undefined) return;
  const members = await ctx.db.query("members").withIndex("by_tree", q => q.eq("treeId", day.treeId)).collect();
  for (const member of members) {
    if (!member.isDemo) await queueUserNotification(ctx, day, member.deviceId);
  }
}

export async function queuePaidUserNotifications(ctx: MutationCtx, deviceId: string) {
  if (!configured()) return;
  deviceIdentity(deviceId);
  const { dayKey, giving } = await notificationGivingContext(ctx, deviceId, Date.now());
  if (!giving.atRisk || giving.count <= 0) return;
  const memberships = await ctx.db.query("members").withIndex("by_device", q => q.eq("deviceId", deviceId)).collect();
  for (const member of memberships) {
    if (member.isDemo) continue;
    const day = await ctx.db.query("days").withIndex("by_tree_date", q =>
      q.eq("treeId", member.treeId).eq("date", dayKey)).filter(q => q.neq(q.field("isDemo"), true)).first();
    if (day?.bloomedAt !== undefined) await queueUserNotification(ctx, day, deviceId);
  }
}

export const foregroundEligibility = query({
  args: { deviceId: v.string(), date: v.string() },
  handler: async (ctx, { deviceId, date }) => {
    deviceIdentity(deviceId);
    if (!configured()) return false;
    const row = await ctx.db.query("notificationOutbox").withIndex("by_device_date", q =>
      q.eq("deviceId", deviceId).eq("date", date)).unique();
    if (!row || !["dispatching", "accepted", "handed_off"].includes(row.state)) return false;
    return (await context(ctx, row.dayId, deviceId))?.eligible ?? false;
  },
});

export const claim = internalMutation({
  args: { outboxId: v.id("notificationOutbox") },
  handler: async (ctx, { outboxId }) => {
    const row = await ctx.db.get(outboxId);
    if (!row || row.state !== "queued") return null;
    const candidate = await context(ctx, row.dayId, row.deviceId);
    if (!configured() || !candidate?.eligible || !candidate.preference?.token || row.date !== candidate.giving.dayKey) {
      await ctx.db.patch(outboxId, { state: "suppressed", updatedAt: Date.now() });
      return null;
    }
    const attempt = row.attempt + 1;
    await ctx.db.patch(outboxId, {
      state: "dispatching", attempt, preferenceRevision: candidate.preference.revision, updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(60_000, internal.notifications.expireClaim, { outboxId, attempt });
    return { token: candidate.preference.token, date: row.date, streak: candidate.giving.giving.count, attempt };
  },
});

export const expireClaim = internalMutation({
  args: { outboxId: v.id("notificationOutbox"), attempt: v.number() },
  handler: async (ctx, { outboxId, attempt }) => {
    const row = await ctx.db.get(outboxId);
    if (row?.state === "dispatching" && row.attempt === attempt) {
      await ctx.db.patch(outboxId, { state: "unknown", error: "DispatchInterrupted", updatedAt: Date.now() });
    }
  },
});

async function revokeRegistration(ctx: MutationCtx, row: Doc<"notificationOutbox">) {
  const current = await ctx.db.query("notificationPreferences")
    .withIndex("by_device", q => q.eq("deviceId", row.deviceId)).unique();
  if (current && current.revision === row.preferenceRevision) {
    await ctx.db.patch(current._id, { token: undefined, revision: current.revision + 1, updatedAt: Date.now() });
  }
}

export const finish = internalMutation({
  args: {
    outboxId: v.id("notificationOutbox"), attempt: v.number(),
    result: v.union(
      v.object({ kind: v.literal("accepted"), ticketId: v.string() }),
      v.object({ kind: v.literal("unknown") }),
      v.object({ kind: v.literal("rejected"), error: v.string(), retryable: v.boolean() }),
    ),
  },
  handler: async (ctx, { outboxId, attempt, result }) => {
    const row = await ctx.db.get(outboxId);
    if (!row || row.attempt !== attempt || row.state !== "dispatching") return;
    if (result.kind === "accepted") {
      await ctx.db.patch(outboxId, { state: "accepted", ticketId: result.ticketId, updatedAt: Date.now() });
      await ctx.scheduler.runAfter(15 * 60_000, internal.notifications.receipt, { outboxId, check: 0 });
      return;
    }
    if (result.kind === "unknown") {
      await ctx.db.patch(outboxId, { state: "unknown", error: "ProviderAcceptanceUnknown", updatedAt: Date.now() });
      return;
    }
    if (result.error === "DeviceNotRegistered") await revokeRegistration(ctx, row);
    const retry = result.retryable && result.error === "MessageRateExceeded" && attempt < 3;
    await ctx.db.patch(outboxId, { state: retry ? "queued" : "failed", error: result.error, updatedAt: Date.now() });
    if (retry) await ctx.scheduler.runAfter(2 ** attempt * 5_000, internal.notifications.dispatch, { outboxId });
  },
});

export const dispatch = internalAction({
  args: { outboxId: v.id("notificationOutbox") },
  handler: async (ctx, { outboxId }): Promise<void> => {
    const candidate = await ctx.runMutation(internal.notifications.claim, { outboxId });
    if (!candidate) return;
    const result = await sendPush({ ...candidate, accessToken: process.env.EXPO_ACCESS_TOKEN });
    await ctx.runMutation(internal.notifications.finish, { outboxId, attempt: candidate.attempt, result });
  },
});

export const receiptContext = internalMutation({
  args: { outboxId: v.id("notificationOutbox") },
  handler: async (ctx, { outboxId }) => {
    const row = await ctx.db.get(outboxId);
    return row?.state === "accepted" && row.ticketId ? row.ticketId : null;
  },
});

export const finishReceipt = internalMutation({
  args: {
    outboxId: v.id("notificationOutbox"), check: v.number(),
    result: v.union(
      v.object({ kind: v.literal("handed_off") }),
      v.object({ kind: v.literal("pending") }),
      v.object({ kind: v.literal("rejected"), error: v.string(), retryable: v.boolean() }),
    ),
  },
  handler: async (ctx, { outboxId, check, result }) => {
    const row = await ctx.db.get(outboxId);
    if (!row || row.state !== "accepted") return;
    if (result.kind === "pending") {
      if (check < 2) {
        await ctx.scheduler.runAfter(15 * 60_000 * 2 ** (check + 1), internal.notifications.receipt, { outboxId, check: check + 1 });
      } else {
        await ctx.db.patch(outboxId, { error: "ReceiptUnavailable", updatedAt: Date.now() });
      }
      return;
    }
    if (result.kind === "rejected" && result.error === "DeviceNotRegistered") await revokeRegistration(ctx, row);
    await ctx.db.patch(outboxId, {
      state: result.kind === "handed_off" ? "handed_off" : "failed",
      error: result.kind === "rejected" ? result.error : undefined, updatedAt: Date.now(),
    });
  },
});

export const receipt = internalAction({
  args: { outboxId: v.id("notificationOutbox"), check: v.number() },
  handler: async (ctx, { outboxId, check }): Promise<void> => {
    const ticketId = await ctx.runMutation(internal.notifications.receiptContext, { outboxId });
    if (!ticketId) return;
    const result = await getPushReceipt(ticketId, process.env.EXPO_ACCESS_TOKEN);
    await ctx.runMutation(internal.notifications.finishReceipt, { outboxId, check, result });
  },
});
