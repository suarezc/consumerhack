import { describe, expect, it } from 'vitest';

import { claimGivingEvent, describeFruit, formatGivenTotal, streakCopy, type ConfirmedGivingEvent, type ViewerFruit } from '../src/design/ritual';

const event: ConfirmedGivingEvent = { id: 'opaque-ledger-row', baselineId: 'session-a', givingCount: 4, isDemo: true };
const fruit: ViewerFruit = { fruitId: 'historical-row', date: '2026-11-13', golden: true, milestone: 3, isMine: true, source: 'whop', paidAt: 1794556800000 };

describe('confirmed giving presentation', () => {
  it('ignores hydration, null and mismatched baselines without claiming IDs', () => {
    const seen = new Set<string>();
    expect(claimGivingEvent(null, event, seen)).toBeNull();
    expect(claimGivingEvent('session-b', event, seen)).toBeNull();
    expect(claimGivingEvent('session-a', null, seen)).toBeNull();
    expect(seen.size).toBe(0);
  });

  it('claims a post-baseline immutable event once without mutating the shared event', () => {
    const shared = Object.freeze({ ...event, revision: 1 });
    const seen = new Set<string>();
    expect(claimGivingEvent('session-a', shared, seen)).toEqual(shared);
    expect(shared).toEqual({ ...event, revision: 1 });
    const revised = { ...shared, givingCount: 5, revision: 2 };
    expect(claimGivingEvent('session-a', revised, seen)).toBeNull();
    expect(seen.size).toBe(1);
  });

  it('accepts another canonical ID with the same supplied day count', () => {
    const seen = new Set<string>();
    claimGivingEvent('session-a', event, seen);
    expect(claimGivingEvent('session-a', { ...event, id: 'second-row' }, seen)?.givingCount).toBe(4);
  });

  it('does not present invalid giving counts', () => {
    for (const givingCount of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(claimGivingEvent('session-a', { ...event, givingCount }, new Set())).toBeNull();
    }
  });
});

describe('quiet summary copy', () => {
  it('keeps the existing at-risk count without declaring a broken streak', () => {
    const copy = streakCopy({ count: 3, status: 'at_risk' }, 'giving');
    expect(copy.label).toBe('3 days giving');
    expect(copy.detail).toBe('Continue today');
    expect(copy.description).toContain('No paid watering confirmed this ritual day');
    expect(copy.description).not.toMatch(/broken|failed/i);
  });

  it('uses supplied current/none states without a date calculation', () => {
    expect(streakCopy({ count: 1, status: 'current' }, 'answer')).toMatchObject({ label: '1 day answering', detail: '' });
    expect(streakCopy({ count: 0, status: 'none' }, 'giving').label).toBe('A little care');
  });
});

describe('confirmed USD totals', () => {
  it('preserves exact cent values without choosing a checkout amount', () => {
    expect(formatGivenTotal(0, 'USD')).toBe('USD 0.00');
    expect(formatGivenTotal(50, 'USD')).toBe('USD 0.50');
    expect(formatGivenTotal(150, 'USD')).toBe('USD 1.50');
    expect(formatGivenTotal(123456, 'USD')).toBe('USD 1,234.56');
    expect(formatGivenTotal(Number.MAX_SAFE_INTEGER, 'USD')).toBe('USD 90,071,992,547,409.91');
  });

  it('refuses unsupported currencies and invalid money instead of guessing', () => {
    expect(formatGivenTotal(100, 'JPY')).toBe('Amount unavailable');
    for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(formatGivenTotal(value, 'USD')).toBe('Amount unavailable');
  });
});

describe('historical fruit', () => {
  it('uses only that fruit’s supplied golden/milestone metadata', () => {
    expect(describeFruit(fruit)).toBe('golden fruit for the 3-day giving milestone');
    expect(describeFruit({ ...fruit, golden: false, milestone: null })).toBe('fruit');
    expect(describeFruit({ ...fruit, golden: true, milestone: 7, source: 'demo' })).toBe('Sample golden fruit for the 7-day giving milestone');
    expect(describeFruit({ ...fruit, milestone: 30 })).toBe('golden fruit for the 30-day giving milestone');
  });
});
