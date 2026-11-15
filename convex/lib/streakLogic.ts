import { ritualWindow } from "../questions";

export const DAY_MS = 86_400_000;

export function shiftDate(date: string, offset: number) {
  return new Date(Date.parse(`${date}T06:00:00Z`) + offset * DAY_MS).toISOString().slice(0, 10);
}

export function streakEnding(dates: ReadonlySet<string>, date: string) {
  let count = 0;
  for (let cursor = date; dates.has(cursor); cursor = shiftDate(cursor, -1)) count++;
  return count;
}

export function currentStreak(dates: ReadonlySet<string>, today: string) {
  const hasToday = dates.has(today);
  const count = streakEnding(dates, hasToday ? today : shiftDate(today, -1));
  return { count, status: count === 0 ? "none" as const : hasToday ? "current" as const : "at_risk" as const };
}

export function longestStreak(dates: ReadonlySet<string>) {
  let longest = 0;
  let count = 0;
  let previous: string | undefined;
  for (const date of [...dates].sort()) {
    count = previous && shiftDate(previous, 1) === date ? count + 1 : 1;
    longest = Math.max(longest, count);
    previous = date;
  }
  return longest;
}

export function milestone(dates: ReadonlySet<string>, date: string): 3 | 7 | 30 | null {
  const count = streakEnding(dates, date);
  return count === 3 || count === 7 || count === 30 ? count : null;
}

export function ritualClock(now: number) {
  const window = ritualWindow(now);
  return { date: window.date, opensAt: window.opensAt, nextBoundaryAt: window.opensAt + DAY_MS, now };
}
