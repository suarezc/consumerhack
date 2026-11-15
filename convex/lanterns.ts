import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { readableDay, requireMember } from "./access";
import { bundleCents, matchLantern, requireSandbox, validateAmount, verifyPayment, type VerifiedPayment } from "./lib/payments";
import { ritualWindow } from "./questions";
import { ensureDay } from "./lifecycle";
import { ensureSackCause } from "./charity";
import { ensureMemberUser } from "./identity";
import { refreshClosedImpact } from "./impact";
import { queuePaidUserNotifications } from "./notifications";
import { assertExpectedRecipient, createDirectCheckout, ensureExampleSubaccount, sandboxDirectClient as client } from "./lib/whopDirect";

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
    if (!day || day.treeId !== args.treeId || !(await readableDay(ctx, day, member._id))) {
      throw new Error("Answer is not available");
    }
  }
  return member;
}

const paymentArgs = {
  paymentId: v.string(), checkoutId: v.string(), treeId: v.string(), memberId: v.string(),
  answerId: v.optional(v.string()), amountCents: v.number(), paidAt: v.optional(v.number()),
  userId: v.optional(v.string()), dayId: v.optional(v.string()), bundles: v.optional(v.number()), recipientAccountId: v.optional(v.string()),
};

export const wateringArgs = {
  deviceId: v.string(), treeId: v.id("trees"), dayId: v.optional(v.id("days")),
  bundles: v.union(v.literal(2), v.literal(5), v.literal(10)), answerId: v.optional(v.id("answers")),
};

export const prepareWatering = internalMutation({
  args: wateringArgs,
  handler: async (ctx, args) => {
    const amountCents = bundleCents(args.bundles);
    const member = await requireMember(ctx, args.treeId, args.deviceId);
    const tree = await ctx.db.get(args.treeId);
    if (!tree) throw new Error("Tree not found");
    const targetId = args.dayId ?? tree.demoDayId ?? await ensureDay(ctx, args.treeId);
    const day = await ctx.db.get(targetId);
    if (!day || day.treeId !== args.treeId || day.closedAt !== undefined || day.opensAt > Date.now() ||
        (tree.demoDayId ? day._id !== tree.demoDayId : day.isDemo || day.date !== ritualWindow(Date.now()).date) ||
        (day.isDemo && !day.ritualDate)) throw new Error("That watering day is not current");
    const answer = await ctx.db.query("answers").withIndex("by_day_member", q => q.eq("dayId", day._id).eq("memberId", member._id)).unique();
    if (!answer || (args.answerId && args.answerId !== answer._id)) throw new Error("Answer today's question before watering");
    const cause = await ctx.db.get(day.causeId ?? await ensureSackCause(ctx));
    if (!cause?.childAccountId) throw new Error("The example charity's sandbox account is not configured");
    if ((cause.applicationFeeCents ?? 0) !== 0) throw new Error("Platform fee is not approved");
    const userId = await ensureMemberUser(ctx, member);
    const wateringId = await ctx.db.insert("lanterns", { treeId: args.treeId, memberId: member._id, userId,
      dayId: day._id, answerId: answer._id, bundles: args.bundles, amountCents, attribution: "checkout_day",
      creditedDate: day.ritualDate ?? day.date, expectedRecipientAccountId: cause.childAccountId,
      applicationFeeCents: cause.applicationFeeCents ?? 0, status: "pending", whopCheckoutId: "", source: "whop",
      demoRunId: day.isDemo ? day._id : undefined, createdAt: Date.now() });
    return { wateringId, treeId: args.treeId, memberId: member._id, userId, dayId: day._id, answerId: answer._id,
      bundles: args.bundles, amountCents, expectedRecipientAccountId: cause.childAccountId, applicationFeeCents: cause.applicationFeeCents ?? 0 };
  },
});

export const attachCheckout = internalMutation({
  args: { wateringId: v.id("lanterns"), checkoutId: v.string() },
  handler: async (ctx, { wateringId, checkoutId }) => {
    const row = await ctx.db.get(wateringId);
    if (!row || row.status !== "pending" || row.attribution !== "checkout_day" || !checkoutId.startsWith("ch_")) throw new Error("Watering intent is not available");
    if (row.whopCheckoutId === checkoutId) return;
    if (row.whopCheckoutId) throw new Error("Watering already has a checkout");
    if (await ctx.db.query("lanterns").withIndex("by_checkout", q => q.eq("whopCheckoutId", checkoutId)).first()) throw new Error("Checkout already exists");
    await ctx.db.patch(wateringId, { whopCheckoutId: checkoutId });
  },
});

