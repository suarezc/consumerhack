import { WhopClient, WhopEnvironment } from "@whop/sdk";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireMember } from "./access";
import { matchLantern, requireSandbox, sandboxCheckoutUrl, validateAmount, verifyPayment, WHOP_API_VERSION } from "./lib/payments";

const checkoutArgs = {
  deviceId: v.string(),
  treeId: v.id("trees"),
  answerId: v.optional(v.id("answers")),
  amountCents: v.number(),
};

async function authorizeCheckout(ctx: QueryCtx | MutationCtx, args: {
  deviceId: string; treeId: Id<"trees">; answerId?: Id<"answers">; amountCents: number;
}) {
  validateAmount(args.amountCents);
  const member = await requireMember(ctx, args.treeId, args.deviceId);
  const tree = await ctx.db.get(args.treeId);
  if (!tree?.cause) throw new Error("This tree has not chosen a cause");
  if (args.answerId) {
    const answer = await ctx.db.get(args.answerId);
    if (!answer || answer.treeId !== args.treeId) throw new Error("Answer is not available");
    const day = await ctx.db.get(answer.dayId);
    const mine = await ctx.db.query("answers").withIndex("by_day_member", q =>
      q.eq("dayId", answer.dayId).eq("memberId", member._id)).unique();
    if (!day?.bloomedAt || !mine || (day.isDemo && tree.demoDayId !== day._id)) {
      throw new Error("Answer is not available");
    }
  }
  return member;
}

function client() {
  requireSandbox(process.env.WHOP_ENVIRONMENT);
  const token = process.env.WHOP_API_KEY;
  if (!token) throw new Error("Sandbox payments are not configured");
  return new WhopClient({
    token,
    environment: WhopEnvironment.Sandbox,
    apiVersionDate: WHOP_API_VERSION,
    timeoutInSeconds: 3,
    maxRetries: 0,
  });
}

export const checkoutContext = internalQuery({
  args: checkoutArgs,
  handler: async (ctx, args) => ({ memberId: (await authorizeCheckout(ctx, args))._id }),
});

export const recordPending = internalMutation({
  args: { ...checkoutArgs, checkoutId: v.string(), memberId: v.id("members") },
  handler: async (ctx, args) => {
    const member = await authorizeCheckout(ctx, args);
    if (member._id !== args.memberId) throw new Error("Membership changed during checkout");
    const existing = await ctx.db.query("lanterns").withIndex("by_checkout", q =>
      q.eq("whopCheckoutId", args.checkoutId)).unique();
    if (existing) throw new Error("Checkout has already been recorded");
    return await ctx.db.insert("lanterns", {
      treeId: args.treeId,
      ...(args.answerId ? { answerId: args.answerId } : {}),
      memberId: member._id,
      amountCents: args.amountCents,
      status: "pending",
      whopCheckoutId: args.checkoutId,
      createdAt: Date.now(),
    });
  },
});

export const checkout = action({
  args: checkoutArgs,
  handler: async (ctx, args): Promise<{ lanternId: Id<"lanterns">; checkoutUrl: string }> => {
    const whop = client();
    if (!process.env.WHOP_WEBHOOK_SECRET) throw new Error("Sandbox payment verification is not configured");
    const { memberId } = await ctx.runQuery(internal.lanterns.checkoutContext, args);
    let configuration;
    try {
      configuration = await whop.checkoutConfigurations.create({
        variant: {
          title: "StoryTime lantern",
          billing_type: "one_time",
          initial_price: args.amountCents / 100,
          currency: "usd",
        },
        metadata: {
          integration: "storytime-lantern-sandbox",
          treeId: args.treeId,
          memberId,
          ...(args.answerId ? { answerId: args.answerId } : {}),
        },
      });
    } catch {
      throw new Error("Sandbox checkout is temporarily unavailable");
    }
    const checkoutUrl = sandboxCheckoutUrl(configuration.purchase_url);
    const lanternId = await ctx.runMutation(internal.lanterns.recordPending, {
      ...args, memberId, checkoutId: configuration.id,
    });
    return { lanternId, checkoutUrl };
  },
});

export const applyPayment = internalMutation({
  args: {
    paymentId: v.string(), checkoutId: v.string(), treeId: v.string(), memberId: v.string(),
    answerId: v.optional(v.string()), amountCents: v.number(),
  },
  handler: async (ctx, payment) => {
    requireSandbox(process.env.WHOP_ENVIRONMENT);
    const lantern = await ctx.db.query("lanterns").withIndex("by_checkout", q =>
      q.eq("whopCheckoutId", payment.checkoutId)).unique();
    if (!lantern) throw new Error("Pending lantern not found");
    if (!matchLantern(lantern, payment)) return null;
    const member = await ctx.db.get(lantern.memberId);
    if (!member || member.treeId !== lantern.treeId) throw new Error("Membership is not available");
    if (lantern.answerId) {
      const answer = await ctx.db.get(lantern.answerId);
      if (!answer || answer.treeId !== lantern.treeId) throw new Error("Answer is not available");
    }
    const previous = await ctx.db.query("lanterns").filter(q =>
      q.eq(q.field("whopPaymentId"), payment.paymentId)).first();
    if (previous) throw new Error("Payment has already been used");
    await ctx.db.patch(lantern._id, { status: "paid", whopPaymentId: payment.paymentId });
    return null;
  },
});

export const receivePayment = internalAction({
  args: { paymentId: v.string(), accountId: v.string() },
  handler: async (ctx, event) => {
    const whop = client();
    let payment;
    let account;
    try {
      [payment, account] = await Promise.all([
        whop.payments.retrieve({ id: event.paymentId }),
        whop.accounts.me(),
      ]);
    } catch {
      throw new Error("Sandbox payment verification is temporarily unavailable");
    }
    await ctx.runMutation(internal.lanterns.applyPayment, verifyPayment(payment, account.id, event));
    return null;
  },
});
