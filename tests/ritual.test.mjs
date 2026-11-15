import assert from "node:assert/strict";
import { test } from "node:test";

import { amountInCents, ritualTime } from "../src/services/ritual.ts";

test("normal palette uses UTC ritual clock and clamps overnight", () => {
  assert.equal(ritualTime(Date.parse("2026-11-15T06:00:00Z")), 0);
  assert.equal(ritualTime(Date.parse("2026-11-15T13:30:00Z")), 0.5);
  assert.equal(ritualTime(Date.parse("2026-11-15T21:00:00Z")), 1);
  assert.equal(ritualTime(Date.parse("2026-11-15T23:00:00Z")), 1);
});

test("demo palette compresses one shared clock from opening to bloom", () => {
  const day = { isDemo: true, opensAt: 1000, bloomAt: 61000 };
  assert.equal(ritualTime(1000, day), 0);
  assert.equal(ritualTime(31000, day), 0.5);
  assert.equal(ritualTime(61000, day), 1);
  assert.equal(ritualTime(90000, day), 1);
});

test("watering amounts require the approved dollar minimum and fifty-cent steps", () => {
  assert.equal(amountInCents("1"), 100);
  assert.equal(amountInCents("1.50"), 150);
  assert.equal(amountInCents("10.50"), 1050);
  assert.equal(amountInCents("100"), 10000);
  for (const invalid of ["0", "0.49", "0.50", "0.99", "1.25", "100.01", "1.001", "1e2", "-1", "", "1abc"]) assert.equal(amountInCents(invalid), null);
});
