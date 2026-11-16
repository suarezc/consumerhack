import { type ReactNode, useState } from 'react';
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

export type GroveHillsideDay = {
  id: string;
  label: string;
  question: string;
  answers: number;
  missed: boolean;
  fruits: readonly { golden: boolean }[];
};

export type GroveHillsideProps = { days: readonly GroveHillsideDay[]; header?: ReactNode; emptyMessage?: string };

const groveSlots = [0.5, 0.2, 0.78, 0.4, 0.1, 0.63, 0.9, 0.28, 0.52, 0.04, 0.74, 0.16];
const fruitSpots = [[0.3, 0.3], [0.62, 0.2], [0.72, 0.44], [0.42, 0.5], [0.2, 0.5], [0.5, 0.12]];

function GroveTree({ size, missed, fruits, selected }: { size: number; missed: boolean; fruits: readonly { golden: boolean }[]; selected: boolean }) {
  const dot = Math.max(5, size * 0.07);
  if (missed) return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
    <View style={{ position: 'absolute', bottom: size * 0.2, left: size * 0.5, width: size * 0.025, height: size * 0.22, backgroundColor: '#5b4a4a', transform: [{ rotate: '38deg' }, { translateY: -size * 0.08 }] }} />
    <View style={{ position: 'absolute', bottom: size * 0.3, left: size * 0.45, width: size * 0.02, height: size * 0.16, backgroundColor: '#5b4a4a', transform: [{ rotate: '-34deg' }, { translateY: -size * 0.06 }] }} />
    <View style={{ width: size * 0.035, height: size * 0.5, borderRadius: size, backgroundColor: selected ? '#8a7470' : '#5b4a4a' }} />
  </View>;
  const leaves = [[0.08, 0.3, 0.46, '#234a44'], [0.46, 0.26, 0.48, '#1f433f'], [0.26, 0.04, 0.5, '#2c5a4f'], [0.2, 0.34, 0.6, '#2a554c'], [0.34, 0.16, 0.34, '#37695a']] as const;
  return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
    <View style={{ width: size * 0.07, height: size * 0.5, borderRadius: size * 0.02, backgroundColor: '#3a2b30' }} />
    {leaves.map(([x, y, d, color], index) => <View key={index} style={{ position: 'absolute', left: size * x, top: size * y,
      width: size * d, height: size * d * 0.82, borderRadius: size, backgroundColor: color }} />)}
    {selected && <View style={{ position: 'absolute', left: size * 0.06, top: size * 0.02, width: size * 0.88, height: size * 0.74, borderRadius: size, borderWidth: 1.5, borderColor: '#ffd27a', opacity: 0.8 }} />}
    {fruits.slice(0, fruitSpots.length).map((fruit, index) => <View key={index} style={{ position: 'absolute',
      left: size * (0.1 + fruitSpots[index][0] * 0.8) - dot / 2, top: size * (0.08 + fruitSpots[index][1]) - dot / 2,
      width: dot, height: dot, borderRadius: dot, backgroundColor: fruit.golden ? '#ffd27a' : '#f0a08a' }} />)}
  </View>;
}

export function GroveHillside({ days, header, emptyMessage }: GroveHillsideProps) {
  const theme = themeAt(0.93);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const shown = days.slice(0, groveSlots.length);
  const selected = shown.find(day => day.id === selectedId) ?? null;
  const base = 168;
  const rise = Math.max(160, layout.height * 0.36);
  return <View onLayout={event => setLayout(event.nativeEvent.layout)} style={{ flex: 1, backgroundColor: theme.skyTop, overflow: 'hidden' }}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {theme.skyBands.map((color, index) => <View key={index} style={{ flex: 1, backgroundColor: color }} />)}
    </View>
    {[[0.12, 0.2], [0.3, 0.27], [0.55, 0.22], [0.83, 0.3], [0.7, 0.36], [0.2, 0.38], [0.44, 0.33]].map(([x, y], index) =>
      <View key={index} pointerEvents="none" style={{ position: 'absolute', left: layout.width * x, top: layout.height * y, width: 2, height: 2, borderRadius: 2, backgroundColor: theme.paper, opacity: 0.6 }} />)}
    <View pointerEvents="none" style={{ position: 'absolute', right: 44, top: layout.height * 0.27, width: 26, height: 26, borderRadius: 26, backgroundColor: '#f6efe6', opacity: 0.9 }} />
    <View pointerEvents="none" style={[styles.groveHill, { height: base + rise + 70, left: '-50%', backgroundColor: theme.hillFar }]} />
    <View pointerEvents="none" style={[styles.groveHill, { height: base + rise * 0.72, left: '-10%', backgroundColor: '#1f2148' }]} />
    <View pointerEvents="none" style={[styles.groveHill, { height: base + rise * 0.36, left: '-40%', backgroundColor: theme.ground }]} />
    {layout.width > 0 && shown.map((day, index) => ({ day, index })).reverse().map(({ day, index }) => {
      const size = 62 + 124 * Math.pow(0.74, index);
      const active = day.id === selectedId;
      return <Pressable key={day.id} accessibilityRole="button" accessibilityState={{ selected: active }}
        accessibilityLabel={`${day.label}. ${day.missed ? 'A quiet day' : `${day.answers} ${day.answers === 1 ? 'answer' : 'answers'}`}`}
        onPress={() => setSelectedId(active ? null : day.id)} hitSlop={6}
        style={{ position: 'absolute', left: layout.width * groveSlots[index] - size / 2 + (index ? 0 : 0),
          bottom: base + rise * (1 - Math.pow(0.76, index)), opacity: active ? 1 : Math.max(0.5, 1 - index * 0.09) }}>
        <GroveTree size={size} missed={day.missed} fruits={day.fruits} selected={active} />
      </Pressable>;
    })}
    <View pointerEvents="box-none" style={styles.groveHeader}>{header}</View>
    <View style={[styles.groveCaption, { backgroundColor: theme.panel, borderColor: theme.line }]}>
      {selected ? <>
        <StoryText variant="meta" color={theme.lantern}>{selected.label}</StoryText>
        <StoryText variant="caption" color={theme.paper} numberOfLines={3}>{selected.question}</StoryText>
        <StoryText variant="meta" color={theme.paper}>
          {selected.missed ? 'A quiet day' : `${selected.answers} ${selected.answers === 1 ? 'answer' : 'answers'}`}
          {selected.fruits.length > 0 ? ' · your fruit is on this tree' : ''}
        </StoryText>
      </> : <StoryText variant="caption" color={theme.paper}>{shown.length ? 'One tree for every day. Tap a tree to remember it.' : emptyMessage}</StoryText>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  groveHill: { position: 'absolute', bottom: 0, width: '190%', borderTopLeftRadius: 900, borderTopRightRadius: 900 },
  groveHeader: { position: 'absolute', top: 0, left: 0, right: 0 },
  groveCaption: { position: 'absolute', left: 16, right: 16, bottom: 20, minHeight: 112, borderWidth: 1, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 14, gap: 4, justifyContent: 'center' },
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
