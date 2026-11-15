import { Link, Redirect } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSession } from "@/providers/SessionProvider";

export function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function SessionGate({ children, requireTree = false }: { children: ReactNode; requireTree?: boolean }) {
  const { session, loading, error, retry } = useSession();
  if (loading) return <Screen title="StoryTime"><ActivityIndicator accessibilityLabel="Restoring your tree" /></Screen>;
  if (error || !session) return <Screen title="Your place is safe"><Text>We couldn’t restore this device’s identity. Try again before continuing.</Text><Button title="Try again" onPress={retry} /></Screen>;
  if (requireTree && !session.treeId) return <Redirect href="/" />;
  return children;
}

export function TreeNavigation() {
  return <View style={styles.navigation}>
    <Link href="/today">Today</Link>
    <Link href="/bloom">Bloom</Link>
    <Link href="/kindred">Kindred</Link>
    <Link href="/grove">Grove</Link>
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6efe6" },
  content: { padding: 24, gap: 20, flexGrow: 1 },
  title: { fontSize: 30 },
  navigation: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
});
