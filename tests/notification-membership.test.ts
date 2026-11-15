import { beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  session: { deviceId: "anonymous-device", treeId: null as string | null },
  memberships: undefined as { treeId: string }[] | undefined,
  refs: [] as { current: unknown }[],
  index: 0,
  effect: null as (() => void | (() => void)) | null,
  dependencies: undefined as unknown[] | undefined,
  cleanup: undefined as (() => void) | undefined,
  setters: [] as ReturnType<typeof vi.fn>[],
  stateIndex: 0,
  foreground: vi.fn(() => () => {}),
  appState: vi.fn(() => ({ remove: vi.fn() })),
  query: vi.fn(),
  mutation: vi.fn(),
}));

vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useRef: (initial: unknown) => {
    const index = harness.index++;
    return harness.refs[index] ??= { current: initial };
  },
  useState: (initial: unknown) => {
    const index = harness.stateIndex++;
    return [initial, harness.setters[index] ??= vi.fn()];
  },
  useEffect: (effect: () => void | (() => void), dependencies: unknown[]) => {
    if (harness.dependencies?.every((value, index) => Object.is(value, dependencies[index]))) return;
    harness.cleanup?.();
    harness.dependencies = dependencies;
    harness.effect = effect;
  },
}));
vi.mock("convex/react", () => {
  const client = { query: harness.query, mutation: harness.mutation };
  return { useConvex: () => client, useQuery: () => harness.memberships };
});
vi.mock("react-native", () => ({ AppState: { addEventListener: harness.appState } }));
vi.mock("@/providers/SessionProvider", () => ({ useSession: () => ({ session: harness.session }) }));
vi.mock("@/services/api", () => ({ api: { trees: { list: "trees:list" }, notifications: {
  preference: "notifications:preference", updatePreference: "notifications:updatePreference", foregroundEligibility: "notifications:foregroundEligibility",
} } }));
vi.mock("@/services/notifications", async () => await import("../src/services/notifications"));
vi.mock("@/services/notificationsRuntime", () => ({
  notificationRuntime: () => ({ available: () => false, onTokenChange: () => () => {} }),
  installForegroundNotificationGuard: harness.foreground,
}));

import { NotificationProvider } from "../src/providers/NotificationProvider";

const preference = { revision: 0, optIn: false, permission: "undetermined", registered: false, available: false };

function render() {
  harness.index = 0;
  harness.stateIndex = 0;
  harness.effect = null;
  const element = NotificationProvider({ children: null });
  if (harness.effect) harness.cleanup = (harness.effect as () => void | (() => void))() ?? undefined;
  return element.props.value;
}

beforeEach(() => {
  harness.cleanup?.();
  vi.clearAllMocks();
  harness.session = { deviceId: "anonymous-device", treeId: null };
  harness.memberships = undefined;
  harness.refs = [];
  harness.setters = [];
  harness.dependencies = undefined;
  harness.cleanup = undefined;
  harness.query.mockResolvedValue(preference);
  harness.mutation.mockResolvedValue({ ...preference, revision: 1 });
});

it("does not sync on fresh install or empty membership, then starts after a verified join", async () => {
  render();
  harness.memberships = [];
  render();
  await Promise.resolve();
  expect(harness.query).not.toHaveBeenCalled();
  expect(harness.mutation).not.toHaveBeenCalled();
  expect(harness.foreground).not.toHaveBeenCalled();
  expect(harness.appState).not.toHaveBeenCalled();

  harness.session.treeId = "joined-tree";
  harness.memberships = [{ treeId: "joined-tree" }];
  render();
  await vi.waitFor(() => expect(harness.mutation).toHaveBeenCalledTimes(1));
  expect(harness.mutation.mock.calls[0][1]).toMatchObject({ optIn: false, expectedRevision: 0 });
  expect(harness.foreground).toHaveBeenCalledTimes(1);
  expect(harness.appState).toHaveBeenCalledTimes(1);
  expect(harness.setters[0]).toHaveBeenLastCalledWith({ deviceId: "anonymous-device", status: { state: "off", optIn: false } });
});

it("does not treat a selected stale tree ID as valid membership", async () => {
  harness.session.treeId = "stale-tree";
  harness.memberships = [];
  const context = render();
  await context.update("out");
  expect(harness.query).not.toHaveBeenCalled();
  expect(harness.mutation).not.toHaveBeenCalled();
  expect(harness.foreground).not.toHaveBeenCalled();
  expect(harness.setters[0]).not.toHaveBeenCalled();
});

it("preserves real synchronization failures after membership is confirmed", async () => {
  harness.memberships = [{ treeId: "joined-tree" }];
  harness.mutation.mockRejectedValue(new Error("Offline"));
  const context = render();
  await vi.waitFor(() => expect(harness.setters[0]).toHaveBeenCalled());
  expect(harness.setters[0].mock.calls.at(-1)?.[0].status.state).toBe("sync_failed");
  await context.update("out");
  expect(harness.setters[0]).toHaveBeenLastCalledWith({ deviceId: "anonymous-device", status: { state: "sync_failed", optIn: false } });
  expect(harness.setters[1]).toHaveBeenCalledWith({ deviceId: "anonymous-device", busy: true, action: "out" });
  expect(harness.setters[1]).toHaveBeenLastCalledWith({ deviceId: "anonymous-device", busy: false, action: "out" });
});