export const createWateringCheckout = internalAction({
  args: wateringArgs,
  handler: async (ctx, args): Promise<{ wateringId: Id<"lanterns">; checkoutUrl: string }> => {
    const whop = client();
    if (!process.env.WHOP_CHILD_WEBHOOK_SECRET) throw new Error("Child-account payment verification is not configured");
    const intent = await ctx.runMutation(internal.lanterns.prepareWatering, args);
    let configuration;
    try {
      if (intent.applicationFeeCents !== 0) throw new Error("Platform fee is not approved");
      configuration = await createDirectCheckout(whop, { recipientAccountId: intent.expectedRecipientAccountId,
        intentId: intent.wateringId, userId: intent.userId, dayId: intent.dayId, treeId: intent.treeId,
        memberId: intent.memberId, answerId: intent.answerId, bundles: intent.bundles, applicationFeeCents: 0,
      });
    } catch {
      throw new Error("Sandbox charity checkout is temporarily unavailable");
    }
    await ctx.runMutation(internal.lanterns.attachCheckout, { wateringId: intent.wateringId, checkoutId: configuration.checkoutId });
    return { wateringId: intent.wateringId, checkoutUrl: configuration.checkoutUrl };
  },
});

export const recordCauseAccount = internalMutation({
  args: { accountId: v.string(), applicationFeeCents: v.optional(v.number()) },
  handler: async (ctx, { accountId, applicationFeeCents }) => {
    requireSandbox(process.env.WHOP_ENVIRONMENT);
    if (!/^biz_[A-Za-z0-9]+$/.test(accountId) || (applicationFeeCents !== undefined && applicationFeeCents !== 0)) throw new Error("Invalid example charity account configuration");
    const causeId = await ensureSackCause(ctx);
    await ctx.db.patch(causeId, { childAccountId: accountId, applicationFeeCents: applicationFeeCents ?? 0 });
  },
});

export const configureExampleCause = internalAction({
  args: {},
  handler: async (ctx): Promise<{ accountId: string; applicationFeeCents: 0 }> => {
    const account = await ensureExampleSubaccount(client());
    await ctx.runMutation(internal.lanterns.recordCauseAccount, { accountId: account.accountId, applicationFeeCents: 0 });
    return { accountId: account.accountId, applicationFeeCents: 0 };
  },
});

async function missingPaidFacts(ctx: MutationCtx, row: Doc<"lanterns">, payment: VerifiedPayment) {
  if (row.source === "demo") throw new Error("Synthetic payment cannot be provider confirmed");
  matchLantern(row, payment);
  if (payment.paidAt !== undefined && (!Number.isFinite(payment.paidAt) || payment.paidAt <= 0 ||
      (row.paidAt !== undefined && row.paidAt !== payment.paidAt))) throw new Error("Conflicting provider timestamp");
  let date = payment.paidAt === undefined ? row.creditedDate : ritualWindow(payment.paidAt).date;
  let day = row.dayId ? await ctx.db.get(row.dayId) : null;
  if (row.attribution === "checkout_day") {
    if (!day || day.treeId !== row.treeId) throw new Error("Authorized watering day is not available");
    date = day.ritualDate ?? day.date;
  }
  if (row.creditedDate !== undefined && date !== undefined && row.creditedDate !== date) throw new Error("Conflicting credited date");
  if (!day && date) day = await ctx.db.query("days").withIndex("by_tree_date", q => q.eq("treeId", row.treeId).eq("date", date)).unique();
  const member = await ctx.db.get(row.memberId);
  const userId = row.userId ?? (member ? await ensureMemberUser(ctx, member) : undefined);
  const bundles = row.bundles ?? (payment.amountCents % 50 === 0 ? payment.amountCents / 50 : undefined);
  return {
    ...(row.paidAt === undefined ? { paidAt: payment.paidAt } : {}),
    ...(row.creditedDate === undefined ? { creditedDate: date } : {}),
    ...(row.source === undefined ? { source: "whop" as const } : {}),
    ...(row.userId === undefined && userId ? { userId } : {}),
    ...(row.dayId === undefined && day ? { dayId: day._id } : {}),
    ...(row.bundles === undefined && bundles !== undefined ? { bundles } : {}),
    ...(row.attribution === undefined ? { attribution: "provider_day" as const } : {}),
  };
}

