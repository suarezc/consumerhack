import { strict as assert } from "node:assert";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { applyPayment, checkoutContext, recordPending } from "../convex/lanterns";
import http from "../convex/http";

const deviceId = "storytime-payment-test-device-bearer-123456789";
const args = { treeId: "tree", deviceId, amountCents: 500 };
const verified = { treeId: "tree", memberId: "member", amountCents: 500, checkoutId: "ch_test", paymentId: "pay_test" };

function database() {
  const tables = {
    trees: [{ _id: "tree", cause: { name: "A shared cause" }, demoDayId: "day" }],
    members: [{ _id: "member", treeId: "tree", deviceId, name: "Member" }],
    days: [{ _id: "day", treeId: "tree", bloomedAt: 1, isDemo: true }],
    answers: [{ _id: "answer", treeId: "tree", dayId: "day", memberId: "member" }],
    lanterns: [],
  };
  let patches = 0;
  const db = {
    get: async id => Object.values(tables).flat().find(row => row._id === id) ?? null,
    query: table => {
      let rows = [...tables[table]];
      const query = {
        withIndex: (_name, build) => {
          const index = { eq: (field, value) => { rows = rows.filter(row => row[field] === value); return index; } };
          build(index);
          return query;
        },
        filter: predicate => {
          const expression = predicate({ field: name => name, eq: (field, value) => row => row[field] === value });
          rows = rows.filter(expression);
          return query;
        },
        unique: async () => { assert.ok(rows.length <= 1); return rows[0] ?? null; },
        first: async () => rows[0] ?? null,
        collect: async () => rows,
      };
      return query;
    },
    insert: async (table, value) => {
      const _id = `${table}_${tables[table].length}`;
      tables[table].push({ _id, ...value });
      return _id;
    },
    patch: async (id, value) => {
      patches++;
      Object.assign(await db.get(id), value);
    },
  };
  return { ctx: { db }, tables, patches: () => patches };
}

test("tree checkout requires membership, a cause, and a bounded amount", async () => {
  const { ctx, tables } = database();
  assert.deepEqual(await checkoutContext._handler(ctx, args), { memberId: "member" });
  await assert.rejects(() => checkoutContext._handler(ctx, { ...args, deviceId: "unknown-device-bearer-12345678901234567890" }));
  await assert.rejects(() => checkoutContext._handler(ctx, { ...args, amountCents: 0 }));
  tables.trees[0].cause = undefined;
  await assert.rejects(() => checkoutContext._handler(ctx, args));
});

test("answer checkout enforces the tree, participation, bloom and active demo", async () => {
  const input = { ...args, answerId: "answer" };
  assert.deepEqual(await checkoutContext._handler(database().ctx, input), { memberId: "member" });
  for (const alter of [
    tables => { tables.answers[0].treeId = "other"; },
    tables => { tables.answers[0].memberId = "other"; },
    tables => { tables.days[0].bloomedAt = undefined; },
    tables => { tables.trees[0].demoDayId = "old"; },
    tables => { tables.answers.length = 0; },
  ]) {
    const { ctx, tables } = database();
    alter(tables);
    await assert.rejects(() => checkoutContext._handler(ctx, input));
  }
});

test("recording checkout is pending only, rechecks authorization and rejects duplicate identities", async () => {
  const { ctx, tables } = database();
  const input = { ...args, memberId: "member", checkoutId: "ch_test" };
  await recordPending._handler(ctx, input);
  assert.equal(tables.lanterns[0].status, "pending");
  assert.equal(tables.lanterns[0].whopPaymentId, undefined);
  await assert.rejects(() => recordPending._handler(ctx, input));
  await assert.rejects(() => recordPending._handler(ctx, { ...input, memberId: "other", checkoutId: "ch_other" }));
  tables.members.length = 0;
  await assert.rejects(() => recordPending._handler(ctx, { ...input, checkoutId: "ch_other" }));
  assert.equal(tables.lanterns.length, 1);
});

test("fulfillment patches once, never duplicates paid records, and rejects payment reuse", async () => {
  process.env.WHOP_ENVIRONMENT = "sandbox";
  const { ctx, tables, patches } = database();
  await recordPending._handler(ctx, { ...args, memberId: "member", checkoutId: "ch_test" });
  await applyPayment._handler(ctx, verified);
  await applyPayment._handler(ctx, verified);
  assert.equal(tables.lanterns.length, 1);
  assert.equal(tables.lanterns[0].status, "paid");
  assert.equal(tables.lanterns[0].whopPaymentId, "pay_test");
  assert.equal(patches(), 1);
  await applyPayment._handler(ctx, { ...verified, paymentId: "pay_other" });
  await applyPayment._handler(ctx, { ...verified, paymentId: "pay_other" });
  assert.equal(tables.lanterns.length, 2);
  assert.equal(tables.lanterns[1].whopPaymentId, "pay_other");
  await recordPending._handler(ctx, { ...args, memberId: "member", checkoutId: "ch_other" });
  await assert.rejects(() => applyPayment._handler(ctx, { ...verified, checkoutId: "ch_other" }));
  assert.equal(tables.lanterns[2].status, "pending");
});

test("missing pending records and mismatched amounts or authorization cannot become paid", async () => {
  process.env.WHOP_ENVIRONMENT = "sandbox";
  const { ctx, tables, patches } = database();
  await assert.rejects(() => applyPayment._handler(ctx, verified));
  await recordPending._handler(ctx, { ...args, memberId: "member", checkoutId: "ch_test" });
  for (const change of [{ amountCents: 100 }, { memberId: "other" }, { treeId: "other" }, { answerId: "other" }]) {
    await assert.rejects(() => applyPayment._handler(ctx, { ...verified, ...change }));
  }
  tables.members[0].treeId = "other";
  await assert.rejects(() => applyPayment._handler(ctx, verified));
  assert.equal(tables.lanterns[0].status, "pending");
  assert.equal(patches(), 0);
});

test("HTTP verifies raw signed requests before dispatch and returns retryable failures", async () => {
  const secret = "ws_simulated_http_signature";
  process.env.WHOP_ENVIRONMENT = "sandbox";
  process.env.WHOP_WEBHOOK_SECRET = secret;
  process.env.WHOP_API_KEY = "simulated-key-never-used-for-network";
  const route = http.getRoutes().find(([path, method]) => path === "/whop" && method === "POST")[2];
  const raw = JSON.stringify({ id: "msg_http", type: "payment.succeeded", account_id: "biz_test", data: { id: "pay_test" } });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update(`msg_http.${timestamp}.${raw}`).digest("base64");
  const headers = { "webhook-id": "msg_http", "webhook-timestamp": timestamp, "webhook-signature": `v1,${signature}` };
  const request = body => new Request("https://example.test/whop", { method: "POST", headers, body });
  let calls = 0;
  const ctx = { runAction: async (_reference, event) => { calls++; assert.deepEqual(event, { accountId: "biz_test", paymentId: "pay_test" }); } };
  assert.equal((await route._handler(ctx, request(`${raw} `))).status, 401);
  assert.equal(calls, 0);
  assert.equal((await route._handler(ctx, request(raw))).status, 200);
  assert.equal(calls, 1);
  assert.equal((await route._handler({ runAction: async () => { throw new Error("unavailable"); } }, request(raw))).status, 503);
  delete process.env.WHOP_WEBHOOK_SECRET;
  assert.equal((await route._handler(ctx, request(raw))).status, 503);
});
