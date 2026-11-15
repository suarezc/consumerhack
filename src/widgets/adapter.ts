import { isWidgetSnapshot, type GivingStatus, type WidgetSnapshot } from "./model";

export type AuthoritativeWidgetDay = {
  day: { date: string; isDemo: boolean };
  totalRaisedCents: number;
  answererCount: number;
  fruits: { isMine: boolean; golden: boolean; source: "whop" | "demo" }[];
  streaks: {
    isDemo: boolean;
    currency: "USD";
    undatedPaidCount: number;
    clock: { now: number; date: string; nextBoundaryAt: number };
    giving: { count: number; status: GivingStatus; totalCents: number };
  };
};

export function snapshotFromVerifiedDay(value: unknown): WidgetSnapshot | null {
  if (typeof value !== "object" || value === null) return null;
  const day = value as Partial<AuthoritativeWidgetDay>;
  if (day.day?.isDemo !== false || typeof day.day.date !== "string" ||
    typeof day.totalRaisedCents !== "number" || typeof day.answererCount !== "number" ||
    !day.streaks?.clock || !day.streaks.giving ||
    !Array.isArray(day.fruits) || !day.fruits.every((fruit) => typeof fruit === "object" && fruit !== null &&
      typeof fruit.isMine === "boolean" && typeof fruit.golden === "boolean" && ["whop", "demo"].includes(fruit.source)) ||
    day.streaks.isDemo !== false || day.day.date !== day.streaks.clock.date ||
    day.streaks.currency !== "USD" || !Number.isSafeInteger(day.streaks.undatedPaidCount) ||
    day.streaks.undatedPaidCount < 0 || !Number.isSafeInteger(day.streaks.giving.totalCents) ||
    day.streaks.giving.totalCents < 0) return null;
  const mine = day.fruits.filter((fruit) => fruit.isMine && fruit.source === "whop");
  const snapshot: WidgetSnapshot = {
    version: 1,
    asOf: day.streaks.clock.now,
    dayKey: day.streaks.clock.date,
    nextBoundaryAt: day.streaks.clock.nextBoundaryAt,
    giving: { count: day.streaks.giving.count, status: day.streaks.giving.status },
    hasPriorGiving: day.streaks.giving.totalCents > 0,
    historyComplete: day.streaks.undatedPaidCount === 0,
    currency: "USD",
    sandbox: true,
    fruitCount: mine.length,
    goldenFruitCount: mine.filter((fruit) => fruit.golden).length,
    totalRaisedCents: day.totalRaisedCents,
    answererCount: day.answererCount,
  };
  return isWidgetSnapshot(snapshot) ? snapshot : null;
}