async function fillPaidFacts(ctx: MutationCtx, row: Doc<"lanterns">, payment: VerifiedPayment) {
  const facts = await missingPaidFacts(ctx, row, payment);
  const changed = Object.values(facts).some(value => value !== undefined);
  if (!changed) return;
  await ctx.db.patch(row._id, facts);
  await refreshClosedImpact(ctx, row.dayId ?? facts.dayId);
  const member = await ctx.db.get(row.memberId);
  if (member && !member.isDemo) await queuePaidUserNotifications(ctx, member.deviceId);
}

export const checkoutContext = internalQuery({
  args: checkoutArgs,
  handler: async (ctx, args) => {
    const member = await authorizeCheckout(ctx, args);
    const tree = await ctx.db.get(args.treeId);
    return { memberId: member._id, demoRunId: tree?.demoDayId ?? null };
  },
});

export const recordPending = internalMutation({
  args: { ...checkoutArgs, checkoutId: v.string(), memberId: v.id("members"), demoRunId: v.optional(v.union(v.id("days"), v.null())) },
  handler: async (ctx, args) => {
    const member = await authorizeCheckout(ctx, args);
    if (member._id !== args.memberId) throw new Error("Membership changed during checkout");
    if (args.demoRunId) {
      const origin = await ctx.db.get(args.demoRunId);
      if (!origin?.isDemo || origin.treeId !== args.treeId) throw new Error("Invalid checkout demo context");
    }
    const existing = await ctx.db.query("lanterns").withIndex("by_checkout", q =>
      q.eq("whopCheckoutId", args.checkoutId)).first();
    if (existing) throw new Error("Checkout has already been recorded");
    return await ctx.db.insert("lanterns", {
      treeId: args.treeId,
      ...(args.answerId ? { answerId: args.answerId } : {}),
      memberId: member._id,
      amountCents: args.amountCents,
      status: "pending",
      whopCheckoutId: args.checkoutId,
      createdAt: Date.now(),
      source: "whop",
      demoRunId: args.demoRunId ?? undefined,
    });
  },
});

export const checkout = action({
  args: checkoutArgs,
  handler: async (ctx, args): Promise<{ lanternId: Id<"lanterns">; checkoutUrl: string }> => {
    const bundles = args.amountCents / 50;
    bundleCents(bundles);
    const result = await ctx.runAction(internal.lanterns.createWateringCheckout, {
      deviceId: args.deviceId, treeId: args.treeId, answerId: args.answerId, bundles: bundles as 2 | 5 | 10,
    });
    return { lanternId: result.wateringId, checkoutUrl: result.checkoutUrl };
  },
});

export const applyPayment = internalMutation({
  args: paymentArgs,
  handler: async (ctx, payment) => {
    requireSandbox(process.env.WHOP_ENVIRONMENT);
    const lantern = await ctx.db.query("lanterns").withIndex("by_checkout", q =>
      q.eq("whopCheckoutId", payment.checkoutId)).first();
    if (!lantern) throw new Error("Pending lantern not found");
    matchLantern(lantern, payment);
    const member = await ctx.db.get(lantern.memberId);
    if (!member || member.treeId !== lantern.treeId) throw new Error("Membership is not available");
    if (lantern.answerId) {
      const answer = await ctx.db.get(lantern.answerId);
      if (!answer || answer.treeId !== lantern.treeId) throw new Error("Answer is not available");
    }
    const matches = await ctx.db.query("lanterns").withIndex("by_payment", q =>
      q.eq("whopPaymentId", payment.paymentId)).collect();
    if (matches.length > 1) throw new Error("Duplicate provider payment requires reconciliation");
    const previous = matches[0];
    if (previous) {
      await fillPaidFacts(ctx, previous, payment);
      return null;
    }
    const basis = lantern.status === "paid" ? { ...lantern, paidAt: undefined, confirmedAt: undefined,
      ...(lantern.attribution === "checkout_day" ? {} : { dayId: undefined, creditedDate: undefined }) } : lantern;
    const facts = { ...await missingPaidFacts(ctx, basis, payment),
      ...(payment.paidAt === undefined ? {} : { confirmedAt: Date.now() }) };
    if (lantern.status === "pending") {
      await ctx.db.patch(lantern._id, { status: "paid", whopPaymentId: payment.paymentId, source: "whop", ...facts });
    } else {
      await ctx.db.insert("lanterns", {
        treeId: lantern.treeId,
        ...(lantern.answerId ? { answerId: lantern.answerId } : {}),
        memberId: lantern.memberId,
        userId: basis.userId,
        dayId: basis.dayId,
        bundles: basis.bundles,
        attribution: basis.attribution,
        expectedRecipientAccountId: lantern.expectedRecipientAccountId,
        applicationFeeCents: lantern.applicationFeeCents,
        creditedDate: basis.creditedDate,
        amountCents: lantern.amountCents,
        status: "paid",
        whopCheckoutId: payment.checkoutId,
        whopPaymentId: payment.paymentId,
        createdAt: Date.now(),
        source: "whop",
        demoRunId: lantern.demoRunId,
        ...facts,
      });
    }
    await refreshClosedImpact(ctx, basis.dayId ?? facts.dayId);
    if (!member.isDemo) await queuePaidUserNotifications(ctx, member.deviceId);
    return null;
  },
});

