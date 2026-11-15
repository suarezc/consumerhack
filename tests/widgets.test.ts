import { describe, expect, it, vi } from "vitest";

import { snapshotFromVerifiedDay, type AuthoritativeWidgetDay } from "../src/widgets/adapter";
import { buildWidgetTimeline, isWidgetSnapshot, ritualDayKey, widgetAt, type WidgetEntry, type WidgetSnapshot } from "../src/widgets/model";
import { createWidgetSync } from "../src/widgets/sync";
import { createWidgetSessionBridge } from "../src/widgets/sessionBridge";

const at = (time: string) => Date.parse(`2026-11-15T${time}Z`);
const snapshot = (changes: Partial<WidgetSnapshot> = {}): WidgetSnapshot => ({
  version: 1, asOf: at("06:00:00"), dayKey: "2026-11-15", nextBoundaryAt: at("06:00:00") + 86_400_000,
  giving: { count: 6, status: "at_risk" }, hasPriorGiving: true, historyComplete: true,
  currency: "USD", sandbox: true, fruitCount: 0, goldenFruitCount: 0, totalRaisedCents: 4150, answererCount: 212,
  ...changes,
});
const url = "storytime://";
const day = (): AuthoritativeWidgetDay => ({
  day: { isDemo: false, date: "2026-11-15" }, totalRaisedCents: 250, answererCount: 40,
  fruits: [{ isMine: true, golden: true, source: "whop" }, { isMine: false, golden: false, source: "whop" }, { isMine: true, golden: false, source: "demo" }],
  streaks: { isDemo: false, currency: "USD", undatedPaidCount: 0,
    clock: { now: at("06:00:00"), date: "2026-11-15", nextBoundaryAt: at("06:00:00") + 86_400_000 },
    giving: { count: 3, status: "current", totalCents: 500 } },
});

describe("giving widget presentation (not an authoritative counter)", () => {
  it.each([
    ["current", 6, true, "healthy"], ["at_risk", 6, true, "thirsty"],
    ["none", 0, false, "blossom"], ["none", 0, true, "withered"],
  ] as const)("renders %s with prior=%s", (status, count, prior, state) => {
    expect(widgetAt(snapshot({ giving: { status, count }, hasPriorGiving: prior }), at("07:00:00"), url).state).toBe(state);
  });
  it.each([[0, 1], [1, 1], [2, 1], [3, 3], [6, 3], [7, 7], [29, 7], [30, 30], [31, 30]] as const)("maps %i days to maturity %i without changing gold facts", (count, stage) => {
    const props = widgetAt(snapshot({ giving: { status: count ? "current" : "none", count }, goldenFruitCount: 1, fruitCount: 1 }), at("07:00:00"), url);
    expect(props.stage).toBe(stage);
    expect(props).not.toHaveProperty("goldenFruitCount");
  });
  it.each([false, true])("incomplete legacy history is neutral with prior=%s", (hasPriorGiving) => {
    expect(widgetAt(snapshot({ hasPriorGiving, historyComplete: false }), at("07:00:00"), url).state).toBe("unavailable");
  });
  it("uses the 06:00 UTC boundary rather than midnight or local DST", () => {
    expect(ritualDayKey(at("05:59:59"))).toBe("2026-11-14");
    expect(ritualDayKey(at("06:00:00"))).toBe("2026-11-15");
    expect(ritualDayKey(at("00:00:00"))).toBe("2026-11-14");
    expect(ritualDayKey(Date.parse("2026-11-01T01:30:00-07:00"))).toBe("2026-11-01");
    expect(ritualDayKey(Date.parse("2026-11-01T01:30:00-08:00"))).toBe("2026-11-01");
  });
  it("schedules morning, afternoon, evening and an irreversible unknown boundary entry", () => {
    const entries = buildWidgetTimeline(snapshot(), at("06:00:00"), url);
    expect(entries.map((entry) => entry.date.toISOString())).toEqual([
      "2026-11-15T06:00:00.000Z", "2026-11-15T12:00:00.000Z", "2026-11-15T14:00:00.000Z", "2026-11-15T22:00:00.000Z", "2026-11-16T06:00:00.000Z",
    ]);
    expect(entries.map((entry) => entry.props.fade)).toEqual([0, 0, 1, 2, 0]);
    expect(entries[1].props.freshness).toBe("aging");
    expect(entries.at(-1)?.props).toMatchObject({ state: "unavailable", count: null, totalLabel: "—", freshness: "expired" });
    expect(widgetAt(snapshot(), at("06:00:00") + 3 * 86_400_000, url).state).toBe("unavailable");
  });
  it("never rolls today's confirmed watering into tomorrow's streak or broken state", () => {
    const s = snapshot({ giving: { count: 7, status: "current" } });
    expect(widgetAt(s, s.nextBoundaryAt - 1, url).state).toBe("healthy");
    expect(widgetAt(s, s.nextBoundaryAt, url).state).toBe("unavailable");
    expect(widgetAt(s, s.nextBoundaryAt + 86_400_000, url).count).toBeNull();
  });
  it("deduplicates coinciding aging/fade entries and never schedules past dates", () => {
    const s = snapshot({ asOf: at("08:00:00") });
    const entries = buildWidgetTimeline(s, at("15:00:00"), url);
    expect(entries).toHaveLength(3);
    expect(new Set(entries.map((entry) => +entry.date)).size).toBe(entries.length);
    expect(entries[0].props.fade).toBe(1);
  });
  it("fails closed for missing, future, malformed or expired snapshots", () => {
    expect(widgetAt(null, at("07:00:00"), url).count).toBeNull();
    expect(widgetAt(snapshot(), at("05:59:59"), url).count).toBeNull();
    for (const bad of [snapshot({ totalRaisedCents: -1 }), snapshot({ asOf: Infinity }), snapshot({ dayKey: "2026-02-31" }), snapshot({ goldenFruitCount: 2 }), snapshot({ giving: { status: "none", count: 4 } }), snapshot({ currency: "EUR" as "USD" })]) {
      expect(isWidgetSnapshot(bad)).toBe(false);
    }
  });
});

