import type { NotificationRuntime } from "./notifications";

export function notificationRuntime(): NotificationRuntime {
  return {
    available: () => false,
    configure: async () => {},
    permission: async () => "undetermined",
    requestPermission: async () => "undetermined",
    token: async () => { throw new Error("Native push notifications are unavailable on web"); },
    onTokenChange: () => () => {},
  };
}

export function installForegroundNotificationGuard(_eligible: (date: string) => Promise<boolean>) {
  return () => {};
}
