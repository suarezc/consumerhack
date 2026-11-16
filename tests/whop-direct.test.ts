import type { WhopClient } from "@whop/sdk";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  assertExpectedRecipient, CHILD_WEBHOOK_URL, createDirectCheckout, DIRECT_WATERING_INTEGRATION,
  ensureChildWebhook, ensureExampleSubaccount, retrieveRecipientPayment, sandboxDirectClient, signedPaymentEvent,
  type DirectCheckoutInput,
} from "../convex/lib/whopDirect";

const parent = { id: "biz_parent" };
const child = { id: "biz_child", parent_account: parent, title: "S.A.C.K. (example)", external_id: "cause_sack" };
const input: DirectCheckoutInput = {
  recipientAccountId: child.id, intentId: "opaque-intent", userId: "opaque-user", dayId: "day-id",
  treeId: "tree-id", memberId: "member-id", bundles: 5, applicationFeeCents: 0,
};
const hook = {
  id: "hook_child", resource_id: parent.id, url: CHILD_WEBHOOK_URL, child_resource_events: true,
  enabled: true, api_version: "v1", api_version_date: "2026-11-04-1", events: ["payment.succeeded"], webhook_secret: null,
};

function page<T>(data: T[]) {
  return { data, async *[Symbol.asyncIterator]() { yield* data; } };
}

function fixture() {
  const methods = {
    accounts: {
      me: vi.fn(async () => parent),
      list: vi.fn(async () => page([child])),
      create: vi.fn(async () => child),
    },
    checkoutConfigurations: {
      create: vi.fn(async () => ({ id: "ch_test", account_id: child.id, purchase_url: "https://sandbox.whop.com/checkout/ch_test/" })),
    },
    payments: { retrieve: vi.fn(async () => ({ id: "pay_test", account_id: child.id, status: "paid" })) },
    webhooks: {
      list: vi.fn(async () => page([hook])),
      create: vi.fn(async () => ({ ...hook, webhook_secret: "ws_simulated_test" })),
      update: vi.fn(),
    },
  };
  return { methods, client: methods as unknown as WhopClient };
}

beforeEach(() => { vi.stubEnv("WHOP_ENVIRONMENT", "sandbox"); });
afterEach(() => { vi.unstubAllEnvs(); });

it("reuses the exact platform child without an email or account mutation", async () => {
  const { client, methods } = fixture();
  expect(await ensureExampleSubaccount(client)).toEqual({ accountId: child.id, platformAccountId: parent.id, created: false });
  expect(methods.accounts.list).toHaveBeenCalledWith({ parent_account_id: parent.id, external_id: "cause_sack", first: 2 });
  expect(methods.accounts.create).not.toHaveBeenCalled();
});

it("requires an approved owner email before creating and disables buyer emails without requesting onboarding", async () => {
  const { client, methods } = fixture();
  methods.accounts.list.mockResolvedValue(page([]));
  await expect(ensureExampleSubaccount(client)).rejects.toThrow("approved sandbox owner email");
  expect(methods.accounts.create).not.toHaveBeenCalled();
  await ensureExampleSubaccount(client, "approved-owner@example.test");
  expect(methods.accounts.create).toHaveBeenCalledWith({
    title: "S.A.C.K. (example)", external_id: "cause_sack", email: "approved-owner@example.test", send_customer_emails: false,
  }, { idempotencyKey: "storytime:biz_parent:cause_sack:v1" });
});

it("rejects foreign, parent or ambiguous account bindings", async () => {
  for (const account of [{ ...child, parent_account: { id: "biz_foreign" } }, { ...child, id: parent.id }, { ...child, title: "Other" }]) {
    const { client, methods } = fixture();
    methods.accounts.list.mockResolvedValue(page([account]));
    await expect(ensureExampleSubaccount(client)).rejects.toThrow();
    expect(methods.accounts.create).not.toHaveBeenCalled();
  }
  const { client, methods } = fixture();
  methods.accounts.list.mockResolvedValue(page([child, { ...child, id: "biz_duplicate" }]));
  await expect(ensureExampleSubaccount(client)).rejects.toThrow("Ambiguous");
});

it("reconciles a concurrent external-ID conflict without reassigning ownership", async () => {
  const { client, methods } = fixture();
  methods.accounts.list.mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([child]));
  methods.accounts.create.mockRejectedValueOnce({ statusCode: 409 });
  expect((await ensureExampleSubaccount(client, "approved-owner@example.test")).created).toBe(false);
  expect(methods.accounts.create).toHaveBeenCalledTimes(1);
});

it("uses only preset gross bundle prices, pins the recipient, and omits a zero application fee", async () => {
  for (const bundles of [2, 5, 10] as const) {
    const { client, methods } = fixture();
    await createDirectCheckout(client, { ...input, bundles });
    const [request, options] = methods.checkoutConfigurations.create.mock.calls[0] as unknown as [{ account_id: string; variant: Record<string, unknown>; metadata: Record<string, unknown> }, unknown];
    expect(request.account_id).toBe(child.id);
    expect(request.variant).toEqual({ title: "Water S.A.C.K. (example)", billing_type: "one_time", initial_price: bundles * 0.5, currency: "usd" });
    expect(request.metadata).toEqual({ integration: DIRECT_WATERING_INTEGRATION, intentId: input.intentId,
      userId: input.userId, dayId: input.dayId, bundles, treeId: input.treeId, memberId: input.memberId });
    expect(options).toEqual({ idempotencyKey: "storytime:watering:opaque-intent" });
  }
});