describe("verified query projection", () => {
  it("copies server cents, count, own paid fruit and historical gold without ledger arithmetic", () => {
    expect(snapshotFromVerifiedDay(day())).toMatchObject({ totalRaisedCents: 250, answererCount: 40,
      giving: { count: 3, status: "current" }, fruitCount: 1, goldenFruitCount: 1, hasPriorGiving: true, historyComplete: true });
  });
  it("strips identity, provider metadata, lifetime amount and event IDs", () => {
    const input = { ...day(), deviceId: "bearer-secret", providerId: "provider-secret", inviteCode: "ABCDEF", wateringEvent: { id: "not-for-widget" } };
    const serialized = JSON.stringify(snapshotFromVerifiedDay(input));
    for (const forbidden of ["bearer-secret", "provider-secret", "ABCDEF", "totalCents", "wateringEvent", "fruitId"]) expect(serialized).not.toContain(forbidden);
  });
  it("never invents zeros for missing canonical totals or accepts synthetic data", () => {
    expect(snapshotFromVerifiedDay(null)).toBeNull();
    expect(snapshotFromVerifiedDay({ ...day(), totalRaisedCents: undefined })).toBeNull();
    expect(snapshotFromVerifiedDay({ isDemo: false })).toBeNull();
    expect(snapshotFromVerifiedDay({ ...day(), fruits: [null] })).toBeNull();
    expect(snapshotFromVerifiedDay({ ...day(), day: { isDemo: true, date: "2026-11-15" } })).toBeNull();
    const input = day(); input.streaks.isDemo = true;
    expect(snapshotFromVerifiedDay(input)).toBeNull();
  });
  it("accepts the actual nested Today day DTO and rejects the old invented top-level flag", () => {
    expect(snapshotFromVerifiedDay(day())?.giving.count).toBe(3);
    const { day: nested, ...rest } = day();
    expect(snapshotFromVerifiedDay({ ...rest, isDemo: nested.isDemo })).toBeNull();
    expect(snapshotFromVerifiedDay({ ...day(), day: { isDemo: false, date: "2026-11-14" } })).toBeNull();
  });
  it("projects undated history as incomplete without leaking its lifetime amount", () => {
    const input = day(); input.streaks.undatedPaidCount = 2;
    const s = snapshotFromVerifiedDay(input)!;
    expect(s.historyComplete).toBe(false);
    expect(widgetAt(s, s.asOf, url).state).toBe("unavailable");
  });
  it("duplicate and late-paid query results replace facts rather than incrementing fruit or streak", () => {
    const input = day(); const first = snapshotFromVerifiedDay(input)!;
    expect(snapshotFromVerifiedDay(input)).toEqual(first);
    input.totalRaisedCents = 500;
    expect(snapshotFromVerifiedDay(input)).toMatchObject({ totalRaisedCents: 500, giving: first.giving, fruitCount: 1 });
    input.streaks.giving = { ...input.streaks.giving, count: 4, status: "current" };
    expect(snapshotFromVerifiedDay(input)?.giving.count).toBe(4);
  });
});

