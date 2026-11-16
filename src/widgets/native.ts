import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

import { createWidgetSync } from "./sync";
import type { WidgetEntry } from "./model";

export function createNativeWidgetSync(enabled: boolean) {
  let loaded: Promise<typeof import("./entry") | null> | undefined;
  let prepare: ((entries: WidgetEntry[]) => Promise<WidgetEntry[]>) | undefined;
  return createWidgetSync({
    rootUrl: "storytime://",
    load: async () => {
      if (!enabled || Platform.OS !== "ios" || !requireOptionalNativeModule("ExpoWidgets")) return null;
      if (!loaded) {
        loaded = (async () => {
          const { widgetsDirectory } = await import("expo-widgets");
          if (!widgetsDirectory) return null;
          const { createAssetPreparer } = await import("./assets");
          prepare = createAssetPreparer(widgetsDirectory);
          return import("./entry");
        })().catch(() => { loaded = undefined; return null; });
      }
      return (await loaded)?.default ?? null;
    },
    prepare: (entries) => prepare ? prepare(entries) : Promise.resolve(entries),
  });
}