it("uses exactly one cent only when explicitly selected; never falls back after a provider error", async () => {
  const { client, methods } = fixture();
  await createDirectCheckout(client, { ...input, applicationFeeCents: 1 });
  const [request] = methods.checkoutConfigurations.create.mock.calls[0] as unknown as [{ variant: Record<string, unknown> }];
  expect(request.variant.application_fee_amount).toBe(0.01);
  methods.checkoutConfigurations.create.mockClear().mockRejectedValueOnce(new Error("unrelated provider error"));
  await expect(createDirectCheckout(client, input)).rejects.toThrow("unrelated");
  expect(methods.checkoutConfigurations.create).toHaveBeenCalledTimes(1);
  for (const change of [{ bundles: 101 }, { applicationFeeCents: 2 }, { userId: "" }, { recipientAccountId: "invalid" }]) {
    await expect(createDirectCheckout(client, { ...input, ...change } as DirectCheckoutInput)).rejects.toThrow();
  }
});

it("rejects a checkout response for another recipient or a live-money URL", async () => {
  for (const change of [{ account_id: parent.id }, { purchase_url: "https://whop.com/checkout/ch_test/" }]) {
    const { client, methods } = fixture();
    methods.checkoutConfigurations.create.mockResolvedValue({ id: "ch_test", account_id: child.id, purchase_url: "https://sandbox.whop.com/checkout/ch_test/", ...change });
    await expect(createDirectCheckout(client, input)).rejects.toThrow();
  }
});

it("binds retrieved payments to the immutable recipient for children and legacy parent intents", async () => {
  const { client, methods } = fixture();
  const event = { paymentId: "pay_test", accountId: child.id };
  await retrieveRecipientPayment(client, event, child.id);
  await expect(retrieveRecipientPayment(client, event, parent.id)).rejects.toThrow("immutable");
  expect(methods.payments.retrieve).toHaveBeenCalledTimes(1);
  methods.payments.retrieve.mockResolvedValue({ id: "pay_test", account_id: parent.id, status: "paid" });
  await expect(retrieveRecipientPayment(client, event, child.id)).rejects.toThrow("immutable");
  await retrieveRecipientPayment(client, { ...event, accountId: parent.id }, parent.id);
  expect(() => assertExpectedRecipient({ id: "pay_other", account_id: child.id }, event, child.id)).toThrow();
  expect(() => assertExpectedRecipient({ id: event.paymentId, account_id: "biz_otherOwnedChild" }, event, child.id)).toThrow();
});

async function signed(raw: string, secret: string, timestamp: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`msg_test.${timestamp}.${raw}`));
  return { "webhook-id": "msg_test", "webhook-timestamp": String(timestamp),
    "webhook-signature": `v1,${btoa(String.fromCharCode(...new Uint8Array(signature)))}` };
}

it("verifies child signatures separately, rejects tampering/staleness and preserves replay identity", async () => {
  const raw = JSON.stringify({ id: "msg_test", type: "payment.succeeded", account_id: child.id, data: { id: "pay_test" } });
  const headers = await signed(raw, "ws_child_test", Math.floor(Date.now() / 1000));
  const event = signedPaymentEvent(raw, headers, "ws_child_test");
  expect(event).toEqual({ paymentId: "pay_test", accountId: child.id });
  expect(signedPaymentEvent(raw, headers, "ws_child_test")).toEqual(event);
  expect(() => signedPaymentEvent(`${raw} `, headers, "ws_child_test")).toThrow();
  expect(() => signedPaymentEvent(raw, headers, "ws_parent_test")).toThrow();
  expect(() => signedPaymentEvent(raw, headers, "")).toThrow();
  const stale = await signed(raw, "ws_child_test", Math.floor(Date.now() / 1000) - 600);
  expect(() => signedPaymentEvent(raw, stale, "ws_child_test")).toThrow();
});

it("creates separate child-only coverage without mutating the parent's subscription", async () => {
  const { client, methods } = fixture();
  methods.webhooks.list.mockResolvedValue(page([{ ...hook, id: "hook_parent", url: "https://gallant-warbler-923.convex.site/whop", child_resource_events: false }]));
  const result = await ensureChildWebhook(client);
  expect(result.created).toBe(true);
  expect(methods.webhooks.create).toHaveBeenCalledWith({
    url: CHILD_WEBHOOK_URL, resource_id: parent.id, title: "StoryTime sandbox child payments", events: ["payment.succeeded"],
    child_resource_events: true, api_version_date: "2026-11-04-1", enabled: true,
  }, { idempotencyKey: "storytime:biz_parent:child-webhook:v1" });
  expect(methods.webhooks.update).not.toHaveBeenCalled();
});

it("reuses exact child coverage without inventing a missing signing secret", async () => {
  const { client, methods } = fixture();
  expect(await ensureChildWebhook(client)).toEqual({ webhookId: hook.id, signingSecret: null, created: false });
  expect(methods.webhooks.create).not.toHaveBeenCalled();
  for (const change of [{ child_resource_events: false }, { resource_id: "biz_foreign" }, { enabled: false }, { api_version_date: null }]) {
    methods.webhooks.list.mockResolvedValue(page([{ ...hook, ...change }] as typeof hook[]));
    await expect(ensureChildWebhook(client)).rejects.toThrow("approved subscription");
  }
});

it("fails closed outside explicitly configured sandbox mode", async () => {
  vi.stubEnv("WHOP_ENVIRONMENT", "production");
  expect(() => sandboxDirectClient()).toThrow("Sandbox");
  await expect(createDirectCheckout(fixture().client, input)).rejects.toThrow("Sandbox");
  await expect(ensureExampleSubaccount(fixture().client)).rejects.toThrow("Sandbox");
  await expect(ensureChildWebhook(fixture().client)).rejects.toThrow("Sandbox");
});
