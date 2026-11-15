export type StreakStatus = 'current' | 'at_risk' | 'none';
export type StreakState = { count: number; status: StreakStatus };
export type RitualSummary = {
  clock: { date: string; opensAt: number; nextBoundaryAt: number; now: number };
  answer: StreakState;
  giving: StreakState & { longest: number; totalCents: number };
  currency: 'USD';
  isDemo: boolean;
  undatedPaidCount: number;
};
export type ViewerFruit = {
  fruitId: string;
  date: string;
  golden: boolean;
  milestone: 3 | 7 | 30 | null;
  isMine: boolean;
  source: 'whop' | 'demo';
  paidAt: number;
};
export type ConfirmedGivingEvent = Readonly<{
  id: string;
  baselineId: string;
  givingCount: number;
  isDemo: boolean;
}>;

export function formatGivenTotal(totalCents: number, currency: string) {
  if (currency !== 'USD' || !Number.isSafeInteger(totalCents) || totalCents < 0) return 'Amount unavailable';
  const digits = String(totalCents).padStart(3, '0');
  const dollars = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `USD ${dollars}.${digits.slice(-2)}`;
}

export function streakCopy(state: StreakState, kind: 'answer' | 'giving') {
  if (state.status === 'none' || !Number.isSafeInteger(state.count) || state.count < 1) {
    return {
      label: kind === 'answer' ? 'A moment to answer' : 'A little care',
      detail: '',
      description: `No current ${kind === 'answer' ? 'answer' : 'giving'} streak. There is room to begin again.`,
    };
  }
  const days = `${state.count} ${state.count === 1 ? 'day' : 'days'}`;
  const activity = kind === 'answer' ? 'answering' : 'giving';
  return {
    label: `${days} ${activity}`,
    detail: state.status === 'at_risk' ? 'Continue today' : '',
    description: `${days} of ${activity}. ${state.status === 'at_risk'
      ? kind === 'answer' ? 'Not yet answered this ritual day. There is still time today.' : 'No paid watering confirmed this ritual day. There is still time today.'
      : 'Continued this ritual day.'}`,
  };
}

export function claimGivingEvent(baselineId: string | null, event: ConfirmedGivingEvent | null, seen: Set<string>) {
  if (!baselineId || !event || event.baselineId !== baselineId || !event.id || seen.has(event.id)
    || !Number.isSafeInteger(event.givingCount) || event.givingCount < 1 || typeof event.isDemo !== 'boolean') return null;
  seen.add(event.id);
  return { ...event };
}

export function describeFruit(fruit: ViewerFruit) {
  const milestone = fruit.golden && fruit.milestone ? ` for the ${fruit.milestone}-day giving milestone` : '';
  return `${fruit.source === 'demo' ? 'Sample ' : ''}${fruit.golden ? 'golden fruit' : 'fruit'}${milestone}`;
}
