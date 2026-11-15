import { router, Redirect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Component, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Scene, sceneStyles } from "@/components/screens/Scene";
import { YesterdayIntro } from "@/components/screens/YesterdayIntro";
import { ScreenState, StoryButton, StoryScreen, StoryText, StoryTimeProvider, useStoryTime } from "@/design";
import { useRitual } from "@/providers/RitualProvider";
import { useSession } from "@/providers/SessionProvider";
import { firstOpenView } from "@/services/ritual";

export function Screen({ title, children }: { title: string; children: ReactNode }) {
  const { theme } = useStoryTime();
  return <View nativeID="story-secondary-safe-area" style={{ flex: 1 }}><StatusBar style={theme.text === theme.paper ? "light" : "dark"} /><StoryScreen><StoryText variant="question" accessibilityRole="header">{title}</StoryText>{children}</StoryScreen></View>;
}

export function SessionGate({ children, requireTree = false }: { children: ReactNode; requireTree?: boolean }) {
  const { session, loading, error, retry } = useSession();
  const { timeOfDay } = useRitual();
  if (loading || error || !session) return <Scene timeOfDay={timeOfDay} meta="StoryTime" title="A little room for each other.">
    <StoryText color="#f6efe6">{loading ? "Finding your place…" : "We couldn’t restore this device’s identity. Your identity won’t be replaced."}</StoryText>
    {!loading && <StoryButton label="Try again" onPress={retry} />}
  </Scene>;
  if (requireTree && !session.treeId) return <Redirect href="/" />;
  return requireTree ? <FirstOpenGate>{children}</FirstOpenGate> : children;
}

function FirstOpenGate({ children }: { children: ReactNode }) {
  const { today, firstOpen } = useRitual();
  const view = firstOpenView(today?.day.dayId, firstOpen);
  if (!today || !firstOpen || view === "loading") return <LoadingDay />;
  if (view === "yesterday") return <YesterdayIntro key={`${today.tree.treeId}:${firstOpen.todayDayId}`} intro={firstOpen} treeId={today.tree.treeId} />;
  return children;
}

export function TreeNavigation({ hill = false, compact = false }: { hill?: boolean; compact?: boolean }) {
  const { theme } = useStoryTime();
  const routes = compact ? [['Grove', '/grove']] as const : [['Today', '/today'], ['Bloom', '/bloom'], ['Kindred', '/kindred'], ['Grove', '/grove']] as const;
  return <View style={sceneStyles.row}>
    {routes.map(([label, route]) =>
      <Pressable key={route} accessibilityRole="button" onPress={() => router.replace(route)} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 8 }}><StoryText variant="meta" color={hill ? theme.paper : theme.text}>{label}</StoryText></Pressable>)}
  </View>;
}

export class DataBoundary extends Component<{ children: ReactNode; fallback: (retry: () => void) => ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? this.props.fallback(() => this.setState({ failed: false })) : this.props.children;
  }
}

export function DataFailure({ retry }: { retry: () => void }) {
  const { selectTree } = useSession();
  const [storageError, setStorageError] = useState(false);
  return <StoryTimeProvider timeOfDay={0.93}><Scene timeOfDay={0.93} meta="StoryTime" title="The garden is still here.">
    <StoryText color="#f6efe6">We couldn’t load your tree. Check your connection and try again.</StoryText>
    <StoryButton label="Try again" onPress={retry} />
    <StoryButton label="Choose another tree" tone="quiet" onPress={() => {
      void selectTree(null).then(retry).catch(() => setStorageError(true));
    }} />
    {storageError && <StoryText color="#ffd27a" accessibilityRole="alert">This device couldn’t save the change. Your chosen tree has not changed.</StoryText>}
  </Scene></StoryTimeProvider>;
}

export function LoadingDay() {
  const { timeOfDay, today } = useRitual();
  const { selectTree } = useSession();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  return <Scene timeOfDay={timeOfDay} meta="StoryTime" title="One question. A little room to grow.">
    <StoryText color="#f6efe6">{today === undefined ? "Waiting for your tree. If this takes a while, check your connection." : "Today’s question isn’t available yet. You may have joined after the bloom."}</StoryText>
    <StoryButton label="Choose another tree" tone="quiet" loading={busy} onPress={() => {
      setBusy(true);
      void selectTree(null).then(() => router.replace("/")).catch(() => setError(true)).finally(() => setBusy(false));
    }} />
    {error && <StoryText color="#ffd27a" accessibilityRole="alert">This device couldn’t save the change. Please try again.</StoryText>}
    <TreeNavigation hill />
  </Scene>;
}

export function Empty({ title, message }: { title: string; message?: string }) {
  return <ScreenState status="empty" title={title} message={message} />;
}
