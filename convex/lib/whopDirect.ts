import { WhopClient, WhopEnvironment } from "@whop/sdk";
import { paymentEvent, requireSandbox, sandboxCheckoutUrl, WHOP_API_VERSION } from "./payments";

export const EXAMPLE_CAUSE_EXTERNAL_ID = "cause_sack";
export const DIRECT_WATERING_INTEGRATION = "storytime-watering-sandbox-v2";
export const CHILD_WEBHOOK_URL = "https://gallant-warbler-923.convex.site/whop/children";

export function sandboxDirectClient() {
  requireSandbox(process.env.WHOP_ENVIRONMENT);
  if (!process.env.WHOP_API_KEY) throw new Error("Sandbox payments are not configured");
  return new WhopClient({
    token: process.env.WHOP_API_KEY,
    environment: WhopEnvironment.Sandbox,
    apiVersionDate: WHOP_API_VERSION,
    timeoutInSeconds: 3,
    maxRetries: 0,
  });
}

function accountId(value: unknown): string {
  if (typeof value !== "string" || !/^biz_[A-Za-z0-9]+$/.test(value)) {
    throw new Error("Invalid expected payment recipient");
  }
  return value;
}

export async function ensureExampleSubaccount(client: WhopClient, approvedOwnerEmail?: string) {
  requireSandbox(process.env.WHOP_ENVIRONMENT);
  const parent = await client.accounts.me();
  const parentId = accountId(parent.id);
  const lookup = async () => {
    const page = await client.accounts.list({
      parent_account_id: parentId, external_id: EXAMPLE_CAUSE_EXTERNAL_ID, first: 2,
    });
    const matches = [];
    for await (const account of page) {
      if (account.external_id === EXAMPLE_CAUSE_EXTERNAL_ID) matches.push(account);
      if (matches.length > 1) throw new Error("Ambiguous example charity account");
    }
    return matches[0];
  };
  let child = await lookup();
  let created = false;
  if (!child) {
    if (!approvedOwnerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(approvedOwnerEmail)) {
      throw new Error("An approved sandbox owner email is required; owner notifications may be sent");
    }
    try {
      child = await client.accounts.create({
        title: "S.A.C.K. (example)",
        external_id: EXAMPLE_CAUSE_EXTERNAL_ID,
        email: approvedOwnerEmail,
        send_customer_emails: false,
      }, { idempotencyKey: `storytime:${parentId}:cause_sack:v1` });
      created = true;
    } catch (error) {
      if (!error || typeof error !== "object" || !("statusCode" in error) || error.statusCode !== 409) throw error;
      child = await lookup();
      if (!child) throw new Error("Example charity account conflict requires reconciliation");
    }
  }
  if (child.parent_account?.id !== parentId || child.external_id !== EXAMPLE_CAUSE_EXTERNAL_ID ||
      child.title !== "S.A.C.K. (example)" || child.id === parentId) {
    throw new Error("Example charity account does not match its platform binding");
  }
  return { accountId: accountId(child.id), platformAccountId: parentId, created };
}

export type DirectCheckoutInput = {
  recipientAccountId: string;
  intentId: string;
  userId: string;
  dayId: string;
  treeId: string;
  memberId: string;
  answerId?: string;
  bundles: 2 | 5 | 10;
  applicationFeeCents: 0 | 1;
};

export async function createDirectCheckout(client: WhopClient, input: DirectCheckoutInput) {
  requireSandbox(process.env.WHOP_ENVIRONMENT);
  const recipient = accountId(input.recipientAccountId);
  if (![2, 5, 10].includes(input.bundles) || ![0, 1].includes(input.applicationFeeCents)) {
    throw new Error("Unsupported watering bundles or platform fee");
  }
  for (const value of [input.intentId, input.userId, input.dayId, input.treeId, input.memberId, input.answerId ?? "absent"]) {
    if (typeof value !== "string" || !value.trim() || value.length > 256) throw new Error("Invalid watering binding");
  }
  const amountCents = input.bundles * 50;
  const configuration = await client.checkoutConfigurations.create({
    account_id: recipient,
    variant: {
      title: "Water S.A.C.K. (example)",
      billing_type: "one_time",
      initial_price: amountCents / 100,
      currency: "usd",
      ...(input.applicationFeeCents === 1 ? { application_fee_amount: 0.01 } : {}),
    },
    metadata: {
      integration: DIRECT_WATERING_INTEGRATION,
      intentId: input.intentId,
      userId: input.userId,
      dayId: input.dayId,
      bundles: input.bundles,
      treeId: input.treeId,
      memberId: input.memberId,
      ...(input.answerId ? { answerId: input.answerId } : {}),
    },
  }, { idempotencyKey: `storytime:watering:${input.intentId}` });
  if (configuration.account_id !== recipient || !/^ch_[A-Za-z0-9]+$/.test(configuration.id)) {
    throw new Error("Checkout recipient does not match the authorized intent");
  }
  return { checkoutId: configuration.id, checkoutUrl: sandboxCheckoutUrl(configuration.purchase_url) };
}

export function assertExpectedRecipient(
  payment: { id?: unknown; account_id?: unknown },
  event: { paymentId: string; accountId: string },
  expectedRecipientAccountId: string,
) {
  const recipient = accountId(expectedRecipientAccountId);
  if (payment.id !== event.paymentId || payment.account_id !== recipient || event.accountId !== recipient) {
    throw new Error("Payment recipient does not match the immutable intent");
  }
}

export async function retrieveRecipientPayment(
  client: WhopClient,
  event: { paymentId: string; accountId: string },
  expectedRecipientAccountId: string,
) {
  requireSandbox(process.env.WHOP_ENVIRONMENT);
  if (event.accountId !== accountId(expectedRecipientAccountId) || !/^pay_[A-Za-z0-9]+$/.test(event.paymentId)) {
    throw new Error("Payment event does not match the immutable intent recipient");
  }
  const payment = await client.payments.retrieve({ id: event.paymentId });
  assertExpectedRecipient(payment, event, expectedRecipientAccountId);
  return payment;
}

export function signedPaymentEvent(raw: string, headers: Record<string, string>, secret: string) {
  requireSandbox(process.env.WHOP_ENVIRONMENT);
  return paymentEvent(raw, headers, secret);
}

export async function ensureChildWebhook(client: WhopClient) {
  requireSandbox(process.env.WHOP_ENVIRONMENT);
  const parentId = accountId((await client.accounts.me()).id);
  const page = await client.webhooks.list({ account_id: parentId, first: 100 });
  const matches = [];
  for await (const hook of page) {
    if (hook.url === CHILD_WEBHOOK_URL) matches.push(hook);
    if (matches.length > 1) throw new Error("Ambiguous child webhook configuration");
  }
  let hook = matches[0];
  const created = !hook;
  if (!hook) {
    hook = await client.webhooks.create({
      url: CHILD_WEBHOOK_URL,
      resource_id: parentId,
      title: "StoryTime sandbox child payments",
      events: ["payment.succeeded"],
      child_resource_events: true,
      api_version_date: WHOP_API_VERSION,
      enabled: true,
    }, { idempotencyKey: `storytime:${parentId}:child-webhook:v1` });
  }
  if (hook.resource_id !== parentId || !hook.child_resource_events || !hook.enabled ||
      hook.api_version !== "v1" || hook.api_version_date !== WHOP_API_VERSION ||
      hook.events.length !== 1 || hook.events[0] !== "payment.succeeded") {
    throw new Error("Child webhook does not match the approved subscription");
  }
  return { webhookId: hook.id, signingSecret: hook.webhook_secret, created };
}
