import "../safe-area.css";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";

import { SessionProvider } from "@/providers/SessionProvider";
import { RitualProvider } from "@/providers/RitualProvider";
import { DataBoundary, DataFailure } from "@/components/screens/Screen";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <SessionProvider>
          <DataBoundary fallback={(retry) => <DataFailure retry={retry} />}>
            <RitualProvider>
              <Stack screenOptions={{ headerShown: false }} />
            </RitualProvider>
          </DataBoundary>
      </SessionProvider>
    </ConvexProvider>
  );
}
