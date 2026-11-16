import { buildWidgetTimeline, emptyWidget, isWidgetSnapshot, type WidgetEntry, type WidgetProps, type WidgetSnapshot } from "./model";

export type WidgetTransport = {
  updateTimeline: (entries: WidgetEntry[]) => void;
  updateSnapshot: (props: WidgetProps) => void;
};

export type WidgetSyncResult = "updated" | "ignored" | "cleared" | "unavailable";

export function createWidgetSync(options: {
  load: () => Promise<WidgetTransport | null>;
  rootUrl: string;
  prepare: (entries: WidgetEntry[]) => Promise<WidgetEntry[]>;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  let generation = 0;
  let latestAsOf = -1;
  let lastFingerprint = "";
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T,>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);
    queue = next.catch(() => undefined);
    return next;
  };

  function clear(): Promise<WidgetSyncResult> {
    const requestedGeneration = ++generation;
    latestAsOf = -1;
    lastFingerprint = "";
    const clearing = (async (): Promise<WidgetSyncResult> => {
      try {
        const transport = await options.load();
        if (requestedGeneration !== generation) return "ignored";
        if (!transport) return "unavailable";
        transport.updateSnapshot(emptyWidget(options.rootUrl));
        return "cleared";
      } catch {
        return "unavailable";
      }
    })();
    queue = clearing;
    return clearing;
  }

  return {
    clear,
    publish(value: WidgetSnapshot | null): Promise<WidgetSyncResult> {
      if (!isWidgetSnapshot(value)) return clear();
      const snapshot = { ...value, giving: { ...value.giving } };
      const requestedGeneration = generation;
      return enqueue(async () => {
        if (requestedGeneration !== generation || snapshot.asOf < latestAsOf) return "ignored";
        const fingerprint = JSON.stringify(snapshot);
        if (fingerprint === lastFingerprint) return "ignored";
        try {
          const transport = await options.load();
          if (!transport) return "unavailable";
          const entries = buildWidgetTimeline(snapshot, now(), options.rootUrl);
          const prepared = await options.prepare(entries);
          if (requestedGeneration !== generation) return "ignored";
          transport.updateTimeline(prepared);
          latestAsOf = snapshot.asOf;
          lastFingerprint = fingerprint;
          return "updated";
        } catch {
          return "unavailable";
        }
      });
    },
  };
}
