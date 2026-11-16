import { useAction } from "convex/react";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { Panel } from "@/components/screens/Scene";
import { StoryButton, StoryText, WateringBundles } from "@/design";
import type { Today } from "@/providers/RitualProvider";
import { useSession } from "@/providers/SessionProvider";
import { api } from "@/services/api";

export function WateringComposer({ today, onClose }: {
  today: Today;
  onClose: () => void;
}) {
  const { session } = useSession();
  const checkout = useAction(api.waterings.checkout);
  const [bundles, setBundles] = useState<2 | 5 | 10>(2);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [lightsAtOpen] = useState(today.lightBundles);
  const paid = !!checkoutUrl && today.lightBundles > lightsAtOpen;
  useEffect(() => {
    if (!paid) return;
    if (Platform.OS === "ios") void WebBrowser.dismissBrowser().catch(() => undefined);
    onClose();
  }, [paid, onClose]);

  async function prepare() {
    if (!session || !today.myAnswer || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await checkout({ deviceId: session.deviceId, treeId: today.tree.treeId, dayId: today.day.dayId, bundles, answerId: today.myAnswer.answerId });
      setCheckoutUrl(result.checkoutUrl);
      void WebBrowser.openBrowserAsync(result.checkoutUrl).catch(() => undefined);
    } catch {
      setError("Checkout isn’t available right now. Please try again.");
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }

  return <Panel title="A little care, together." onClose={() => { if (!busy) onClose(); }}>
    {!checkoutUrl && <WateringBundles selectedBundles={bundles} onSelectBundles={(next) => {
      if (pending.current) return;
      setBundles(next);
      setError("");
    }} onWater={() => { void prepare(); }} canWater={today.myAnswer !== null} loading={busy} error={error} isDemo={today.day.isDemo} />}
    {checkoutUrl && <StoryButton label="Open Whop checkout" loading={busy} onPress={() => {
      setBusy(true);
      setError("");
      void WebBrowser.openBrowserAsync(checkoutUrl).catch(() => setError("The browser couldn’t open. Please try the checkout button again.")).finally(() => setBusy(false));
    }} />}
    {checkoutUrl && <StoryText variant="caption" color="#c6c1c2">Fireflies and lights appear as soon as Whop confirms the payment.</StoryText>}
    {!!checkoutUrl && !!error && <StoryText color="#ffd27a" accessibilityRole="alert">{error}</StoryText>}
  </Panel>;
}
