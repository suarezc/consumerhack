import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

import { createWidgetSync } from "./sync";

export function createNativeWidgetSync(enabled: boolean) {
  let loaded: Promise<typeof import("./entry") | null> | undefined;
  return createWidgetSync({
    rootUrl: "storytime://",
    load: async () => {
      if (!enabled || Platform.OS !== "ios" || !requireOptionalNativeModule("ExpoWidgets")) return null;
      if (!loaded) {
        loaded = (async () => {
          const { widgetsDirectory } = await import("expo-widgets");
          if (!widgetsDirectory) return null;
          return import("./entry");
        })().catch(() => { loaded = undefined; return null; });
      }
      return (await loaded)?.default ?? null;
    },
    prepare: async (entries) => entries,
  });
}
