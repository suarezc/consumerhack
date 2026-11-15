export type LightEvent = Readonly<{ id: string; revision: number; lightBundles: number }>;
export type GivingNotice = Readonly<{ id: string; baselineId: string; givingCount: number; isDemo: boolean }>;
export type GivingDispatch = Readonly<{
  contextId: string | null;
  baselineId: string | null;
  treeEvent: LightEvent | null;
  feedbackEvent: GivingNotice | null;
}>;

export const emptyGivingDispatch: GivingDispatch = Object.freeze({ contextId: null, baselineId: null, treeEvent: null, feedbackEvent: null });

export function createGivingObserver(createBaselineId: () => string) {
  const consumed = new Set<string>();
  const listeners = new Set<() => void>();
  let context: string | null = null;
  let snapshot = emptyGivingDispatch;

  function publish(next: GivingDispatch) {
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
      if (snapshot !== emptyGivingDispatch) publish(emptyGivingDispatch);
    },
    observe(nextContext: string, confirmedLightBundles: number, event: LightEvent | null, givingCount: number, isDemo: boolean) {
      if (context !== nextContext) {
        if (event) consumed.add(event.id);
        context = nextContext;
        publish({ contextId: nextContext, baselineId: createBaselineId(), treeEvent: null, feedbackEvent: null });
        return;
      }
      if (!event || event.revision !== 2 || consumed.has(event.id) || !Number.isSafeInteger(event.lightBundles) || event.lightBundles < 1 || event.lightBundles > 200 ||
        !Number.isSafeInteger(confirmedLightBundles) || confirmedLightBundles < event.lightBundles) return;
      consumed.add(event.id);
      const baselineId = snapshot.baselineId!;
      publish({
        contextId: nextContext,
        baselineId,
        treeEvent: Object.freeze({ id: event.id, revision: event.revision, lightBundles: event.lightBundles }),
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
