import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { StoryText } from './primitives';
import { useStoryTime } from './provider';

export type RitualTimelineProps = {
  progress: number;
  playing: boolean;
  stage: string;
  onScrub: (progress: number) => void;
  onTogglePlay: () => void;
  onRestart: () => void;
};

const stages = [
  { label: 'Seed', at: 0 },
  { label: 'Sapling', at: 0.25 },
  { label: 'Growing', at: 0.6 },
  { label: 'Mature', at: 1 },
];

export function RitualTimeline({ progress, playing, stage, onScrub, onTogglePlay, onRestart }: RitualTimelineProps) {
  const { theme } = useStoryTime();
  const [width, setWidth] = useState(0);
  const value = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const seek = (x: number) => { if (width > 0) onScrub(Math.max(0, Math.min(1, x / width))); };
  return <View style={styles.timeline}>
    <View style={styles.heading}>
      <StoryText variant="caption" color={theme.text}>A day in 15 seconds · {stage}</StoryText>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onTogglePlay} style={styles.action}>
          <StoryText variant="control" color={theme.text} style={styles.actionLabel}>{playing ? 'Pause' : 'Play'}</StoryText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Restart the sample day" onPress={onRestart} style={styles.action}>
          <StoryText variant="caption" color={theme.text} style={styles.actionLabel}>Restart</StoryText>
        </Pressable>
      </View>
    </View>
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.trackHit}
      accessibilityRole="progressbar" accessibilityLabel="Day timeline. Drag to seek, or choose a stage below."
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
      onResponderGrant={event => seek(event.nativeEvent.locationX)} onResponderMove={event => seek(event.nativeEvent.locationX)}>
      <View pointerEvents="none" style={[styles.track, { backgroundColor: theme.text, opacity: 0.2 }]} />
      <View pointerEvents="none" style={[styles.track, { width: `${value * 100}%`, backgroundColor: theme.text }]} />
      <View pointerEvents="none" style={[styles.thumb, { left: `${value * 100}%`, backgroundColor: theme.text }]} />
    </View>
    <View style={styles.stages}>
      {stages.map(item => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={`Seek to ${item.label.toLowerCase()}`}
        onPress={() => onScrub(item.at)} style={styles.stage}>
        <StoryText variant="meta" color={theme.text}>{item.label}</StoryText>
      </Pressable>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  timeline: { gap: 0 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: 12 },
  action: { minHeight: 44, justifyContent: 'center' },
  actionLabel: { fontSize: 14, lineHeight: 20 },
  trackHit: { height: 24, justifyContent: 'center' },
  track: { position: 'absolute', left: 0, right: 0, height: 2, borderRadius: 2 },
  thumb: { position: 'absolute', width: 10, height: 10, borderRadius: 5, marginLeft: -5 },
  stages: { flexDirection: 'row', justifyContent: 'space-between' },
  stage: { minHeight: 44, justifyContent: 'center', minWidth: 44 },
});
