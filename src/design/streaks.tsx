import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, StyleSheet, View } from 'react-native';

import { StoryText } from './primitives';
import { useStoryTime } from './provider';
import { RitualMark } from './RitualMark';
import { claimGivingEvent, formatGivenTotal, streakCopy, type ConfirmedGivingEvent, type RitualSummary } from './ritual';

export type TodayStreaksProps = { summary: RitualSummary | null; color?: string; compact?: boolean };

export function TodayStreaks({ summary, color, compact = false }: TodayStreaksProps) {
  const { theme } = useStoryTime();
  const ink = color ?? theme.text;
  if (!summary) return <StoryText variant="meta" color={ink} accessibilityLabel="Loading your ritual days">Gathering your days…</StoryText>;
  if (compact) {
    const copy = streakCopy(summary.answer, 'answer');
    return <View style={styles.inline}><RitualMark kind="fruit" /><StoryText variant="caption" color={ink}
      accessibilityLabel={`${copy.description}`} style={{ fontSize: 14, lineHeight: 20 }}>{copy.label}</StoryText></View>;
  }
  return <View style={[styles.group, styles.today]}>
    <View style={styles.streakRow}>
      {(['giving', 'answer'] as const).map((kind) => {
        const copy = streakCopy(summary[kind], kind);
        return <View key={kind} style={styles.streak}>
          <View style={styles.inline}>
            <RitualMark kind={kind === 'answer' ? 'blossom' : 'fruit'} />
            <StoryText variant="meta" color={ink} accessibilityLabel={`${copy.description}`}
              style={styles.label}>{copy.label}</StoryText>
          </View>
          {!!copy.detail && <StoryText variant="meta" color={ink} style={styles.continue}>{copy.detail}</StoryText>}
        </View>;
      })}
    </View>
  </View>;
}

export type GroveGivingSummaryProps = { summary: RitualSummary | null; color?: string };

export function GroveGivingSummary({ summary, color }: GroveGivingSummaryProps) {
  const { theme } = useStoryTime();
  const ink = color ?? theme.text;
  if (!summary) return <StoryText variant="meta" color={ink}>Gathering your giving history…</StoryText>;
  const longest = Number.isSafeInteger(summary.giving.longest) && summary.giving.longest >= 0 ? summary.giving.longest : null;
  const total = formatGivenTotal(summary.giving.totalCents, summary.currency);
  return <View style={styles.group}>
    <View style={styles.historyRow}>
      <View style={styles.historyStat}>
        <StoryText variant="meta" color={ink}>Longest giving</StoryText>
        <StoryText color={ink} accessibilityLabel={`Longest giving streak: ${longest === null ? 'unavailable' : `${longest} ${longest === 1 ? 'day' : 'days'}`}`}>
          {longest === null ? 'Unavailable' : `${longest} ${longest === 1 ? 'day' : 'days'}`}
        </StoryText>
      </View>
      <View style={styles.historyStat}>
        <StoryText variant="meta" color={ink}>Total given</StoryText>
        <StoryText color={ink} accessibilityLabel={`Total given: ${total}`}>{total}</StoryText>
      </View>
    </View>
    {summary.undatedPaidCount > 0 && <StoryText variant="caption" color={ink}
      accessibilityLabel={`${summary.undatedPaidCount} confirmed ${summary.undatedPaidCount === 1 ? 'payment is' : 'payments are'} awaiting a verified date. Included in the total, not in streaks or dated fruit.`}>
      Some confirmed giving awaits a verified date. It is included in the total, not in streaks or dated fruit.
    </StoryText>}
  </View>;
}

export type GivingFeedbackProps = {
  baselineId: string | null;
  event: ConfirmedGivingEvent | null;
  onConsumed: (id: string) => void;
  color?: string;
};

export function GivingFeedback(props: GivingFeedbackProps) {
  return <GivingFeedbackSession key={props.baselineId ? `ready:${props.baselineId}` : 'unready'} {...props} />;
}

function GivingFeedbackSession({ baselineId, event, onConsumed, color }: GivingFeedbackProps) {
  const { theme, reducedMotion } = useStoryTime();
  const seen = useRef(new Set<string>());
  const [notice, setNotice] = useState<ConfirmedGivingEvent | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const eventId = event?.id;
  const eventBaseline = event?.baselineId;
  const givingCount = event?.givingCount;
  const isDemo = event?.isDemo;

  useEffect(() => {
    if (!eventId || !eventBaseline || givingCount === undefined || isDemo === undefined) return;
    const timer = setTimeout(() => {
      const accepted = claimGivingEvent(baselineId, { id: eventId, baselineId: eventBaseline, givingCount, isDemo }, seen.current);
      if (!accepted) return;
      setNotice(accepted);
      onConsumed(accepted.id);
    }, 0);
    return () => clearTimeout(timer);
  }, [baselineId, eventId, eventBaseline, givingCount, isDemo, onConsumed]);

  const text = notice ? 'Thank you. The tree is watered.' : '';

  useEffect(() => {
    if (Platform.OS === 'ios' && text) AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: true, priority: 'low' });
  }, [notice?.id, text]);

  useEffect(() => {
    if (!notice) return;
    let active = true;
    opacity.setValue(0);
    const entrance = Animated.timing(opacity, { toValue: 1, duration: reducedMotion ? 0 : 160, useNativeDriver: true });
    entrance.start();
    let exit: Animated.CompositeAnimation | undefined;
    const timer = setTimeout(() => {
      exit = Animated.timing(opacity, { toValue: 0, duration: reducedMotion ? 0 : 160, useNativeDriver: true });
      exit.start(({ finished }) => {
        if (active && finished) setNotice(null);
      });
    }, 3500);
    return () => {
      active = false;
      clearTimeout(timer);
      entrance.stop();
      exit?.stop();
    };
  }, [notice, opacity, reducedMotion]);

  return <View aria-live={Platform.OS === 'web' ? 'polite' : undefined} style={styles.feedback}>
    <Animated.View style={{ opacity }}>
      <StoryText key={notice?.id ?? 'empty'} variant="meta" color={color ?? theme.text}
        accessibilityLiveRegion={Platform.OS === 'android' ? 'polite' : undefined}>{text}</StoryText>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: 12 },
  today: { width: '100%', maxWidth: 480 },
  streakRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  streak: { minWidth: 140, flex: 1, gap: 4 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flexShrink: 1 },
  continue: { marginLeft: 26 },
  historyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  historyStat: { gap: 4 },
  feedback: { minHeight: 22, justifyContent: 'center' },
});
