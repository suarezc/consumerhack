import { type ReactNode, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { StoryText } from './primitives';
import { useStoryTime } from './provider';

export type ProductSceneProps = {
  tree: ReactNode;
  title: string;
  meta: string;
  underQuestion?: ReactNode;
  detail?: string;
  onPressDetail?: () => void;
  onOpenTree?: () => void;
  children?: ReactNode;
  overlay?: (controlsHeight: number) => ReactNode;
};

export function ProductScene({ tree, title, meta, underQuestion, detail, onPressDetail, onOpenTree, children, overlay }: ProductSceneProps) {
  const { theme } = useStoryTime();
  const [height, setHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [controls, setControls] = useState({ y: 0, height: 120 });
  const insets = useSafeAreaInsets();
  const controlsHeight = height && controls.y ? Math.max(0, Math.min(height, height - insets.top - controls.y)) : controls.height;
  return <View onLayout={event => setHeight(event.nativeEvent.layout.height)} style={[styles.scene, { backgroundColor: theme.skyTop }]}>
    <View style={StyleSheet.absoluteFill}>{tree}</View>
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} pointerEvents="box-none" style={styles.scene}>
      <View pointerEvents="box-none" style={styles.scene}>
      <View onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}
        style={[styles.header, headerHeight > height * 0.35 && { backgroundColor: theme.skyTop }]} pointerEvents="box-none">
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.screenScrim }]} />
        <View style={styles.metaRow}>
          <StoryText variant="meta" color={theme.text} style={styles.meta}>{meta}</StoryText>
          {onOpenTree && <Pressable accessibilityRole="button" accessibilityLabel="Tree settings" onPress={onOpenTree} style={styles.smallAction}>
            <StoryText variant="meta" color={theme.text} style={styles.meta}>More</StoryText>
          </Pressable>}
        </View>
        <StoryText variant="question" color={theme.text} accessibilityRole="header" style={styles.question}>{title}</StoryText>
        {underQuestion}
        {!!detail && (onPressDetail
          ? <Pressable accessibilityRole="button" onPress={onPressDetail} hitSlop={14} style={{ alignSelf: 'flex-start' }}>
            <StoryText variant="caption" color={theme.text} style={{ fontSize: 14, lineHeight: 20, textDecorationLine: 'underline' }}>{detail}</StoryText>
          </Pressable>
          : <StoryText variant="caption" color={theme.text} style={{ fontSize: 14, lineHeight: 20 }}>{detail}</StoryText>)}
      </View>
      <View pointerEvents="box-none" style={styles.treeSpace} />
      <View onLayout={event => setControls(event.nativeEvent.layout)} style={styles.controls}>
        {children}
      </View>
      </View>
    </SafeAreaView>
    {overlay?.(controlsHeight)}
  </View>;
}

export type ProductSheetProps = { open?: boolean; title: string; onClose: () => void; children: ReactNode; onShow?: () => void };

export function ProductSheet({ open = true, title, onClose, children, onShow }: ProductSheetProps) {
  const { theme, reducedMotion } = useStoryTime();
  const insets = useSafeAreaInsets();
  return <Modal visible={open} transparent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={onClose} onShow={onShow}>
    <KeyboardAvoidingView style={styles.sheetHost} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss sheet" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View style={[styles.sheet, { backgroundColor: theme.panel, borderColor: theme.line }]}>
        <View pointerEvents="none" style={[styles.handle, { backgroundColor: theme.line }]} />
        <View style={styles.sheetHeader}>
          <StoryText variant="question" color={theme.paper} accessibilityRole="header" style={styles.sheetTitle}>{title}</StoryText>
          <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" onPress={onClose} style={styles.close}>
            <StoryText color={theme.paper} style={{ fontSize: 28, lineHeight: 32 }}>×</StoryText>
          </Pressable>
        </View>
        <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.sheetContent, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>{children}</ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  scene: { flex: 1 },
  header: { paddingHorizontal: 28, paddingTop: 10, gap: 10, width: '100%', maxWidth: 560, alignSelf: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  meta: { fontSize: 9, lineHeight: 15, letterSpacing: 1.6 },
  smallAction: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' },
  question: { fontSize: 31, lineHeight: 37, letterSpacing: -0.3 },
  treeSpace: { flex: 1, minHeight: 100 },
  controls: { paddingHorizontal: 28, paddingTop: 8, paddingBottom: 10, gap: 4, width: '100%', maxWidth: 480, alignSelf: 'center' },
  sheetHost: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(4,5,13,0.18)' },
  sheet: { maxHeight: '90%', width: '100%', maxWidth: 560, alignSelf: 'center', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, overflow: 'hidden' },
  handle: { width: 32, height: 3, borderRadius: 3, alignSelf: 'center', marginTop: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingLeft: 24, paddingRight: 12, paddingTop: 12, paddingBottom: 16 },
  sheetTitle: { fontSize: 28, lineHeight: 34, flex: 1 },
  close: { width: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  sheetScroll: { flexShrink: 1 },
  sheetContent: { paddingHorizontal: 24, gap: 18 },
});

export const productSceneStyles = StyleSheet.create({
  primary: { minHeight: 54, backgroundColor: '#f6efe6', borderColor: '#f6efe6' },
  secondary: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  secondaryLabel: { fontSize: 9, lineHeight: 15, letterSpacing: 1.6 },
});
