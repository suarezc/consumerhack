export type WateringEvent = { id: string; fruitId: string; revision: 1 };

export function createWateringObserver() {
  const baselines = new Set<string>();
  const consumed = new Set<string>();

  return {
    observe(scope: string, confirmedFruitIds: readonly string[], event: WateringEvent | null): WateringEvent | null {
      if (!baselines.has(scope)) {
        for (const id of confirmedFruitIds) consumed.add(id);
        if (event) consumed.add(event.id);
        baselines.add(scope);
        return null;
      }
      if (!event || event.revision !== 1 || !confirmedFruitIds.includes(event.fruitId) || consumed.has(event.id)) return null;
      consumed.add(event.id);
      return event;
    },
  };
}
