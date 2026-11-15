import { formatGivenTotal } from './ritual';

export type CharityInfo = {
  name: string;
  theme: string;
  description: string;
  link: string;
  programs: readonly string[];
};

export type WateringBundleCount = 2 | 5 | 10;
export const wateringChoices = [
  { bundles: 2, price: '$1' },
  { bundles: 5, price: '$2.50' },
  { bundles: 10, price: '$5' },
] as const;

export type YesterdayImpactData = {
  charity: CharityInfo;
  totalRaisedCents: number;
  answererCount: number;
  watererCount: number;
  myGivenCents?: number | null;
  isDemo: boolean;
};

export function charityAmount(cents: number) {
  return formatGivenTotal(cents, 'USD').replace(/^USD /, '$');
}

export function yesterdayImpactCopy(impact: YesterdayImpactData) {
  if (![impact.answererCount, impact.watererCount, impact.totalRaisedCents]
    .every(value => Number.isSafeInteger(value) && value >= 0)) return 'Yesterday’s impact is unavailable.';
  return `${impact.answererCount} ${impact.answererCount === 1 ? 'person' : 'people'} answered, ${impact.watererCount} watered, ${charityAmount(impact.totalRaisedCents)} raised for ${impact.charity.name}${impact.charity.name.endsWith('.') ? '' : '.'}`;
}

export function privateGivingCopy(cents?: number | null) {
  return typeof cents === 'number' && Number.isSafeInteger(cents) && cents > 0 ? `You gave ${charityAmount(cents)}` : null;
}
