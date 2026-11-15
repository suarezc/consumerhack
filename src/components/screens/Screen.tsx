import { router, Redirect } from "expo-router";
import { Component, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Scene, sceneStyles } from "@/components/screens/Scene";
import { ScreenState, StoryButton, StoryScreen, StoryText, StoryTimeProvider } from "@/design";
import { useRitual } from "@/providers/RitualProvider";
import { useSession } from "@/providers/SessionProvider";

export function Screen({ title, children }: { title: string; children: ReactNode }) {
  return <StoryScreen><StoryText variant="question" accessibilityRole="header">{title}</StoryText>{children}</StoryScreen>;
}

export function SessionGate({ children, requireTree = false }: { children: ReactNode; requireTree?: boolean }) {
  const { session, loading, error, retry } = useSession();
  const { timeOfDay } = useRitual();
  if (loading || error || !session) return <Scene timeOfDay={timeOfDay} meta="StoryTime" title="A little room for each other.">
    <StoryText color="#f6efe6">{loading ? "Finding your place…" : "We couldn’t restore this device’s identity. Your identity won’t be replaced."}</StoryText>
    {!loading && <StoryButton label="Try again" onPress={retry} />}
  </Scene>;
  if (requireTree && !session.treeId) return <Redirect href="/" />;
  return children;
}

export function TreeNavigation() {
  return <View style={sceneStyles.row}>
    {([['Today', '/today'], ['Bloom', '/bloom'], ['Kindred', '/kindred'], ['Grove', '/grove']] as const).map(([label, route]) =>
      <Pressable key={route} accessibilityRole="button" onPress={() => router.replace(route)} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 8 }}><StoryText variant="meta" color="#f6efe6">{label}</StoryText></Pressable>)}
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
  return <Scene timeOfDay={timeOfDay} meta="StoryTime" title="One question. A little room to grow.">
    <StoryText color="#f6efe6">{today === undefined ? "Waiting for your tree. If this takes a while, check your connection." : "Today’s question isn’t available yet. You may have joined after the bloom."}</StoryText>
    <TreeNavigation />
  </Scene>;
}

export function Empty({ title, message }: { title: string; message?: string }) {
  return <ScreenState status="empty" title={title} message={message} />;
}
