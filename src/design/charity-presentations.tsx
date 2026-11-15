import { type ReactNode, useId } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  charityAmount, privateGivingCopy, wateringChoices, yesterdayImpactCopy,
  type CharityInfo, type WateringBundleCount, type YesterdayImpactData,
} from './charity';
import { StoryButton, StoryText } from './primitives';
import { useStoryTime } from './provider';

export type CharityDetailsProps = { charity: CharityInfo; onOpenLink: (url: string) => void };

export function CharityDetails({ charity, onOpenLink }: CharityDetailsProps) {
  const { theme } = useStoryTime();
  return <View style={[styles.panel, { backgroundColor: theme.panel, borderColor: theme.line }]}>
    <StoryText variant="meta" color={theme.paper}>{charity.theme}</StoryText>
    <StoryText color={theme.paper} accessibilityRole="header">{charity.name}</StoryText>
    <StoryText variant="caption" color={theme.paper}>{charity.description}</StoryText>
    <StoryText variant="meta" color={theme.paper}>Programs</StoryText>
    <View style={styles.programs}>
      {charity.programs.map((program, index) => <StoryText key={`${index}:${program}`} variant="caption" color={theme.paper}>· {program}</StoryText>)}
    </View>
    <Pressable accessibilityRole="link" accessibilityLabel={`Visit ${charity.name}`}
      accessibilityHint="Opens the charity’s website" onPress={() => onOpenLink(charity.link)}
      style={({ pressed }) => [styles.link, { borderColor: theme.line, opacity: pressed ? 0.75 : 1 }]}>
      <StoryText variant="meta" color={theme.paper} style={styles.choiceLabel}>Visit {charity.name}</StoryText>
    </Pressable>
  </View>;
}

export type TodayCharitySummaryProps = {
  charity: CharityInfo | null;
  totalRaisedCents: number | null;
  isDemo: boolean;
  onShowDetails: () => void;
  error?: string;
};

export function TodayCharitySummary({ charity, totalRaisedCents, isDemo, onShowDetails, error }: TodayCharitySummaryProps) {
  const { theme } = useStoryTime();
  return <View style={styles.compactSummary}>
    <Pressable accessibilityRole="button" accessibilityLabel={charity ? `About ${charity.name}` : 'About the charity'} disabled={!charity}
      onPress={onShowDetails} style={styles.charityLink}>
      <StoryText variant="caption" color={theme.ink} style={styles.charityName}>{charity ? `For ${charity.name}` : 'Gathering today’s charity…'}</StoryText>
      <StoryText variant="caption" color={theme.ink} style={styles.compactAmount}> · {error ? 'Total unavailable' : totalRaisedCents === null ? 'Gathering paid total…' : `${charityAmount(totalRaisedCents)} today`}</StoryText>
    </Pressable>
    {!!error && <StoryText accessibilityRole="alert" variant="caption" color={theme.ink}>{error}</StoryText>}
    <StoryText variant="caption" color={theme.ink} style={styles.disclosure}>{isDemo ? 'Sample giving · no charge or real charity payout' : 'Sandbox example · gross total, not a real charity payout'}</StoryText>
  </View>;
}

export type WateringBundlesProps = {
  selectedBundles: WateringBundleCount;
  onSelectBundles: (bundles: WateringBundleCount) => void;
  onWater: (bundles: WateringBundleCount) => void;
  canWater: boolean;
  loading?: boolean;
  error?: string;
  isDemo: boolean;
};

