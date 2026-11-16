import { type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { StoryButton, StoryText } from './primitives';
import { useStoryTime } from './provider';
import { RitualMark } from './RitualMark';
import { describeFruit, type ViewerFruit } from './ritual';
import { themeAt } from './theme';

export type OnboardingIntroProps = {
  title: string;
  description: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  loading?: boolean;
  disabled?: boolean;
  error?: string;
  children?: ReactNode;
};

export function OnboardingIntro({ title, description, primaryLabel, onPrimary,
  secondaryLabel, onSecondary, loading, disabled, error, children }: OnboardingIntroProps) {
  const { theme } = useStoryTime();
  return <View style={styles.intro}>
    <StoryText variant="meta">StoryTime · a daily ritual</StoryText>
    <Image source={require('../../assets/art/tree.png')} style={styles.introTree} accessible={false} resizeMode="contain" />
    <View style={styles.introWords}>
      <StoryText variant="question" accessibilityRole="header">{title}</StoryText>
      <StoryText>{description}</StoryText>
    </View>
    {children}
    <View style={styles.actions}>
      {!!error && <StoryText accessibilityRole="alert" variant="caption">{error}</StoryText>}
      <StoryButton label={primaryLabel} onPress={onPrimary} loading={loading} disabled={disabled} />
      {!!secondaryLabel && !!onSecondary && <StoryButton label={secondaryLabel} onPress={onSecondary}
        tone="quiet" disabled={loading} />}
    </View>
    <StoryText variant="caption" color={theme.text} style={styles.footer}>One question. A little room for each other.</StoryText>
  </View>;
}

export type GroveThumbnailProps = {
  dayLabel: string;
  question?: string;
  answers: number;
  missed?: boolean;
  timeOfDay?: number;
  onPress?: () => void;
  disabled?: boolean;
  personalFruits?: readonly ViewerFruit[];
  isDemo?: boolean;
};

export function GroveThumbnail({ dayLabel, question, answers, missed = false, timeOfDay = 0.93,
  onPress, disabled, personalFruits, isDemo = false }: GroveThumbnailProps) {
  const theme = themeAt(timeOfDay);
  const count = Number.isFinite(answers) ? Math.max(0, Math.floor(answers)) : 0;
  const summary = missed ? 'A day you missed · a bare sapling' : `${count} ${count === 1 ? 'answer' : 'answers'}`;
  const fruits = personalFruits?.filter((fruit) => fruit.isMine) ?? [];
  const fruitCount = `${fruits.length} ${fruits.length === 1 ? 'fruit' : 'fruits'} from your giving`;
  const fruitDescription = fruits.length ? `${fruitCount}. ${[...new Set(fruits.map(describeFruit))].join('. ')}` : '';
  const milestones = [...new Set(fruits.filter((fruit) => fruit.golden && fruit.milestone).map((fruit) => fruit.milestone))];
  const accessibleDescription = `${dayLabel}. ${question ?? ''}. ${summary}. ${fruitDescription}`;
  const positions = missed ? [[82, 58], [59, 76], [92, 78], [73, 96], [83, 84], [65, 66]]
    : [[40, 58], [69, 36], [99, 61], [55, 83], [87, 92], [29, 88]];
  const content = <>
    <View style={[styles.thumbnailSky, { backgroundColor: theme.skyTop }]}>
      <View style={[styles.thumbnailHill, { backgroundColor: theme.ground }]} />
      <Image source={missed ? require('../../assets/art/sapling.png') : require('../../assets/art/tree.png')}
        style={styles.thumbnailTree} resizeMode="contain" accessible={false} />
      <View pointerEvents="none" style={styles.fruitCanvas}>
        {fruits.slice(0, positions.length).map((fruit, index) => <View key={fruit.fruitId}
          style={{ position: 'absolute', left: positions[index][0] - 9, top: positions[index][1] - 9 }}>
          <RitualMark kind="fruit" golden={fruit.golden} />
        </View>)}
      </View>
    </View>
    <View style={styles.thumbnailWords}>
      <StoryText variant="meta" color={theme.paper}>{dayLabel}</StoryText>
      {!!question && <StoryText variant="caption" color={theme.paper}>{question}</StoryText>}
      <StoryText variant="meta" color={missed ? theme.muted : theme.lantern}>{missed ? 'A quiet day' : summary}</StoryText>
      {fruits.length > 0 && <StoryText variant="meta" color={theme.paper} accessibilityLabel={fruitDescription}>{fruitCount}</StoryText>}
      {fruits.some((fruit) => fruit.golden) && <StoryText variant="meta" color={theme.lantern}>
        {milestones.length ? `${milestones.join(' · ')}-day giving milestone` : 'Golden fruit'}
      </StoryText>}
    </View>
  </>;
  const baseStyle = [styles.thumbnail, { backgroundColor: theme.panel, borderColor: theme.line, opacity: disabled ? 0.5 : 1 }];
  return onPress ? <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
    accessibilityLabel={accessibleDescription} accessibilityState={{ disabled: !!disabled }}
    style={({ pressed }) => [baseStyle, pressed && { opacity: 0.75 }]}>{content}</Pressable>
    : <View accessible accessibilityLabel={accessibleDescription} style={baseStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  intro: { flexGrow: 1, gap: 24 },
  introTree: { width: '100%', height: 200 },
  introWords: { gap: 16 },
  actions: { gap: 12, marginTop: 8 },
  footer: { textAlign: 'center', marginTop: 'auto', paddingTop: 12 },
  thumbnail: { width: '100%', borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  thumbnailSky: { height: 156, overflow: 'hidden' },
  thumbnailHill: { position: 'absolute', width: '140%', left: '-20%', height: 88, bottom: -60, borderTopLeftRadius: 180, borderTopRightRadius: 200 },
  thumbnailTree: { height: 150, width: '100%', position: 'absolute', bottom: 0 },
  fruitCanvas: { position: 'absolute', width: 150, height: 150, bottom: 0, alignSelf: 'center' },
  thumbnailWords: { gap: 8, padding: 16 },
});
