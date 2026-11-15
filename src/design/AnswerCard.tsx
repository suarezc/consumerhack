import { type ComponentRef, type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StoryButton, StoryText } from './primitives';
import { useStoryTime } from './provider';

export type BlossomOrigin = { x: number; y: number };
export type StoryAnswer = { id: string; text: string; author: string; isMine?: boolean };
export type AnswerCardProps = {
  open: boolean;
  answer: StoryAnswer | null;
  origin?: BlossomOrigin | null;
  onClose: () => void;
  onNote?: () => void;
  onLantern?: () => void;
  noteLoading?: boolean;
  lanternLoading?: boolean;
  error?: string;
  children?: ReactNode;
};

export function AnswerCard(props: AnswerCardProps) {
  const { width, height } = useWindowDimensions();
  if (!props.open || !props.answer) return null;
  return <Modal visible transparent animationType="none" onRequestClose={props.onClose}>
    <AnswerCardContent key={`${props.answer.id}:${width}:${height}:${props.origin?.x}:${props.origin?.y}`}
      {...props} answer={props.answer} />
  </Modal>;
}

function AnswerCardContent({ answer, origin, onClose, onNote, onLantern,
  noteLoading, lanternLoading, error, children }: AnswerCardProps & { answer: StoryAnswer }) {
  const { theme, reducedMotion } = useStoryTime();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const card = useRef<ComponentRef<typeof View>>(null);
  const measured = useRef(false);
  const [progress] = useState(() => new Animated.Value(0));
  const [offset, setOffset] = useState<{ x: number; y: number; anchored: boolean } | null>(null);
  const originX = origin?.x;
  const originY = origin?.y;

  function reveal() {
    if (measured.current) return;
    card.current?.measureInWindow((x, y, cardWidth, cardHeight) => {
      if (measured.current) return;
      measured.current = true;
      const anchored = !reducedMotion && Number.isFinite(originX) && Number.isFinite(originY)
        && originX! >= 0 && originX! <= width && originY! >= 0 && originY! <= height;
      setOffset({
        x: anchored ? originX! - x - cardWidth / 2 : 0,
        y: anchored ? originY! - y - cardHeight / 2 : 0,
        anchored,
      });
    });
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (measured.current) return;
      measured.current = true;
      setOffset({ x: 0, y: 0, anchored: false });
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!offset) return;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: reducedMotion ? 0 : offset.anchored ? 600 : 180,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, offset, progress]);

  return <View style={[styles.overlay, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
      <View ref={card} onLayout={reveal} collapsable={false}
        style={[styles.cardHost, { maxHeight: height - insets.top - insets.bottom - 48 }]}>
      <Animated.View accessibilityViewIsModal style={[styles.card, { backgroundColor: theme.panel, borderColor: theme.line,
          opacity: offset ? progress : 0,
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [offset?.x ?? 0, 0] }) },
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offset?.y ?? 0, 0] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [offset?.anchored ? 0.05 : 1, 1] }) },
          ],
        }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.cardContent}>
          <View style={styles.heading}>
            <StoryText variant="meta" color={answer.isMine ? theme.lantern : theme.muted} style={styles.author}>
              {answer.isMine ? 'Your blossom' : answer.author}
            </StoryText>
            <StoryButton label="Close" tone="quiet" onPress={onClose} />
          </View>
          <StoryText variant="question" color={theme.paper} style={styles.answer}>{answer.text}</StoryText>
          {children}
          {!!error && <StoryText accessibilityRole="alert" variant="caption" color={theme.lantern}>{error}</StoryText>}
          <View style={styles.actions}>
            {!answer.isMine && onNote && <StoryButton label="Leave a note" tone="quiet" onPress={onNote} loading={noteLoading} />}
            {onLantern && <StoryButton label="Hang a lantern" onPress={onLantern} loading={lanternLoading} />}
          </View>
        </ScrollView>
      </Animated.View>
      </View>
    </View>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(4,5,13,0.42)', paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  cardHost: { width: '100%', maxWidth: 440, flexShrink: 1 },
  card: { borderWidth: 1, borderRadius: 4, overflow: 'hidden', flexShrink: 1 },
  cardContent: { padding: 20, gap: 20 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  author: { flex: 1 },
  answer: { fontSize: 24, lineHeight: 33 },
  actions: { gap: 12 },
});
