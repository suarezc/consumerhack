import { isWidgetSnapshot, type GivingStatus, type WidgetSnapshot } from "./model";

export type AuthoritativeWidgetDay = {
  day: { date: string; isDemo: boolean };
  totalRaisedCents: number;
  answererCount: number;
  streaks: {
    isDemo: boolean;
    currency: "USD";
    undatedPaidCount: number;
    clock: { now: number; date: string; nextBoundaryAt: number };
    answer?: { count: number; status: GivingStatus };
    giving: { count: number; status: GivingStatus; totalCents: number };
  };
};

export function snapshotFromVerifiedDay(value: unknown): WidgetSnapshot | null {
  if (typeof value !== "object" || value === null) return null;
  const day = value as Partial<AuthoritativeWidgetDay>;
  if (typeof day.day?.date !== "string" ||
    typeof day.totalRaisedCents !== "number" || typeof day.answererCount !== "number" ||
    !day.streaks?.clock || !day.streaks.answer ||
    (!day.day.isDemo && day.day.date !== day.streaks.clock.date) ||
    day.streaks.currency !== "USD") return null;
  const snapshot: WidgetSnapshot = {
    version: 1,
    asOf: day.streaks.clock.now,
    dayKey: day.streaks.clock.date,
    nextBoundaryAt: day.streaks.clock.nextBoundaryAt,
    giving: { count: day.streaks.answer.count, status: day.streaks.answer.status },
    hasPriorGiving: false,
    historyComplete: true,
    currency: "USD",
    sandbox: true,
    totalRaisedCents: day.totalRaisedCents,
    answererCount: day.answererCount,
  };
  return isWidgetSnapshot(snapshot) ? snapshot : null;
}
