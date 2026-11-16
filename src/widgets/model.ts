export const RITUAL_DAY_MS = 86_400_000;
const BOUNDARY_OFFSET_MS = 6 * 3_600_000;
const AGING_MS = 6 * 3_600_000;

export type GivingStatus = "current" | "at_risk" | "none";
export type WidgetSnapshot = {
  version: 1;
  asOf: number;
  dayKey: string;
  nextBoundaryAt: number;
  giving: { count: number; status: GivingStatus };
  hasPriorGiving: boolean;
  historyComplete: boolean;
  currency: "USD";
  sandbox: true;
  totalRaisedCents: number;
  answererCount: number;
};

export type WidgetProps = {
  presentationVersion: 2;
  state: "blossom" | "healthy" | "thirsty" | "withered" | "unavailable";
  count: number | null;
  stage: 1 | 3 | 7 | 30;
  fade: 0 | 1 | 2;
  freshness: "confirmed" | "aging" | "expired" | "missing";
  freshnessLabel: string;
  expiresAt: number | null;
  message: string;
  totalLabel: string;
  answersLabel: string;
  url: string;
  fruitImage: string | null;
  lockImage: string | null;
  lockOutlineImage: string | null;
  treeImage: string | null;
};

export type WidgetEntry = { date: Date; props: WidgetProps };

export function ritualDayKey(now: number): string {
  return new Date(now - BOUNDARY_OFFSET_MS).toISOString().slice(0, 10);
}

export function emptyWidget(url: string): WidgetProps {
  return {
    presentationVersion: 2, state: "unavailable", count: null, stage: 1, fade: 0,
    freshness: "missing", freshnessLabel: "Open StoryTime to refresh", expiresAt: null,
    message: "Your giving ritual, one day at a time.",
    totalLabel: "—", answersLabel: "Open today's tree",
    url,
    fruitImage: null, lockImage: null, lockOutlineImage: null, treeImage: null,
  };
}

export function isWidgetSnapshot(value: unknown): value is WidgetSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Partial<WidgetSnapshot>;
  const integer = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  if (s.version !== 1 || !integer(s.asOf) || !integer(s.nextBoundaryAt) ||
    typeof s.dayKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s.dayKey) ||
    typeof s.hasPriorGiving !== "boolean" || typeof s.historyComplete !== "boolean" ||
    s.currency !== "USD" || s.sandbox !== true || !s.giving || !integer(s.giving.count) ||
    !["current", "at_risk", "none"].includes(s.giving.status) ||
    !integer(s.totalRaisedCents) || !integer(s.answererCount)) return false;
  if (s.asOf > 8.64e15 || s.nextBoundaryAt > 8.64e15) return false;
  const start = Date.parse(`${s.dayKey}T06:00:00.000Z`);
  return Number.isFinite(start) && ritualDayKey(s.asOf) === s.dayKey &&
    s.nextBoundaryAt === start + RITUAL_DAY_MS &&
    (s.giving.status === "none" ? s.giving.count === 0 : s.giving.count > 0);
}

export function widgetAt(snapshot: WidgetSnapshot | null, now: number, url: string): WidgetProps {
  const empty = emptyWidget(url);
  if (!isWidgetSnapshot(snapshot) || now < snapshot.asOf) return empty;
  if (now >= snapshot.nextBoundaryAt) {
    return { ...empty, freshness: "expired", message: "A new ritual day has begun." };
  }
  if (!snapshot.historyComplete) return { ...empty, message: "Giving history needs a refresh." };
  const { count, status } = snapshot.giving;
  const state = status === "current" ? "healthy" : status === "at_risk" ? "thirsty" :
    snapshot.hasPriorGiving ? "withered" : "blossom";
  const elapsed = now - (snapshot.nextBoundaryAt - RITUAL_DAY_MS);
  const fade = elapsed >= 16 * 3_600_000 ? 2 : elapsed >= 8 * 3_600_000 ? 1 : 0;
  const aging = now - snapshot.asOf >= AGING_MS;
  const time = new Date(snapshot.asOf).toISOString().slice(11, 16);
  return {
    ...empty, state, count, fade,
    expiresAt: snapshot.nextBoundaryAt,
    stage: count >= 30 ? 30 : count >= 7 ? 7 : count >= 3 ? 3 : 1,
    freshness: aging ? "aging" : "confirmed",
    freshnessLabel: `${aging ? "Last synced" : "As of"} ${time} UTC`,
    message: state === "healthy" ? "Watered today." : state === "thirsty" ?
      "Thirsty. Water today to keep it." : state === "withered" ?
        "Your peach dried. Water to grow a new one." : "Water to grow your first fruit.",
    totalLabel: `$${(snapshot.totalRaisedCents / 100).toFixed(2)}`,
    answersLabel: `${snapshot.answererCount} answered`,
  };
}

export function buildWidgetTimeline(snapshot: WidgetSnapshot | null, now: number, url: string): WidgetEntry[] {
  if (!isWidgetSnapshot(snapshot) || now < snapshot.asOf || now >= snapshot.nextBoundaryAt) {
    return [{ date: new Date(now), props: widgetAt(snapshot, now, url) }];
  }
  const start = snapshot.nextBoundaryAt - RITUAL_DAY_MS;
  const dates = [now, start + 8 * 3_600_000, start + 16 * 3_600_000,
    snapshot.asOf + AGING_MS, snapshot.nextBoundaryAt];
  return [...new Set(dates)].filter((at) => at >= now && at <= snapshot.nextBoundaryAt)
    .sort((a, b) => a - b).map((at) => ({ date: new Date(at), props: widgetAt(snapshot, at, url) }));
}
