import { snapshotFromVerifiedDay, type AuthoritativeWidgetDay } from "./adapter";
import type { WidgetSyncResult, createWidgetSync } from "./sync";

export function createWidgetSessionBridge(sync: ReturnType<typeof createWidgetSync>) {
  let generation = 0;
  return {
    beginScope() {
      const scope = ++generation;
      const cleared = sync.clear();
      return {
        async publish(day: AuthoritativeWidgetDay | null): Promise<WidgetSyncResult> {
          await cleared;
          if (scope !== generation) return "ignored";
          return sync.publish(snapshotFromVerifiedDay(day));
        },
        close(): Promise<WidgetSyncResult> {
          if (scope !== generation) return Promise.resolve("ignored");
          generation += 1;
          return sync.clear();
        },
      };
    },
  };
}
