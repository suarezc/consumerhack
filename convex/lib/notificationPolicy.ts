export type NotificationPermission = "granted" | "denied" | "undetermined";

export type GivingContext = {
  dayKey: string;
  nextDayAt: number;
  giving: { count: number; atRisk: boolean };
};

export function eligibleNotification(input: {
  now: number;
  source: { date: string; bloomedAt?: number; isDemo?: boolean; active: boolean; member: boolean };
  preference: { optIn: boolean; permission: NotificationPermission; token?: string } | null;
  giving: GivingContext;
}) {
  const { now, source, preference, giving } = input;
  return Number.isFinite(now) && Number.isFinite(giving.nextDayAt) &&
    now < giving.nextDayAt && source.active && source.member && !source.isDemo &&
    source.bloomedAt !== undefined && source.bloomedAt <= now &&
    source.date === giving.dayKey && !!preference?.optIn &&
    preference.permission === "granted" && validExpoToken(preference.token) &&
    Number.isSafeInteger(giving.giving.count) && giving.giving.count > 0 && giving.giving.atRisk;
}

export function validExpoToken(token: unknown): token is string {
  return typeof token === "string" && /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/.test(token);
}

export function notificationText(streak: number) {
  if (!Number.isSafeInteger(streak) || streak <= 0) throw new Error("Invalid notification streak");
  return `Today's tree has bloomed. Water it to keep your ${streak}-day streak.`;
}
