import { expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({ ConvexReactClient: class {}, ConvexProvider: "ConvexProvider" }));
vi.mock("expo-router", () => ({ Stack: "Stack" }));
vi.mock("@/providers/SessionProvider", () => ({ SessionProvider: "SessionProvider" }));
vi.mock("@/providers/RitualProvider", () => ({ RitualProvider: "RitualProvider" }));
vi.mock("@/providers/NotificationProvider", () => ({ NotificationProvider: "NotificationProvider" }));
vi.mock("@/components/screens/Screen", () => ({ DataBoundary: "DataBoundary", DataFailure: "DataFailure" }));

import RootLayout from "../src/app/_layout";

it("contains membership and ritual query failures in the retry boundary", () => {
  const root = RootLayout();
  const session = root.props.children;
  expect(session.type).toBe("SessionProvider");
  const boundary = session.props.children;
  expect(boundary.type).toBe("DataBoundary");
  const notifications = boundary.props.children;
  expect(notifications.type).toBe("NotificationProvider");
  expect(notifications.props.children.type).toBe("RitualProvider");
  const retry = vi.fn();
  const fallback = boundary.props.fallback(retry);
  expect(fallback.type).toBe("DataFailure");
  fallback.props.retry();
  expect(retry).toHaveBeenCalledOnce();
});
