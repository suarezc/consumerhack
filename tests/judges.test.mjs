import { test } from "node:test";
import assert from "node:assert/strict";
import { stubAssessment, validAssessment, rankMatches, currentBloom, eligibleTarget, fixtureCode } from "../convex/lib/judgeLogic.ts";
import { assessAnswers } from "../convex/lib/judgeAdapter.ts";

const source = { answerId: "source", treeId: "sourceTree", text: "grateful for my friend", ...stubAssessment("grateful for my friend") };
const candidate = (answerId, treeId, text) => ({ answerId, treeId, text, ...stubAssessment(text) });

test("stub is deterministic, bounded and emits 1536 finite normalized dimensions", () => {
  for (const text of ["", "grief and hope", "ありがとう", "joy ".repeat(1000)]) {
    const assessment = stubAssessment(text);
    assert.deepEqual(assessment, stubAssessment(text));
    assert.equal(assessment.embedding.length, 1536);
    assert.equal(validAssessment(assessment), true);
    assert.ok(Math.abs(Math.hypot(...assessment.embedding) - 1) < 0.00001);
  }
});

test("ranking excludes self, same-tree, duplicates and malformed embeddings", () => {
  const warm = candidate("warm", "other", "thankful for a kind friend");
  const matches = rankMatches(source, [source, candidate("local", "sourceTree", source.text), warm, warm,
    candidate("sad", "third", "lonely grief"), candidate("rest", "fourth", "quiet rest"),
    candidate("hope", "fifth", "new future"), { ...warm, answerId: "broken", embedding: [1] }]);
  assert.equal(matches.length, 3);
  assert.equal(matches[0].answerId, "warm");
  assert.equal(new Set(matches.map((match) => match.answerId)).size, 3);
  assert.ok(matches.every((match) => !match.reason.includes("\n") && match.reason.length < 160));
  assert.deepEqual(rankMatches(source, []), []);
  assert.equal(rankMatches(source, [warm]).length, 1);
});

test("bloom eligibility rejects closed, stale demo and cross-mode targets", () => {
  const normal = { _id: "normal", treeId: "sourceTree", bloomedAt: 0 };
  const demo = { ...normal, _id: "demo", isDemo: true };
  const target = { _id: "target", treeId: "targetTree", bloomedAt: 1 };
  const tree = { _id: "targetTree", code: "ABCDEF" };
  assert.equal(currentBloom({ ...normal, bloomedAt: undefined }, { _id: "sourceTree" }), false);
  assert.equal(currentBloom(demo, { _id: "sourceTree", demoDayId: "new-run" }), false);
  assert.equal(currentBloom(demo, { _id: "sourceTree", demoDayId: "demo" }), true);
  assert.equal(eligibleTarget(normal, target, tree), true);
  assert.equal(eligibleTarget(normal, { ...target, isDemo: true }, { ...tree, demoDayId: "target" }), false);
  const fixtureTree = { ...tree, code: fixtureCode("demo", 0), demoDayId: "target" };
  assert.equal(eligibleTarget(demo, { ...target, isDemo: true }, fixtureTree), true);
  assert.equal(eligibleTarget({ ...demo, _id: "new-run" }, { ...target, isDemo: true }, fixtureTree), false);
});

test("live is never called without explicit switch and key", async () => {
  const request = () => { throw new Error("Unexpected network"); };
  for (const config of [{}, { mode: "stub", apiKey: "test-only" }, { mode: "live" }]) {
    assert.deepEqual(await assessAnswers([source.text], { ...config, request }), [stubAssessment(source.text)]);
  }
});

test("live adapter maps embedding indexes, validates mood and never sends identity", async () => {
  const requests = [];
  const request = async (url, options) => {
    requests.push(JSON.parse(options.body));
    return Response.json(url.endsWith("embeddings") ? { data: [
      { index: 1, embedding: stubAssessment("sad").embedding },
      { index: 0, embedding: source.embedding },
    ] } : { choices: [{ message: { content: JSON.stringify({ moods: [0.8, -0.5] }) } }] });
  };
  const result = await assessAnswers([source.text, "sad"], { mode: "live", apiKey: "test-only", request });
  assert.equal(result[0].mood, 0.8);
  assert.deepEqual(result[0].embedding, source.embedding);
  assert.equal(requests[0].dimensions, 1536);
  assert.ok(requests.every((body) => !JSON.stringify(body).includes("deviceId")));
});

test("provider failure, refusal and malformed vectors fall back as one consistent batch", async () => {
  for (const request of [
    async () => new Response("sensitive provider error", { status: 429 }),
    async () => { throw new Error("sensitive network error"); },
    async (url) => Response.json(url.endsWith("embeddings") ? { data: [{ index: 0, embedding: [1] }] } : { choices: [{ message: { content: '{"moods":[8]}' } }] }),
    async () => Response.json({ choices: [{ message: { content: null } }] }),
  ]) assert.deepEqual(await assessAnswers([source.text], { mode: "live", apiKey: "test-only", request }), [stubAssessment(source.text)]);
});
