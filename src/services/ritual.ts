export function ritualTime(now: number, day?: { isDemo: boolean; opensAt: number; bloomAt: number } | null) {
  if (day?.isDemo) return Math.max(0, Math.min(1, (now - day.opensAt) / (day.bloomAt - day.opensAt)));
  const date = new Date(now);
  return Math.max(0, Math.min(1, (date.getUTCHours() + date.getUTCMinutes() / 60 - 6) / 15));
}

export function bloomLabel(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function firstOpenView(todayDayId: string | null | undefined, intro: {
  todayDayId: string;
  shouldShowYesterday: boolean;
  yesterday: object | null;
} | null | undefined) {
  if (!todayDayId || !intro || intro.todayDayId !== todayDayId) return "loading";
  return intro.shouldShowYesterday && intro.yesterday !== null ? "yesterday" : "today";
}

export function amountInCents(value: string) {
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Math.round(Number(value) * 100);
  return amount >= 100 && amount <= 10000 && amount % 50 === 0 ? amount : null;
}
