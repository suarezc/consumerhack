export const TIMELINE_DURATION_MS = 15000;
export const RESPONSE_TIMES = [0.12, 0.22, 0.31, 0.4, 0.5, 0.6, 0.7, 0.82];

export type SampleAction =
  | { id: string; at: number; type: "response" }
  | { id: string; at: number; type: "bundles"; bundles: 2 | 5 | 10 };

export function timelineSnapshot(
  progress: number,
  actions: readonly SampleAction[],
) {
  const timeOfDay = Math.min(1, Math.max(0, progress));
  const responses = RESPONSE_TIMES.filter((at) => at <= timeOfDay).map(
    (_, i) => ({ id: `sample-response-${i + 1}`, golden: false, mine: false }),
  );
  let lightBundles = 0;
  let lightEvent: {
    id: string;
    revision: number;
    lightBundles: number;
  } | null = null;
  for (const action of actions) {
    if (action.at > timeOfDay) continue;
    if (action.type === "response")
      responses.push({ id: action.id, golden: false, mine: true });
    else {
      lightBundles += action.bundles;
      lightEvent = { id: action.id, revision: 1, lightBundles: action.bundles };
    }
  }
  return {
    timeOfDay,
    stage:
      timeOfDay < 0.08
        ? "Seed"
        : timeOfDay < 0.3
          ? "Sapling"
          : timeOfDay < 0.78
            ? "Branching"
            : "Mature",
    fruits: responses,
    lightBundles,
    goldenLightBundles: 0,
    lightEvent,
  };
}
