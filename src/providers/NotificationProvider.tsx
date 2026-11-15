import { useConvex } from "convex/react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";

import { useSession } from "@/providers/SessionProvider";
import { api } from "@/services/api";
import { createNotificationService, type NotificationStatus } from "@/services/notifications";
import { installForegroundNotificationGuard, notificationRuntime } from "@/services/notificationsRuntime";

type ReminderAction = "in" | "out" | "retry";
const NotificationContext = createContext<{
  status: NotificationStatus | null;
  busy: boolean;
  lastAction: ReminderAction | null;
  update: (action: ReminderAction) => Promise<void>;
} | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const deviceId = session?.deviceId;
  const client = useConvex();
  const controller = useRef<ReturnType<typeof createNotificationService> | null>(null);
  const request = useRef(0);
  const explicitPending = useRef(false);
  const [result, setResult] = useState<{ deviceId: string; status: NotificationStatus } | null>(null);
  const [operation, setOperation] = useState<{ deviceId: string; busy: boolean; action: ReminderAction } | null>(null);

  useEffect(() => {
    if (!deviceId) return;
    let active = true;
    const service = createNotificationService(notificationRuntime(), {
      preference: () => client.query(api.notifications.preference, { deviceId }),
      update: (value) => client.mutation(api.notifications.updatePreference, { deviceId, ...value }),
    });
    controller.current = service;
    request.current++;
    explicitPending.current = false;
    const receive = (status: NotificationStatus) => {
      if (active && !explicitPending.current) setResult({ deviceId, status });
    };
    void service.reconcile().then(receive);
    const removeTokens = service.listen(receive);
    const removeForeground = installForegroundNotificationGuard(async (date) =>
      service.allowsForeground() && await client.query(api.notifications.foregroundEligibility, { deviceId, date }));
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void service.reconcile().then(receive);
    });
    return () => {
      active = false;
      appState.remove();
      removeTokens();
      removeForeground();
      service.dispose();
      if (controller.current === service) controller.current = null;
    };
  }, [client, deviceId]);

  async function update(action: ReminderAction) {
    const service = controller.current;
    if (!service || !deviceId) return;
    const version = ++request.current;
    explicitPending.current = true;
    setOperation({ deviceId, busy: true, action });
    try {
      const status = await (action === "in" ? service.optIn() : action === "out" ? service.optOut() : service.reconcile());
      if (controller.current === service && request.current === version) setResult({ deviceId, status });
    } catch {
      if (controller.current === service && request.current === version) setResult({ deviceId, status: { state: "sync_failed", optIn: action === "in" } });
    } finally {
      if (controller.current === service && request.current === version) {
        explicitPending.current = false;
        setOperation({ deviceId, busy: false, action });
      }
    }
  }

  return <NotificationContext.Provider value={{
    status: result !== null && result.deviceId === deviceId ? result.status : null,
    busy: operation !== null && operation.deviceId === deviceId && operation.busy,
    lastAction: operation !== null && operation.deviceId === deviceId ? operation.action : null,
    update,
  }}>{children}</NotificationContext.Provider>;
}

export function useReminders() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error("NotificationProvider is required");
  return value;
}
