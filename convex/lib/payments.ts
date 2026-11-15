import { unwrapWebhook } from "@whop/sdk/helpers";

export const WHOP_API_VERSION = "2026-11-04-1";

export function requireSandbox(environment: string | undefined) {
  if (environment !== "sandbox") throw new Error("Sandbox payments are not configured");
}

export function validateAmount(amountCents: number) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents % 50 !== 0 || amountCents > 10_000) {
    throw new Error("Choose an amount from $0.50 to $100 in $0.50 increments");
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid payment data");
  }
  return value as Record<string, unknown>;
}

function identifier(value: unknown, prefix: string) {
  if (typeof value !== "string" || !value.startsWith(prefix) || value.length <= prefix.length) {
    throw new Error("Invalid payment identifier");
  }
  return value;
}

export function paymentEvent(raw: string, headers: Record<string, string>, secret: string) {
  const event = object(unwrapWebhook<unknown>(raw, { headers, key: secret }));
  if (event.type !== "payment.succeeded") return null;
  if (event.id !== headers["webhook-id"]) throw new Error("Mismatched webhook identity");
  return {
    paymentId: identifier(object(event.data).id, "pay_"),
    accountId: identifier(event.account_id, "biz_"),
  };
}

function usdCents(value: unknown) {
  const money = object(value);
  if (money.currency !== "usd" || money.decimals !== 2 ||
      typeof money.amount !== "string" || !/^\d+(\.\d{1,2})?$/.test(money.amount)) {
    throw new Error("Invalid USD payment amount");
  }
  const [dollars, cents = ""] = money.amount.split(".");
  const amountCents = Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new Error("Invalid USD payment amount");
  return amountCents;
}

export type VerifiedPayment = {
  paymentId: string;
  checkoutId: string;
  treeId: string;
  memberId: string;
  answerId?: string;
  amountCents: number;
  paidAt?: number;
};

export function verifyPayment(
  value: unknown,
  accountId: string,
  event: { paymentId: string; accountId: string },
): VerifiedPayment {
  const payment = object(value);
  if (payment.id !== event.paymentId || event.accountId !== accountId ||
      payment.account_id !== accountId || payment.status !== "paid" || payment.currency !== "usd") {
    throw new Error("Payment has not been verified");
  }
  const amountCents = usdCents(payment.subtotal);
  if (amountCents < 1 || amountCents > 10_000) throw new Error("Invalid contribution amount");
  const taxCents = payment.tax_amount == null ? 0 : usdCents(payment.tax_amount);
  if (taxCents > 0 && payment.tax_behavior !== "exclusive" && payment.tax_behavior !== "inclusive") {
    throw new Error("Payment tax behavior is not supported");
  }
  const expectedTotal = amountCents + (payment.tax_behavior === "exclusive" ? taxCents : 0);
  if (usdCents(payment.total) !== expectedTotal || taxCents > amountCents) {
    throw new Error("Payment total does not match price and tax");
  }
  const metadata = object(payment.metadata);
  if (metadata.integration !== "storytime-lantern-sandbox" ||
      typeof metadata.treeId !== "string" || typeof metadata.memberId !== "string" ||
      (metadata.answerId !== undefined && typeof metadata.answerId !== "string")) {
    throw new Error("Payment is not a StoryTime lantern");
  }
  const paidAt = payment.paid_at == null ? undefined :
    typeof payment.paid_at === "string" && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(payment.paid_at) ? Date.parse(payment.paid_at) : NaN;
  if (paidAt !== undefined && (!Number.isFinite(paidAt) || paidAt <= 0)) throw new Error("Invalid provider paid timestamp");
  return {
    paymentId: identifier(payment.id, "pay_"),
    checkoutId: identifier(payment.checkout_configuration_id, "ch_"),
    treeId: metadata.treeId,
    memberId: metadata.memberId,
    ...(metadata.answerId === undefined ? {} : { answerId: metadata.answerId }),
    amountCents,
    ...(paidAt === undefined ? {} : { paidAt }),
  };
}

export function matchLantern(
  lantern: { treeId: string; memberId: string; answerId?: string; amountCents: number;
    whopCheckoutId: string; status: "pending" | "paid"; whopPaymentId?: string },
  payment: VerifiedPayment,
) {
  if (lantern.whopCheckoutId !== payment.checkoutId || lantern.treeId !== payment.treeId ||
      lantern.memberId !== payment.memberId || lantern.answerId !== payment.answerId ||
      lantern.amountCents !== payment.amountCents) {
    throw new Error("Payment does not match the pending lantern");
  }
  return lantern.whopPaymentId !== payment.paymentId;
}

export function sandboxCheckoutUrl(value: string | null | undefined) {
  const url = new URL(value ?? "");
  if (url.protocol !== "https:" || url.hostname !== "sandbox.whop.com" ||
      url.username || url.password || url.port || !url.pathname.startsWith("/checkout/")) {
    throw new Error("Whop did not return a sandbox checkout");
  }
  return url.toString();
}
