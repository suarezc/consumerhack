import { strict as assert } from "node:assert";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { matchLantern, paymentEvent, requireSandbox, sandboxCheckoutUrl, validateAmount, verifyPayment } from "../convex/lib/payments.ts";

const secret = "ws_storytime_simulated_test_secret";
const event = { paymentId: "pay_test", accountId: "biz_test" };
const metadata = { integration: "storytime-lantern-sandbox", treeId: "tree", memberId: "member" };
const money = { amount: "5.00", currency: "usd", decimals: 2 };
const payment = {
  id: event.paymentId, account_id: event.accountId, status: "paid", currency: "usd",
  checkout_configuration_id: "ch_test", subtotal: money, total: money, metadata,
};
const lantern = {
  treeId: "tree", memberId: "member", amountCents: 500,
  whopCheckoutId: "ch_test", status: "pending",
};

function signed(body, timestamp = Math.floor(Date.now() / 1000)) {
  const raw = JSON.stringify(body);
  const id = "msg_test";
  const signature = createHmac("sha256", secret).update(`${id}.${timestamp}.${raw}`).digest("base64");
  return { raw, headers: { "webhook-id": id, "webhook-timestamp": String(timestamp), "webhook-signature": `v1,${signature}` } };
}

function envelope() {
  return { id: "msg_test", type: "payment.succeeded", account_id: event.accountId, data: { id: event.paymentId } };
}

test("the official SDK verifies a signature using the literal ws_ secret", () => {
  const { raw, headers } = signed(envelope());
  assert.deepEqual(paymentEvent(raw, headers, secret), event);
});

test("tampered raw bytes, wrong secrets and missing signatures fail", () => {
  const { raw, headers } = signed(envelope());
  assert.throws(() => paymentEvent(`${raw} `, headers, secret));
  assert.throws(() => paymentEvent(raw, headers, "ws_wrong"));
  assert.throws(() => paymentEvent(raw, { ...headers, "webhook-signature": "" }, secret));
  assert.throws(() => paymentEvent(raw, headers, ""));
});

test("stale and future signatures fail the SDK replay window", () => {
  for (const delta of [-600, 600]) {
    const { raw, headers } = signed(envelope(), Math.floor(Date.now() / 1000) + delta);
    assert.throws(() => paymentEvent(raw, headers, secret));
  }
});

test("signed malformed event identities fail and other events do nothing", () => {
  for (const body of [{ ...envelope(), id: "msg_other" }, { ...envelope(), account_id: null }, { ...envelope(), data: {} }]) {
    const { raw, headers } = signed(body);
    assert.throws(() => paymentEvent(raw, headers, secret));
  }
  const { raw, headers } = signed({ ...envelope(), type: "payment.pending" });
  assert.equal(paymentEvent(raw, headers, secret), null);
});

test("only explicitly configured sandbox mode is allowed", () => {
  requireSandbox("sandbox");
  for (const env of [undefined, "", "production", "Sandbox"]) assert.throws(() => requireSandbox(env));
});

test("amounts are bounded whole cents and URLs can only open sandbox checkout", () => {
  for (const amount of [100, 500, 10000]) validateAmount(amount);
  for (const amount of [0, -100, 99, 10001, 100.5, Infinity, NaN]) assert.throws(() => validateAmount(amount));
  assert.equal(sandboxCheckoutUrl("https://sandbox.whop.com/checkout/test/"), "https://sandbox.whop.com/checkout/test/");
  for (const url of [null, "https://whop.com/checkout/test", "http://sandbox.whop.com/checkout/test", "https://sandbox.whop.com.attacker.test/checkout/test", "https://x@sandbox.whop.com/checkout/test", "https://sandbox.whop.com/not-checkout/"]) {
    assert.throws(() => sandboxCheckoutUrl(url));
  }
});

test("verified payment uses exact decimal cents and trusted checkout metadata", () => {
  const result = verifyPayment(payment, event.accountId, event);
  assert.deepEqual(result, { paymentId: event.paymentId, checkoutId: "ch_test", treeId: "tree", memberId: "member", amountCents: 500 });
  assert.equal(matchLantern(lantern, result), true);
});

test("pending, wrong account/payment/currency/checkout, invalid totals and foreign metadata fail", () => {
  for (const overrides of [
    { status: "pending" }, { status: "open" }, { id: "pay_other" }, { account_id: "biz_other" },
    { currency: "eur" }, { checkout_configuration_id: null }, { metadata: null },
    { metadata: { ...metadata, integration: "foreign" } }, { metadata: { ...metadata, memberId: null } },
    { total: { ...money, amount: "5.01" } }, { subtotal: { ...money, amount: "5e0" } },
    { subtotal: { ...money, amount: "5.001" } }, { subtotal: { ...money, currency: "eur" } },
    { subtotal: { ...money, decimals: 0 } }, { subtotal: { ...money, amount: 5 } },
  ]) assert.throws(() => verifyPayment({ ...payment, ...overrides }, event.accountId, event));
  assert.throws(() => verifyPayment(payment, "biz_other", event));
});

test("a paid lantern cannot be relit by replay or reassigned to a different payment", () => {
  const verified = verifyPayment(payment, event.accountId, event);
  assert.equal(matchLantern({ ...lantern, status: "paid", whopPaymentId: event.paymentId }, verified), false);
  assert.throws(() => matchLantern({ ...lantern, status: "paid", whopPaymentId: "pay_other" }, verified));
});

test("amount, checkout, tree, member and answer bindings must all match", () => {
  const verified = verifyPayment(payment, event.accountId, event);
  for (const overrides of [{ amountCents: 100 }, { checkoutId: "ch_other" }, { treeId: "other" }, { memberId: "other" }, { answerId: "answer" }]) {
    assert.throws(() => matchLantern(lantern, { ...verified, ...overrides }));
  }
});
