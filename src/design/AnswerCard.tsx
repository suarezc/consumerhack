import { type ComponentRef, type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StoryButton, StoryText } from './primitives';
import { useStoryTime } from './provider';

export type BlossomOrigin = { x: number; y: number };
export type StoryAnswer = { id: string; text: string; author: string; isMine?: boolean };
export type AnswerCardProps = {
  open: boolean;
  answer: StoryAnswer | null;
  origin?: BlossomOrigin | null;
  controlsHeight?: number;
  onClose: () => void;
  onNote?: () => void;
  onLantern?: () => void;
  noteLoading?: boolean;
  lanternLoading?: boolean;
  error?: string;
  children?: ReactNode;
};

export function AnswerCard(props: AnswerCardProps) {
  if (!props.open || !props.answer) return null;
  return <AnswerCardFrame {...props} answer={props.answer} />;
}

function AnswerCardFrame(props: AnswerCardProps & { answer: StoryAnswer }) {
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={({ nativeEvent }) => {
    const { width, height } = nativeEvent.layout;
    setBounds((previous) => previous.width === width && previous.height === height ? previous : { width, height });
  }}>
    {bounds.height > 0 && <AnswerCardContent
      key={`${props.answer.id}:${bounds.width}:${bounds.height}:${props.origin?.x}:${props.origin?.y}:${props.controlsHeight}`}
      {...props} availableHeight={bounds.height} />}
  </View>;
}

function AnswerCardContent({ answer, origin, controlsHeight = 120, onClose, onNote, onLantern,
  noteLoading, lanternLoading, error, children, availableHeight }: AnswerCardProps & { answer: StoryAnswer; availableHeight: number }) {
  const { theme, reducedMotion } = useStoryTime();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const card = useRef<ComponentRef<typeof View>>(null);
  const measured = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const cardId = useId();
  const [progress] = useState(() => new Animated.Value(0));
  const [offset, setOffset] = useState<{ x: number; y: number; anchored: boolean } | null>(null);
  const originX = origin?.x;
  const originY = origin?.y;
  const bandHeight = Number.isFinite(controlsHeight) ? Math.max(0, controlsHeight) : 120;
  const bottom = Math.max(insets.bottom, Math.min(bandHeight, availableHeight * 0.6)) + 18;
  const dismiss = useCallback(() => {
    if (Platform.OS === 'web' && document.getElementById(cardId)?.contains(document.activeElement)) opener.current?.focus();
    onClose();
  }, [cardId, onClose]);

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
    if (Platform.OS === 'web') {
      if (!opener.current && document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') dismiss();
      };
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss();
      return true;
    });
    return () => subscription.remove();
  }, [dismiss]);

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

  return <View pointerEvents="box-none" style={[styles.overlay, { paddingTop: insets.top + 24, paddingBottom: bottom }]}>
      <View ref={card} nativeID={cardId} onLayout={reveal} collapsable={false}
        onAccessibilityEscape={dismiss}
        style={[styles.cardHost, { maxHeight: Math.max(48, availableHeight - insets.top - bottom - 24) }]}>
      <Animated.View style={[styles.card, { backgroundColor: 'rgba(9,12,34,0.86)', borderColor: theme.line,
          ...(Platform.OS === 'web' ? { backdropFilter: 'blur(6px)' } : {}),
          opacity: offset ? progress : 0,
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [offset?.x ?? 0, 0] }) },
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offset?.y ?? 0, 0] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [offset?.anchored ? 0.05 : 1, 1] }) },
          ],
        }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.cardContent}>
          <StoryText variant="question" color={theme.paper} style={styles.answer}>{answer.text}</StoryText>
          <View style={styles.heading}>
            <StoryText variant="meta" color={answer.isMine ? theme.lantern : theme.muted} style={styles.author}>
              {answer.isMine ? 'Your blossom' : answer.author}
            </StoryText>
            <StoryButton label="Close" tone="quiet" onPress={dismiss} />
          </View>
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
  overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, paddingHorizontal: 20, justifyContent: 'flex-end', alignItems: 'center' },
  cardHost: { width: '100%', maxWidth: 416, flexShrink: 1 },
  card: { borderWidth: 1, overflow: 'hidden', flexShrink: 1 },
  cardContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16, gap: 10 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  author: { flex: 1 },
  answer: { fontSize: 20, lineHeight: 28 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
