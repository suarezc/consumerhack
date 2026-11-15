import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  notificationPreferences: defineTable({
    deviceId: v.string(),
    optIn: v.boolean(),
    permission: v.union(v.literal("granted"), v.literal("denied"), v.literal("undetermined")),
    token: v.optional(v.string()),
    revision: v.number(),
    updatedAt: v.number(),
  }).index("by_device", ["deviceId"]).index("by_token", ["token"]),

  notificationOutbox: defineTable({
    deviceId: v.string(),
    date: v.string(),
    dayId: v.id("days"),
    state: v.union(v.literal("queued"), v.literal("dispatching"), v.literal("accepted"), v.literal("handed_off"), v.literal("failed"), v.literal("unknown"), v.literal("suppressed")),
    attempt: v.number(),
    preferenceRevision: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    ticketId: v.optional(v.string()),
    error: v.optional(v.string()),
  }).index("by_device_date", ["deviceId", "date"]),

  trees: defineTable({
    name: v.string(),
    code: v.string(),
    hostDeviceId: v.string(),
    cause: v.optional(v.object({ name: v.string(), goalCents: v.optional(v.number()) })),
    createdAt: v.number(),
    demoDayId: v.optional(v.id("days")),
  }).index("by_code", ["code"]),

  members: defineTable({
    treeId: v.id("trees"),
    deviceId: v.string(),
    name: v.string(),
    joinedAt: v.number(),
    isDemo: v.optional(v.boolean()),
  })
    .index("by_tree", ["treeId"])
    .index("by_device", ["deviceId"])
    .index("by_tree_device", ["treeId", "deviceId"]),

  days: defineTable({
    treeId: v.id("trees"),
    date: v.string(),
    question: v.string(),
    opensAt: v.number(),
    bloomAt: v.number(),
    bloomedAt: v.optional(v.number()),
    isDemo: v.optional(v.boolean()),
    demoRunId: v.optional(v.id("days")),
    ritualDate: v.optional(v.string()),
    judgeQueuedAt: v.optional(v.number()),
  })
    .index("by_tree_date", ["treeId", "date"])
    .index("by_tree", ["treeId"]),

  answers: defineTable({
    dayId: v.id("days"),
    treeId: v.id("trees"),
    memberId: v.id("members"),
    text: v.string(),
    blossom: v.number(),
    createdAt: v.number(),
    mood: v.optional(v.number()),
    embedding: v.optional(v.array(v.float64())),
  })
    .index("by_day", ["dayId"])
    .index("by_member", ["memberId"])
    .index("by_day_member", ["dayId", "memberId"])
    .vectorIndex("by_embedding", { vectorField: "embedding", dimensions: 1536, filterFields: ["dayId", "treeId"] }),

  kindred: defineTable({
    answerId: v.id("answers"),
    matches: v.array(v.object({ answerId: v.id("answers"), reason: v.string() })),
  }).index("by_answer", ["answerId"]),

  notes: defineTable({
    answerId: v.id("answers"),
    fromMemberId: v.id("members"),
    text: v.string(),
    createdAt: v.number(),
  })
    .index("by_answer", ["answerId"])
    .index("by_from", ["fromMemberId"]),

  lanterns: defineTable({
    treeId: v.id("trees"),
    answerId: v.optional(v.id("answers")),
    memberId: v.id("members"),
    amountCents: v.number(),
    status: v.union(v.literal("pending"), v.literal("paid")),
    whopCheckoutId: v.string(),
    whopPaymentId: v.optional(v.string()),
    createdAt: v.number(),
    paidAt: v.optional(v.number()),
    creditedDate: v.optional(v.string()),
    source: v.optional(v.union(v.literal("whop"), v.literal("demo"))),
    demoRunId: v.optional(v.id("days")),
  })
    .index("by_tree", ["treeId"])
    .index("by_member", ["memberId"])
    .index("by_payment", ["whopPaymentId"])
    .index("by_checkout", ["whopCheckoutId"]),
});
