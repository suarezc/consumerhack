import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Tree, type TreeProps } from "@/components/Tree";
import { StoryButton, StoryText, useStoryTime } from "@/design";

type SceneProps = {
  timeOfDay: number;
  title: string;
  meta: string;
  detail?: string;
  tree?: Partial<Pick<TreeProps, "answers" | "mine" | "notes" | "lanterns" | "onTapBlossom">>;
  treeKey?: string;
  children?: ReactNode;
  overlay?: (controlsHeight: number) => ReactNode;
  onOpenTree?: () => void;
};

export function Scene({ timeOfDay, title, meta, detail, tree, treeKey, children, overlay, onOpenTree }: SceneProps) {
  const { theme } = useStoryTime();
  const [height, setHeight] = useState(0);
  const [controls, setControls] = useState({ y: 0, height: 120 });
  const controlsHeight = height && controls.y ? height - controls.y : controls.height;
  return <View onLayout={(event) => setHeight(event.nativeEvent.layout.height)} style={[styles.scene, { backgroundColor: theme.skyTop }]}>
    <Tree key={treeKey} timeOfDay={timeOfDay} answers={tree?.answers ?? 0} mine={tree?.mine ?? []}
      notes={tree?.notes ?? []} lanterns={tree?.lanterns ?? 0} onTapBlossom={tree?.onTapBlossom}
      style={StyleSheet.absoluteFill} />
    <SafeAreaView nativeID="story-scene-safe-area" style={styles.scene} pointerEvents="box-none">
      <View style={styles.top} pointerEvents="box-none">
        {onOpenTree ? <Pressable accessibilityRole="button" accessibilityLabel="Your tree" onPress={onOpenTree} style={{ minHeight: 32, justifyContent: "center" }}><StoryText variant="meta" color={theme.ink}>{meta} · settings</StoryText></Pressable> : <StoryText variant="meta" color={theme.ink}>{meta}</StoryText>}
        <StoryText variant="question" color={theme.ink} accessibilityRole="header">{title}</StoryText>
        {!!detail && <StoryText variant="caption" color={theme.ink}>{detail}</StoryText>}
      </View>
      <View pointerEvents="box-none" style={styles.space} />
      <View onLayout={(event) => setControls(event.nativeEvent.layout)} style={styles.controls}>{children}</View>
    </SafeAreaView>
    {overlay?.(controlsHeight)}
  </View>;
}

export function Panel({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const { theme } = useStoryTime();
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <SafeAreaView nativeID="story-panel-safe-area" style={styles.overlay}>
      <KeyboardAvoidingView style={styles.panelHost} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.panel, { backgroundColor: theme.panel, borderColor: theme.line }]}>
          <StoryText variant="question" color={theme.paper} accessibilityRole="header">{title}</StoryText>
          {children}
          <StoryButton label="Close" tone="quiet" onPress={onClose} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

export const sceneStyles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stack: { gap: 12 },
  message: { paddingVertical: 4 },
});

const styles = StyleSheet.create({
  scene: { flex: 1 },
  top: { paddingHorizontal: 22, paddingTop: 18, gap: 10, maxWidth: 560 },
  space: { flex: 1, minHeight: 160 },
  controls: { paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  overlay: { flex: 1, backgroundColor: "rgba(4,5,13,0.35)", justifyContent: "flex-end" },
  panelHost: { maxHeight: "92%", width: "100%", maxWidth: 560, alignSelf: "center" },
  panel: { padding: 24, gap: 18, borderTopWidth: 1 },
});
