import { describe, expect, it } from "vitest";
import {
  createNotificationService, type NotificationBackend, type NotificationPreference, type NotificationRuntime,
} from "../src/services/notifications";

function fixture() {
  let preference: NotificationPreference = {
    revision: 0, optIn: false, permission: "undetermined", registered: false, available: true,
  };
  let prompts = 0;
  let token = "ExpoPushToken[client_test_token]";
  let permission: "granted" | "denied" | "undetermined" = "undetermined";
  let listener: (() => void) | undefined;
  const updates: Parameters<NotificationBackend["update"]>[0][] = [];
  const runtime: NotificationRuntime = {
    available: () => true,
    configure: async () => {},
    permission: async () => permission,
    requestPermission: async () => { prompts++; permission = "granted"; return permission; },
    token: async () => token,
    onTokenChange: (callback) => { listener = callback; return () => { listener = undefined; }; },
  };
  const backend: NotificationBackend = {
    preference: async () => preference,
    update: async (value) => {
      expect(value.expectedRevision).toBe(preference.revision);
      updates.push(value);
      preference = { ...preference, ...value, revision: preference.revision + 1, registered: !!value.token && value.optIn };
      return preference;
    },
  };
  return {
    runtime, backend, updates, prompts: () => prompts, preference: () => preference,
    permission: (value: typeof permission) => { permission = value; },
    token: (value: string) => { token = value; },
    rotate: () => listener?.(),
  };
}

describe("explicit notification consent", () => {
  it("never prompts on startup, only on explicit opt-in", async () => {
    const f = fixture();
    const service = createNotificationService(f.runtime, f.backend);
    expect(await service.reconcile()).toEqual({ state: "off", optIn: false });
    expect(f.prompts()).toBe(0);
    expect(await service.optIn()).toEqual({ state: "registered", optIn: true });
    expect(f.prompts()).toBe(1);
    expect(await service.optOut()).toEqual({ state: "off", optIn: false });
    expect(f.updates.at(-1)?.token).toBeUndefined();
    expect(service.allowsForeground()).toBe(false);
  });

  it("clears a token on denied permission and never re-prompts denial", async () => {
    const f = fixture();
    const service = createNotificationService(f.runtime, f.backend);
    await service.optIn();
    f.permission("denied");
    expect(await service.reconcile()).toEqual({ state: "denied", optIn: true });
    expect(f.updates.at(-1)?.token).toBeUndefined();
    await service.optIn();
    expect(f.prompts()).toBe(1);
  });

  it("invalidates old registrations if token acquisition fails", async () => {
    const f = fixture();
    const service = createNotificationService(f.runtime, f.backend);
    await service.optIn();
    f.runtime.token = async () => { throw new Error("private token error"); };
    expect(await service.reconcile()).toEqual({ state: "registration_failed", optIn: true });
    expect(f.updates.at(-1)?.token).toBeUndefined();
  });

  it("does not register a late token after opt-out", async () => {
    const f = fixture();
    let resolve!: (token: string) => void;
    let started!: () => void;
    const waiting = new Promise<void>((done) => { started = done; });
    f.permission("granted");
    f.runtime.token = () => { started(); return new Promise<string>((done) => { resolve = done; }); };
    const service = createNotificationService(f.runtime, f.backend);
    const optIn = service.optIn();
    await waiting;
    const optOut = service.optOut();
    resolve("ExpoPushToken[late_private_token]");
    await optIn;
    await optOut;
    expect(f.updates).toHaveLength(1);
    expect(f.preference().optIn).toBe(false);
    expect(f.preference().registered).toBe(false);
  });

  it("re-registers rotated tokens and cleans up its listener", async () => {
    const f = fixture();
    const service = createNotificationService(f.runtime, f.backend);
    await service.optIn();
    let done!: () => void;
    const handled = new Promise<void>((resolve) => { done = resolve; });
    const cleanup = service.listen(() => done());
    f.token("ExpoPushToken[rotated_test_token]");
    f.rotate();
    await handled;
    expect(f.updates.at(-1)?.token).toBe("ExpoPushToken[rotated_test_token]");
    cleanup();
    f.rotate();
    expect(f.updates).toHaveLength(2);
  });

  it("reports unsupported native/provider paths and failed opt-out honestly", async () => {
    const f = fixture();
    f.runtime.available = () => false;
    const service = createNotificationService(f.runtime, f.backend);
    expect(await service.optIn()).toEqual({ state: "unavailable", optIn: true });
    expect(f.prompts()).toBe(0);
    expect(f.preference().registered).toBe(false);
    f.backend.update = async () => { throw new Error("offline"); };
    expect(await service.optOut()).toEqual({ state: "sync_failed", optIn: false });
    expect(service.allowsForeground()).toBe(false);
  });
});