export const backfillPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("lanterns").paginate({ cursor, numItems: 25 });
    return { ...page, page: page.page.filter(row => row.status === "paid" && row.source !== "demo" && row.whopPaymentId &&
      (row.paidAt === undefined || row.creditedDate === undefined || row.source === undefined || row.userId === undefined || row.dayId === undefined ||
        (row.bundles === undefined && row.amountCents % 50 === 0)))
      .map(row => ({ rowId: row._id, paymentId: row.whopPaymentId!, expectedRecipientAccountId: row.expectedRecipientAccountId })) };
  },
});

export const backfillPaymentFacts = internalMutation({
  args: { ...paymentArgs, rowId: v.id("lanterns") },
  handler: async (ctx, { rowId, ...payment }) => {
    requireSandbox(process.env.WHOP_ENVIRONMENT);
    const row = await ctx.db.get(rowId);
    if (!row || row.status !== "paid" || row.whopPaymentId !== payment.paymentId) throw new Error("Historical paid row changed");
    const rows = await ctx.db.query("lanterns").withIndex("by_payment", q => q.eq("whopPaymentId", payment.paymentId)).collect();
    if (rows.length !== 1) throw new Error("Duplicate provider payment requires reconciliation");
    await fillPaidFacts(ctx, row, payment);
  },
});

export const backfillPaidDates = internalAction({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }): Promise<{ cursor: string; isDone: boolean; attempted: number; failed: number }> => {
    const whop = client();
    const account = await whop.accounts.me();
    const page = await ctx.runQuery(internal.lanterns.backfillPage, { cursor });
    let failed = 0;
    for (const row of page.page) {
      try {
        const payment = await whop.payments.retrieve({ id: row.paymentId });
        const expected = row.expectedRecipientAccountId ?? account.id;
        const verified = verifyPayment(payment, expected, { paymentId: row.paymentId, accountId: expected });
        if (verified.paidAt === undefined) { failed++; continue; }
        await ctx.runMutation(internal.lanterns.backfillPaymentFacts, { ...verified, rowId: row.rowId });
      } catch {
        failed++;
      }
    }
    return { cursor: page.continueCursor, isDone: page.isDone, attempted: page.page.length, failed };
  },
});

export const receivePayment = internalAction({
  args: { paymentId: v.string(), accountId: v.string(), child: v.optional(v.boolean()) },
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
    const context = await ctx.runQuery(internal.lanterns.paymentContext, { checkoutId: payment.checkout_configuration_id ?? "" });
    if (!context) throw new Error("Pending watering not found");
    const expected = context.expectedRecipientAccountId ?? account.id;
    if (event.child ? expected === account.id : expected !== account.id) throw new Error("Wrong payment webhook account scope");
    assertExpectedRecipient(payment, event, expected);
    await ctx.runMutation(internal.lanterns.applyPayment, verifyPayment(payment, expected, event));
    return null;
  },
});

export const paymentContext = internalQuery({
  args: { checkoutId: v.string() },
  handler: async (ctx, { checkoutId }) => {
    if (!checkoutId) return null;
    const row = await ctx.db.query("lanterns").withIndex("by_checkout", q => q.eq("whopCheckoutId", checkoutId)).first();
    return row ? { expectedRecipientAccountId: row.expectedRecipientAccountId } : null;
  },
});
