import { describe, expect, it } from "vitest";
import { eligibleNotification, notificationText, validExpoToken } from "../convex/lib/notificationPolicy";
import { getPushReceipt, parsePushResult, parseReceipt, sendPush } from "../convex/lib/notificationProvider";

const token = "ExpoPushToken[realistic_test_token]";
const eligible = () => ({
  now: Date.parse("2026-11-15T23:59:59Z"),
  source: { date: "2026-11-15", bloomedAt: Date.parse("2026-11-15T21:00:00Z"), active: true, member: true, isDemo: false },
  preference: { optIn: true, permission: "granted" as const, token },
  giving: { dayKey: "2026-11-15", nextDayAt: Date.parse("2026-11-16T06:00:00Z"), giving: { count: 3, atRisk: true } },
});

describe("delivery eligibility", () => {
  it("uses authoritative ritual dates across calendar midnight", () => {
    const input = eligible();
    expect(eligibleNotification(input)).toBe(true);
    input.now = Date.parse("2026-11-16T00:00:00Z");
    expect(eligibleNotification(input)).toBe(true);
    input.now = input.giving.nextDayAt;
    expect(eligibleNotification(input)).toBe(false);
    input.giving.dayKey = "2026-11-16";
    input.giving.nextDayAt += 86_400_000;
    expect(eligibleNotification(input)).toBe(false);
  });

  it("requires yesterday continuity, not a paid today or broken streak", () => {
    const input = eligible();
    input.giving.giving = { count: 4, atRisk: false };
    expect(eligibleNotification(input)).toBe(false);
    input.giving.giving = { count: 0, atRisk: false };
    expect(eligibleNotification(input)).toBe(false);
    input.giving.giving = { count: 0, atRisk: true };
    expect(eligibleNotification(input)).toBe(false);
  });

  it("rechecks payment, consent, token, source bloom, membership and demo isolation", () => {
    for (const change of [
      (x: ReturnType<typeof eligible>) => { x.giving.giving.atRisk = false; },
      (x: ReturnType<typeof eligible>) => { x.preference.optIn = false; },
      (x: ReturnType<typeof eligible>) => { x.preference.token = ""; },
      (x: ReturnType<typeof eligible>) => { x.source.active = false; },
      (x: ReturnType<typeof eligible>) => { x.source.member = false; },
      (x: ReturnType<typeof eligible>) => { x.source.isDemo = true; },
      (x: ReturnType<typeof eligible>) => { x.source.bloomedAt = x.now + 1; },
    ]) {
      const input = eligible();
      change(input);
      expect(eligibleNotification(input)).toBe(false);
    }
    expect(eligibleNotification({ ...eligible(), preference: null })).toBe(false);
    expect(eligibleNotification({ ...eligible(), preference: { ...eligible().preference, permission: "denied" } })).toBe(false);
    expect(eligibleNotification({ ...eligible(), preference: { ...eligible().preference, permission: "undetermined" } })).toBe(false);
    expect(eligibleNotification({ ...eligible(), source: { ...eligible().source, bloomedAt: undefined } })).toBe(false);
  });

  it("uses exact approved copy and rejects malformed tokens", () => {
    expect(notificationText(3)).toBe("Today's tree has bloomed. Water it to keep your 3-day streak.");
    expect(() => notificationText(0)).toThrow();
    expect(validExpoToken(token)).toBe(true);
    expect(validExpoToken("device-bearer-00000001")).toBe(false);
    expect(validExpoToken("ExpoPushToken[x]\n")).toBe(false);
  });
});

describe("honest Expo provider states", () => {
  it("distinguishes acceptance from provider handoff, neither is OS display", () => {
    expect(parsePushResult({ data: { status: "ok", id: "ticket-1" } })).toEqual({ kind: "accepted", ticketId: "ticket-1" });
    expect(parseReceipt({ data: { "ticket-1": { status: "ok" } } }, "ticket-1")).toEqual({ kind: "handed_off" });
    expect(parseReceipt({ data: {} }, "ticket-1")).toEqual({ kind: "pending" });
  });

  it("does not echo provider messages that may contain tokens", () => {
    expect(parsePushResult({ data: { status: "error", message: token, details: { error: token } } })).toEqual({
      kind: "rejected", error: "ProviderRejected", retryable: false,
    });
    expect(parseReceipt({ data: { t: { status: "error", details: { error: "DeviceNotRegistered" } } } }, "t")).toEqual({
      kind: "rejected", error: "DeviceNotRegistered", retryable: false,
    });
  });

  it("only retries an explicit known-not-accepted rate rejection", () => {
    expect(parsePushResult({ data: { status: "error", details: { error: "MessageRateExceeded" } } })).toEqual({
      kind: "rejected", error: "MessageRateExceeded", retryable: true,
    });
    for (const value of [undefined, {}, { errors: [] }, { data: [{ status: "ok", id: "x" }] }, { data: { status: "ok" } }]) {
      expect(parsePushResult(value)).toEqual({ kind: "unknown" });
    }
  });

  it("sends no bearer identity or stale payload and never retries ambiguous HTTP", async () => {
    const requests: RequestInit[] = [];
    const request = (async (_url: unknown, init: RequestInit) => {
      requests.push(init);
      return new Response("{}", { status: 503 });
    }) as typeof fetch;
    expect(await sendPush({ token, date: "2026-11-15", streak: 3 }, request)).toEqual({ kind: "unknown" });
    expect(requests).toHaveLength(1);
    expect(JSON.parse(requests[0].body as string)).toEqual({
      to: token, body: notificationText(3), data: { kind: "watering-streak", date: "2026-11-15" },
      ttl: 0, priority: "high", collapseId: "watering-2026-11-15", tag: "watering-2026-11-15", channelId: "watering",
    });
    const throws = (async () => { throw new Error(token); }) as typeof fetch;
    expect(await sendPush({ token, date: "2026-11-15", streak: 3 }, throws)).toEqual({ kind: "unknown" });
    expect(await getPushReceipt("ticket-1", undefined, throws)).toEqual({ kind: "pending" });
  });
});
