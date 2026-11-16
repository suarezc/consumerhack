import { useAction } from "convex/react";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";

import { Panel } from "@/components/screens/Scene";
import { StoryButton, StoryText } from "@/design";
import type { Today } from "@/providers/RitualProvider";
import { useSession } from "@/providers/SessionProvider";
import { api } from "@/services/api";

export function WateringComposer({ today, onClose, onPaid }: {
  today: Today;
  onClose: () => void;
  onPaid: (fireflies: number) => void;
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
