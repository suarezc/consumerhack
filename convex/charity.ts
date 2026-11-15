import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";

export const charityValue = v.object({
  name: v.string(), theme: v.string(), description: v.string(), link: v.string(), programs: v.array(v.string()),
});

export const sackCharity = {
  name: "S.A.C.K. (Simple Acts of Care and Kindness)",
  theme: "Youth mental health and kindness",
  description: "Building safer, kinder communities where children feel supported, connected and valued.",
  link: "https://simpleacts.org/",
  programs: ["A kindness anthology for K–12 students", "Parent talks", "Scholarships", "After-school programmes"],
};

export const wateringLabel = "Water today's tree for S.A.C.K.";

export async function ensureSackCause(ctx: MutationCtx) {
  const existing = await ctx.db.query("causes").withIndex("by_key", q => q.eq("key", "cause_sack")).unique();
  return existing?._id ?? await ctx.db.insert("causes", { key: "cause_sack", charity: sackCharity });
}