describe("native timeline synchronization", () => {
  function setup(prepare = async (entries: WidgetEntry[]) => entries) {
    const transport = { updateTimeline: vi.fn(), updateSnapshot: vi.fn() };
    const sync = createWidgetSync({ load: async () => transport, prepare, rootUrl: url, now: () => at("08:00:00") });
    return { sync, transport };
  }
  it("ignores identical webhook-backed facts and out-of-order older snapshots", async () => {
    const { sync, transport } = setup();
    const newer = snapshot({ asOf: at("07:00:00") });
    expect(await sync.publish(newer)).toBe("updated");
    expect(await sync.publish(newer)).toBe("ignored");
    expect(await sync.publish(snapshot())).toBe("ignored");
    expect(transport.updateTimeline).toHaveBeenCalledTimes(1);
  });
  it("accepts corrected/late server facts but never emits payment feedback", async () => {
    const { sync, transport } = setup();
    await sync.publish(snapshot());
    await sync.publish(snapshot({ asOf: at("07:00:00"), totalRaisedCents: 4400 }));
    const entries = transport.updateTimeline.mock.calls[1][0] as WidgetEntry[];
    expect(entries[0].props.totalLabel).toBe("$44.00");
    expect(entries[0].props.count).toBe(6);
    expect(entries[0].props.url).toBe(url);
    expect(entries.at(-1)?.props.freshness).toBe("expired");
  });
  it("keeps the authoritative absolute boundary instead of extending stale facts at receipt", async () => {
    const { sync, transport } = setup();
    await sync.publish(snapshot());
    const entries = transport.updateTimeline.mock.calls[0][0] as WidgetEntry[];
    expect(+entries[0].date).toBe(at("08:00:00"));
    expect(+entries.at(-1)!.date).toBe(snapshot().nextBoundaryAt);
  });
  it("never revives an offline snapshot after a day cutover", async () => {
    const transport = { updateTimeline: vi.fn(), updateSnapshot: vi.fn() };
    const sync = createWidgetSync({ load: async () => transport, prepare: async (entries) => entries,
      rootUrl: url, now: () => snapshot().nextBoundaryAt + 1000 });
    await sync.publish(snapshot());
    const entries = transport.updateTimeline.mock.calls[0][0] as WidgetEntry[];
    expect(entries).toHaveLength(1);
    expect(entries[0].props).toMatchObject({ freshness: "expired", count: null });
  });
  it("clears future timeline and data on logout, tree/account changes or demo", async () => {
    const { sync, transport } = setup();
    await sync.publish(snapshot());
    expect(await sync.clear()).toBe("cleared");
    expect(transport.updateSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({ count: null, fruitImage: null, totalLabel: "—" }));
    expect(await sync.publish(snapshot())).toBe("updated");
    expect(await sync.publish(null)).toBe("cleared");
  });
  it("prevents in-flight asset preparation repopulating a cleared identity", async () => {
    let release!: (entries: WidgetEntry[]) => void;
    let started!: () => void;
    const preparing = new Promise<void>((resolve) => { started = resolve; });
    const { sync, transport } = setup(async (entries) => {
      started(); await new Promise<WidgetEntry[]>((resolve) => { release = resolve; }); return entries;
    });
    const publishing = sync.publish(snapshot());
    await preparing;
    const clearing = sync.clear();
    release([]);
    expect(await publishing).toBe("ignored");
    expect(await clearing).toBe("cleared");
    expect(transport.updateTimeline).not.toHaveBeenCalled();
  });
  it("handles absent/denied native capability without crashing or logging data", async () => {
    for (const load of [async () => null, async () => { throw new Error("denied"); }]) {
      const sync = createWidgetSync({ load, prepare: async (entries) => entries, rootUrl: url });
      expect(await sync.publish(snapshot())).toBe("unavailable");
      expect(await sync.clear()).toBe("unavailable");
    }
  });
  it("retries an offline artwork failure without marking the snapshot delivered", async () => {
    const prepare = vi.fn().mockRejectedValueOnce(new Error("offline")).mockImplementation(async (entries) => entries);
    const { sync, transport } = setup(prepare);
    expect(await sync.publish(snapshot())).toBe("unavailable");
    expect(await sync.publish(snapshot())).toBe("updated");
    expect(transport.updateTimeline).toHaveBeenCalledTimes(1);
  });
  it("drops late query callbacks from a previous session/tree without storing identity", async () => {
    const { sync, transport } = setup();
    const bridge = createWidgetSessionBridge(sync);
    const old = bridge.beginScope();
    await old.publish(day());
    const current = bridge.beginScope();
    expect(await old.publish(day())).toBe("ignored");
    expect(await old.close()).toBe("ignored");
    expect(await current.publish(day())).toBe("updated");
    expect(await current.close()).toBe("cleared");
    expect(await current.publish(day())).toBe("ignored");
    expect(transport.updateTimeline).toHaveBeenCalledTimes(2);
    expect(transport.updateSnapshot).toHaveBeenCalledTimes(3);
  });
  it("clears session data before publishing a new scope's resolved query", async () => {
    const { sync, transport } = setup();
    const scoped = createWidgetSessionBridge(sync).beginScope();
    await scoped.publish(day());
    expect(transport.updateSnapshot.mock.invocationCallOrder[0]).toBeLessThan(transport.updateTimeline.mock.invocationCallOrder[0]);
    expect(await scoped.publish(null)).toBe("cleared");
  });
});
