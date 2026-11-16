export type WateringEvent = Readonly<{ id: string; fruitId: string; fruitIds?: readonly string[]; revision: number }>;
export type GivingEvent = Readonly<{ id: string; baselineId: string; givingCount: number; isDemo: boolean }>;
export type WateringDispatch = Readonly<{
  contextId: string | null;
  baselineId: string | null;
  treeEvent: WateringEvent | null;
  feedbackEvent: GivingEvent | null;
}>;

export const emptyWateringDispatch: WateringDispatch = Object.freeze({ contextId: null, baselineId: null, treeEvent: null, feedbackEvent: null });

export function createDemoWateringIntent(createId: () => string) {
  let request: Readonly<{ bundles: 2 | 5 | 10; requestId: string }> | null = null;
  return {
    forBundles(bundles: 2 | 5 | 10) {
      if (!request || request.bundles !== bundles) request = Object.freeze({ bundles, requestId: createId() });
      return request;
    },
    reset() { request = null; },
  };
}

export function createWateringObserver(createBaselineId: () => string) {
  const consumed = new Set<string>();
  const listeners = new Set<() => void>();
  let context: string | null = null;
  let snapshot = emptyWateringDispatch;

  function publish(next: WateringDispatch) {
    snapshot = Object.freeze(next);
    for (const listener of listeners) listener();
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot: () => snapshot,
    reset() {
      context = null;
      if (snapshot !== emptyWateringDispatch) publish(emptyWateringDispatch);
    },
    observe(nextContext: string, confirmedFruitIds: readonly string[], event: WateringEvent | null, givingCount: number, isDemo: boolean) {
      if (context !== nextContext) {
        for (const id of confirmedFruitIds) consumed.add(id);
        if (event) consumed.add(event.id);
        context = nextContext;
        publish({ contextId: nextContext, baselineId: createBaselineId(), treeEvent: null, feedbackEvent: null });
        return;
      }
      if (!event || event.revision !== 1 || consumed.has(event.id)) return;
      const fruitIds = event.fruitIds ?? [event.fruitId];
      if (!fruitIds.length || fruitIds[0] !== event.fruitId || new Set(fruitIds).size !== fruitIds.length || !fruitIds.every((id) => confirmedFruitIds.includes(id))) return;
      consumed.add(event.id);
      const baselineId = snapshot.baselineId!;
      publish({
        contextId: nextContext,
        baselineId,
        treeEvent: Object.freeze({ ...event, ...(event.fruitIds ? { fruitIds: Object.freeze([...fruitIds]) } : {}) }),
        feedbackEvent: Number.isSafeInteger(givingCount) && givingCount >= 0
          ? Object.freeze({ id: event.id, baselineId, givingCount, isDemo }) : null,
      });
    },
    consumeFeedback(id: string) {
      if (snapshot.feedbackEvent?.id !== id) return;
      publish({ ...snapshot, feedbackEvent: null });
    },
  };
}