export function WateringBundles({ selectedBundles, onSelectBundles, onWater, canWater, loading = false, error, isDemo }: WateringBundlesProps) {
  const { theme } = useStoryTime();
  const id = useId();
  const disabled = !canWater || loading;
  const validSelection = wateringChoices.some(choice => choice.bundles === selectedBundles);
  return <View style={styles.watering}>
    <StoryText variant="caption" color={theme.paper}>Choose a little care for S.A.C.K.</StoryText>
    <View role="group" accessibilityLabel="Watering bundles" style={styles.choices}>
      {wateringChoices.map(choice => {
        const selected = selectedBundles === choice.bundles;
        return <Pressable key={choice.bundles} accessibilityRole="button"
          accessibilityLabel={`${choice.bundles} bundles, ${choice.price} US dollars`}
          aria-pressed={selected} aria-disabled={disabled}
          accessibilityState={{ selected, disabled }} disabled={disabled}
          onPress={() => onSelectBundles(choice.bundles)} style={({ pressed }) => [styles.choice, {
            borderColor: selected ? theme.lantern : theme.line,
            backgroundColor: selected ? theme.wash : 'transparent',
            opacity: disabled ? 0.6 : pressed ? 0.75 : 1,
          }]}>
          <StoryText variant="meta" color={theme.paper} style={styles.choiceLabel}>{choice.bundles} bundles</StoryText>
          <StoryText color={theme.paper} style={styles.choiceLabel}>{choice.price}</StoryText>
          <StoryText variant="meta" color={theme.paper} style={styles.choiceLabel}>{selected ? 'Selected' : ' '}</StoryText>
        </Pressable>;
      })}
    </View>
    <StoryText variant="caption" color={theme.paper}>Each paid bundle adds one fruit. $0.50 per bundle.</StoryText>
    {!canWater && <StoryText nativeID={`${id}-locked`} variant="caption" color={theme.paper}>Answer today’s question to water the tree.</StoryText>}
    {!!error && <StoryText nativeID={`${id}-error`} accessibilityRole="alert" variant="caption" color={theme.paper}>{error}</StoryText>}
    <StoryButton label="Water today's tree for S.A.C.K." loading={loading} disabled={disabled || !validSelection}
      aria-busy={loading}
      accessibilityHint={!canWater ? 'Answer today’s question first. Watering does not require bloom.' : isDemo ? 'Starts a synthetic demo watering' : 'Opens sandbox checkout. Returning from checkout does not confirm payment.'}
      aria-describedby={error ? `${id}-error` : !canWater ? `${id}-locked` : undefined}
      onPress={() => onWater(selectedBundles)} />
    <StoryText variant="caption" color={theme.paper}>{isDemo ? 'Demo watering uses synthetic payments. No real charity payout.' : 'Sandbox checkout to an example account. No real charity payout is established.'}</StoryText>
  </View>;
}

export type YesterdayImpactProps = {
  impact: YesterdayImpactData | null;
  onToday: () => void;
  onOpenLink: (url: string) => void;
  children?: ReactNode;
  error?: string;
  color?: string;
};

export function YesterdayImpact({ impact, onToday, onOpenLink, children, error, color }: YesterdayImpactProps) {
  const { theme } = useStoryTime();
  const ink = color ?? theme.text;
  const ownGiving = impact && !error ? privateGivingCopy(impact.myGivenCents) : null;
  return <View style={styles.yesterday}>
    <StoryText variant="meta" color={ink}>Yesterday · {impact ? impact.isDemo ? 'demo sample impact' : 'sandbox impact' : 'gathering impact'}</StoryText>
    <StoryText variant="title" color={ink} accessibilityRole="header">A little care, together.</StoryText>
    {children}
    {error ? <StoryText accessibilityRole="alert" variant="caption" color={ink}>{error}</StoryText>
      : <StoryText color={ink}>{impact ? yesterdayImpactCopy(impact) : 'Gathering yesterday’s impact…'}</StoryText>}
    {ownGiving && <StoryText variant="caption" color={ink}>{ownGiving}</StoryText>}
    <StoryText variant="caption" color={ink}>Gross sandbox contributions to an example account. No real charity payout is established.</StoryText>
    <StoryButton label="Today" onPress={onToday} />
    {impact && <CharityDetails charity={impact.charity} onOpenLink={onOpenLink} />}
  </View>;
}

const styles = StyleSheet.create({
  panel: { padding: 16, borderWidth: 1, borderRadius: 16, gap: 12 },
  programs: { gap: 8 },
  compactSummary: { gap: 2 },
  charityLink: { minHeight: 32, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  charityName: { fontSize: 16, lineHeight: 22, textDecorationLine: 'underline' },
  compactAmount: { fontSize: 16, lineHeight: 22 },
  disclosure: { fontSize: 12, lineHeight: 17 },
  watering: { gap: 16 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { flexGrow: 1, flexBasis: 82, minHeight: 96, paddingHorizontal: 8, paddingVertical: 12, borderWidth: 1, borderRadius: 12, gap: 4, alignItems: 'center' },
  choiceLabel: { alignSelf: 'stretch', textAlign: 'center' },
  link: { minHeight: 48, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
  yesterday: { gap: 20 },
});
