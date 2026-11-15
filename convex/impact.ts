import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { personKey } from "./identity";
import { paidForDay } from "./lib/wateringFacts";

export async function dayImpact(ctx: QueryCtx | MutationCtx, day: Doc<"days">, viewer?: Doc<"members">) {
  const answers = await ctx.db.query("answers").withIndex("by_day", q => q.eq("dayId", day._id)).collect();
  const rows = (await ctx.db.query("lanterns").withIndex("by_tree", q => q.eq("treeId", day.treeId)).collect())
    .filter(row => paidForDay(row, day));
  const answerers = new Set<string>();
  const waterers = new Set<string>();
  for (const answer of answers) answerers.add(answer.userId ?? await personKey(ctx, answer.memberId));
  const viewerKey = viewer ? await personKey(ctx, viewer._id) : null;
  let totalRaisedCents = 0;
  let myGivenCents = 0;
  for (const row of rows) {
    const key = row.userId ?? await personKey(ctx, row.memberId);
    waterers.add(key);
    totalRaisedCents += row.amountCents;
    if (key === viewerKey) myGivenCents += row.amountCents;
  }
  return { totalRaisedCents, answererCount: answerers.size, watererCount: waterers.size, myGivenCents };
}

export async function refreshClosedImpact(ctx: MutationCtx, dayId: Id<"days"> | undefined) {
  if (!dayId) return;
  const day = await ctx.db.get(dayId);
  if (!day || day.closedAt === undefined) return;
  const { myGivenCents: _, ...impact } = await dayImpact(ctx, day);
  await ctx.db.patch(dayId, { impact: { ...impact, updatedAt: Date.now() } });
}

export async function closeDay(ctx: MutationCtx, day: Doc<"days">, now = Date.now()) {
  if (day.isDemo || day.closedAt !== undefined || now < day.opensAt + 86_400_000) return;
  const { myGivenCents: _, ...impact } = await dayImpact(ctx, day);
  await ctx.db.patch(day._id, { closedAt: now, impact: { ...impact, updatedAt: now } });
}
