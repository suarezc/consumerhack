import { useAction } from "convex/react";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, View } from "react-native";

import { Panel } from "@/components/screens/Scene";
import { StoryButton, StoryText } from "@/design";
import type { Today } from "@/providers/RitualProvider";
import { useSession } from "@/providers/SessionProvider";
import { api } from "@/services/api";

function Firefly({ index }: { index: number }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(progress, { toValue: 1, duration: 4200 + (index * 733) % 3600, easing: Easing.linear, useNativeDriver: Platform.OS !== "web" }));
    loop.start();
    return () => loop.stop();
  }, [progress, index]);
  const seed = (n: number) => { const value = Math.sin(index * 12.9898 + n * 78.233) * 43758.5453; return value - Math.floor(value); };
  const drift = (n: number, reach: number) => progress.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, reach * (seed(n) - 0.5), reach * (seed(n + 1) - 0.5), reach * (seed(n + 2) - 0.5), 0] });
  return <Animated.View style={{ position: "absolute", left: `${4 + seed(7) * 92}%`, top: `${8 + seed(8) * 84}%`, width: 6, height: 6, borderRadius: 3,
    backgroundColor: "#ffd27a", shadowColor: "#ffd27a", shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
    opacity: progress.interpolate({ inputRange: [0, 0.2, 0.5, 0.8, 1], outputRange: [0.35, 1, 0.5, 1, 0.35] }),
    transform: [{ translateX: drift(1, 70) }, { translateY: drift(4, 44) }] }} />;
}

export function WateringComposer({ today, onClose, onPaid, onPreview }: {
  today: Today;
  onClose: () => void;
  onPaid: (fireflies: number) => void;
  onPreview: (fireflies: number) => void;
}) {
  const { session } = useSession();
  const checkout = useAction(api.waterings.checkout);
  const [dollars, setDollars] = useState(5);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [lightsAtOpen] = useState(today.lightBundles);
  const paid = !!checkoutUrl && today.lightBundles > lightsAtOpen;
  useEffect(() => {
    if (!paid) return;
    if (Platform.OS === "ios") void WebBrowser.dismissBrowser().catch(() => undefined);
    onPaid(dollars);
  }, [paid, dollars, onPaid]);

  useEffect(() => {
    onPreview(paid ? 0 : dollars);
    return () => onPreview(0);
  }, [dollars, paid, onPreview]);

  async function prepare() {
    if (!session || !today.myAnswer || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await checkout({ deviceId: session.deviceId, treeId: today.tree.treeId, dayId: today.day.dayId, bundles: dollars * 2, answerId: today.myAnswer.answerId });
      setCheckoutUrl(result.checkoutUrl);
      void WebBrowser.openBrowserAsync(result.checkoutUrl).catch(() => undefined);
    } catch {
      setError("Checkout isn’t available right now. Please try again.");
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }

  const step = (by: number) => { if (!busy) setDollars((value) => Math.max(1, Math.min(50, value + by))); };
  const round = { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: "#6f6a78", alignItems: "center", justifyContent: "center" } as const;
  return <Panel title="A little care, together." onClose={() => { if (!busy) onClose(); }}>
    <View pointerEvents="none" style={{ height: 88 }}>
      {Array.from({ length: dollars }, (_, index) => <Firefly key={index} index={index} />)}
    </View>
    {!checkoutUrl && <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="One dollar less" onPress={() => step(-1)} style={round}><StoryText color="#f6efe6" style={{ fontSize: 26, lineHeight: 30 }}>−</StoryText></Pressable>
        <StoryText color="#f6efe6" accessibilityLabel={`${dollars} US dollars`} style={{ fontSize: 52, lineHeight: 60, minWidth: 120, textAlign: "center" }}>${dollars}</StoryText>
        <Pressable accessibilityRole="button" accessibilityLabel="One dollar more" onPress={() => step(1)} style={round}><StoryText color="#f6efe6" style={{ fontSize: 26, lineHeight: 30 }}>+</StoryText></Pressable>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
        {[1, 5, 10, 25, 50].map((amount) => <Pressable key={amount} accessibilityRole="button" accessibilityLabel={`${amount} US dollars`}
          onPress={() => { if (!busy) setDollars(amount); }}
          style={{ minWidth: 54, minHeight: 40, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center",
            borderColor: dollars === amount ? "#ffd27a" : "#6f6a78", backgroundColor: dollars === amount ? "rgba(255,210,122,0.14)" : "transparent" }}>
          <StoryText variant="caption" color="#f6efe6">${amount}</StoryText>
        </Pressable>)}
      </View>
      <StoryText variant="caption" color="#f6efe6" style={{ textAlign: "center" }}>{dollars} {dollars === 1 ? "firefly" : "fireflies"} for today’s tree. One for every dollar.</StoryText>
      {!!error && <StoryText color="#ffd27a" accessibilityRole="alert">{error}</StoryText>}
      <StoryButton label="Support S.A.C.K." loading={busy} disabled={!today.myAnswer} onPress={() => { void prepare(); }} />
    </>}
    {checkoutUrl && <StoryButton label="Open Whop checkout" loading={busy} onPress={() => {
      setBusy(true);
      setError("");
      void WebBrowser.openBrowserAsync(checkoutUrl).catch(() => setError("The browser couldn’t open. Please try the checkout button again.")).finally(() => setBusy(false));
    }} />}
    {checkoutUrl && <StoryText variant="caption" color="#c6c1c2">Your fireflies appear as soon as Whop confirms the payment.</StoryText>}
    {!!checkoutUrl && !!error && <StoryText color="#ffd27a" accessibilityRole="alert">{error}</StoryText>}
  </Panel>;
}
