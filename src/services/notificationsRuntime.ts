import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Notifications from "expo-notifications";
import { AndroidImportance, IosAuthorizationStatus } from "expo-notifications";
import { Platform } from "react-native";
import type { NotificationPermission, NotificationRuntime } from "./notifications";

function permission(value: Notifications.NotificationPermissionsStatus): NotificationPermission {
  if (Platform.OS === "ios") {
    if (value.ios?.status === IosAuthorizationStatus.NOT_DETERMINED) return "undetermined";
    return value.ios?.status === IosAuthorizationStatus.AUTHORIZED && value.ios.allowsAlert !== false
      ? "granted" : "denied";
  }
  return value.granted ? "granted" : value.status === "undetermined" ? "undetermined" : "denied";
}

export function notificationRuntime(): NotificationRuntime {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const supported = (Platform.OS === "ios" || Platform.OS === "android") &&
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient &&
    typeof projectId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  return {
    available: () => supported,
    configure: async () => {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("watering", {
          name: "Watering reminders", importance: AndroidImportance.DEFAULT,
        });
      }
    },
    permission: async () => permission(await Notifications.getPermissionsAsync()),
    requestPermission: async () => permission(await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: false, allowProvisional: false },
    })),
    token: async () => {
      if (!supported) throw new Error("Push notifications are unavailable in this build");
      return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    },
    onTokenChange: (listener) => {
      if (!supported) return () => {};
      const subscription = Notifications.addPushTokenListener(listener);
      return () => subscription.remove();
    },
  };
}

export function installForegroundNotificationGuard(
  eligible: (date: string) => Promise<boolean>,
) {
  const seen = new Set<string>();
  let active = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data;
      const date = data?.date;
      let display = false;
      if (active && data?.kind === "watering-streak" && typeof date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(date) && !seen.has(date)) {
        seen.add(date);
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          display = await Promise.race([eligible(date), new Promise<false>((resolve) => {
            timer = setTimeout(() => resolve(false), 1_000);
          })]);
        } catch {
          display = false;
        } finally {
          clearTimeout(timer);
        }
      }
      display = active && display;
      return { shouldShowBanner: display, shouldShowList: display, shouldPlaySound: false, shouldSetBadge: false };
    },
  });
  return () => {
    active = false;
    Notifications.setNotificationHandler(null);
  };
}
