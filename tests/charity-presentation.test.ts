import { describe, expect, it } from 'vitest';

import { charityAmount, privateGivingCopy, wateringChoices, yesterdayImpactCopy, type YesterdayImpactData } from '../src/design/charity';

const impact: YesterdayImpactData = {
  charity: { name: 'S.A.C.K.', theme: 'Kindness', description: 'A fixture', link: 'https://simpleacts.org/', programs: ['Kindness anthology'] },
  totalRaisedCents: 650, answererCount: 40, watererCount: 12, myGivenCents: 250, isDemo: true,
};

describe('charity presentation', () => {
  it('offers exactly the approved bundle choices and display prices', () => {
    expect(wateringChoices).toEqual([{ bundles: 2, price: '$1' }, { bundles: 5, price: '$2.50' }, { bundles: 10, price: '$5' }]);
  });

  it('uses distinct-person counts supplied by the server, not fruit or payment counts', () => {
    expect(yesterdayImpactCopy(impact)).toBe('40 people answered, 12 watered, $6.50 raised for S.A.C.K.');
    expect(yesterdayImpactCopy({ ...impact, answererCount: 1, watererCount: 1 })).toContain('1 person answered, 1 watered');
  });

  it('preserves a known zero total and zero activity', () => {
    expect(yesterdayImpactCopy({ ...impact, answererCount: 0, watererCount: 0, totalRaisedCents: 0 })).toContain('0 people answered, 0 watered, $0.00');
    expect(charityAmount(0)).toBe('$0.00');
  });

  it('does not invent money or people for malformed counts and totals', () => {
    for (const invalid of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(yesterdayImpactCopy({ ...impact, answererCount: invalid })).toBe('Yesterday’s impact is unavailable.');
      expect(yesterdayImpactCopy({ ...impact, watererCount: invalid })).toBe('Yesterday’s impact is unavailable.');
      expect(yesterdayImpactCopy({ ...impact, totalRaisedCents: invalid })).toBe('Yesterday’s impact is unavailable.');
      expect(charityAmount(invalid)).toBe('Amount unavailable');
    }
  });

  it('does not infer private giving from public fruit or shared totals', () => {
    for (const absent of [undefined, null, 0, -1, 1.5, NaN, Infinity]) expect(privateGivingCopy(absent)).toBeNull();
    expect(privateGivingCopy(impact.myGivenCents)).toBe('You gave $2.50');
  });

  it('preserves exact cents without floating point dollar arithmetic', () => {
    expect(charityAmount(Number.MAX_SAFE_INTEGER)).toBe('$90,071,992,547,409.91');
  });
});
