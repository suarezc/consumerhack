import type { Notification, NotificationHandler, NotificationPermissionsStatus } from "expo-notifications";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  os: "ios",
  handler: null as NotificationHandler | null,
  permission: vi.fn(),
  request: vi.fn(),
  token: vi.fn(),
  remove: vi.fn(),
  channel: vi.fn(),
}));

vi.mock("react-native", () => ({ Platform: { get OS() { return native.os; } } }));
vi.mock("expo-constants", () => ({
  default: { executionEnvironment: "standalone", expoConfig: { extra: { eas: { projectId: "11111111-1111-4111-8111-111111111111" } } } },
  ExecutionEnvironment: { StoreClient: "storeClient" },
}));
vi.mock("expo-notifications", () => ({
  AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
  setNotificationHandler: (handler: NotificationHandler | null) => { native.handler = handler; },
  getPermissionsAsync: native.permission,
  requestPermissionsAsync: native.request,
  getExpoPushTokenAsync: native.token,
  setNotificationChannelAsync: native.channel,
  addPushTokenListener: () => ({ remove: native.remove }),
}));

import { installForegroundNotificationGuard, notificationRuntime } from "../src/services/notificationsRuntime";
import { notificationRuntime as webRuntime } from "../src/services/notificationsRuntime.web";

const notification = (date = "2026-11-15") => ({
  request: { identifier: "fixture", content: { data: { kind: "watering-streak", date } } },
}) as unknown as Notification;

const deniedBehavior = { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };

beforeEach(() => {
  vi.useFakeTimers();
  native.os = "ios";
  native.handler = null;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("native foreground permission guard", () => {
  it("returns suppression within one second when eligibility never resolves", async () => {
    const eligible = vi.fn(() => new Promise<boolean>(() => {}));
    installForegroundNotificationGuard(eligible);
    const result = native.handler!.handleNotification(notification());
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await result).toEqual(deniedBehavior);
    expect(eligible).toHaveBeenCalledWith("2026-11-15");
  });

  it("ignores a late true completion after the deadline", async () => {
    let resolve!: (value: boolean) => void;
    installForegroundNotificationGuard(() => new Promise<boolean>((done) => { resolve = done; }));
    const result = native.handler!.handleNotification(notification());
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await result).toEqual(deniedBehavior);
    resolve(true);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await result).toEqual(deniedBehavior);
  });

  it("fails closed on rejection and suppresses duplicate dates", async () => {
    const eligible = vi.fn(async () => { throw new Error("Offline"); });
    installForegroundNotificationGuard(eligible);
    expect(await native.handler!.handleNotification(notification())).toEqual(deniedBehavior);
    expect(await native.handler!.handleNotification(notification())).toEqual(deniedBehavior);
    expect(eligible).toHaveBeenCalledTimes(1);
  });

  it("allows an eligible real alert without sound or badges, and denies after cleanup", async () => {
    let resolve!: (value: boolean) => void;
    const cleanup = installForegroundNotificationGuard(() => new Promise<boolean>((done) => { resolve = done; }));
    const oldHandler = native.handler!;
    const result = oldHandler.handleNotification(notification());
    cleanup();
    resolve(true);
    expect(await result).toEqual(deniedBehavior);
    expect(native.handler).toBeNull();
    installForegroundNotificationGuard(async () => true);
    expect(await native.handler!.handleNotification(notification())).toEqual({
      ...deniedBehavior, shouldShowBanner: true, shouldShowList: true,
    });
  });

  it("does not query eligibility for unrecognized notification payloads", async () => {
    const eligible = vi.fn(async () => true);
    installForegroundNotificationGuard(eligible);
    expect(await native.handler!.handleNotification(notification("not-a-date"))).toEqual(deniedBehavior);
    expect(eligible).not.toHaveBeenCalled();
  });
});

describe("native permission adapter", () => {
  it("honors granular iOS alert permission and denies provisional/ephemeral authorization", async () => {
    const runtime = notificationRuntime();
    expect(runtime.available()).toBe(true);
    for (const [status, allowsAlert, expected] of [
      [0, null, "undetermined"], [1, false, "denied"], [2, true, "granted"],
      [2, false, "denied"], [3, true, "denied"], [4, true, "denied"],
    ] as const) {
      native.permission.mockResolvedValue({ ios: { status, allowsAlert } } as NotificationPermissionsStatus);
      expect(await runtime.permission()).toBe(expected);
    }
    native.request.mockResolvedValue({ ios: { status: 2, allowsAlert: true } });
    expect(await runtime.requestPermission()).toBe("granted");
    expect(native.request).toHaveBeenCalledWith({ ios: { allowAlert: true, allowBadge: false, allowSound: false, allowProvisional: false } });
  });

  it("registers the real project token and removes token listeners", async () => {
    const runtime = notificationRuntime();
    native.token.mockResolvedValue({ data: "ExpoPushToken[native_test_token]" });
    expect(await runtime.token()).toBe("ExpoPushToken[native_test_token]");
    expect(native.token).toHaveBeenCalledWith({ projectId: "11111111-1111-4111-8111-111111111111" });
    runtime.onTokenChange(() => {})();
    expect(native.remove).toHaveBeenCalledTimes(1);
  });

  it("creates the Android channel and maps denied permission without reprompting", async () => {
    native.os = "android";
    const runtime = notificationRuntime();
    await runtime.configure();
    expect(native.channel).toHaveBeenCalledWith("watering", { name: "Watering reminders", importance: 3 });
    native.permission.mockResolvedValue({ granted: false, status: "denied", canAskAgain: true });
    expect(await runtime.permission()).toBe("denied");
  });

  it("keeps web explicitly unavailable and never fabricates tokens", async () => {
    expect(webRuntime().available()).toBe(false);
    await expect(webRuntime().token()).rejects.toThrow("unavailable");
  });
});
