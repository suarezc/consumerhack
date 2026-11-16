import { useAction, useMutation } from "convex/react";
import { randomUUID } from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";

import { Panel } from "@/components/screens/Scene";
import { StoryButton, StoryText, WateringBundles } from "@/design";
import type { Today } from "@/providers/RitualProvider";
import { useSession } from "@/providers/SessionProvider";
import { api } from "@/services/api";
import { createDemoWateringIntent } from "@/services/watering";

export function WateringComposer({ today, onClose }: {
  today: Today;
  onClose: () => void;
}) {
  const { session } = useSession();
  const checkout = useAction(api.waterings.checkout);
  const demoWater = useMutation(api.waterings.demoWater);
  const [bundles, setBundles] = useState<2 | 5 | 10>(2);
  const [demoRequest] = useState(() => createDemoWateringIntent(randomUUID));
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [lightsAtOpen] = useState(today.lightBundles);
  const paid = !!checkoutUrl && today.lightBundles > lightsAtOpen;
  useEffect(() => { if (paid) onClose(); }, [paid, onClose]);

  async function prepare(whop = false) {
    if (!session || !today.myAnswer || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const target = { deviceId: session.deviceId, treeId: today.tree.treeId, dayId: today.day.dayId, bundles };
      if (today.day.isDemo && !whop) {
        await demoWater({ ...target, requestId: demoRequest.forBundles(bundles).requestId });
        demoRequest.reset();
        onClose();
      } else {
        const result = await checkout({ ...target, answerId: today.myAnswer.answerId });
        setCheckoutUrl(result.checkoutUrl);
        void WebBrowser.openBrowserAsync(result.checkoutUrl).catch(() => undefined);
      }
    } catch {
      setError(today.day.isDemo ? "That didn’t go through. Please try again." : "Checkout isn’t available right now. Please try again.");
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }

  return <Panel title="A little care, together." onClose={() => { if (!busy) onClose(); }}>
    {!checkoutUrl && <WateringBundles selectedBundles={bundles} onSelectBundles={(next) => {
      if (pending.current) return;
      setBundles(next);
      if (next !== bundles) demoRequest.reset();
      setError("");
    }} onWater={() => { void prepare(); }} canWater={today.myAnswer !== null} loading={busy} error={error} isDemo={today.day.isDemo} />}
    {!checkoutUrl && today.day.isDemo && today.myAnswer !== null && <StoryButton label="Pay with Whop" tone="quiet" loading={busy} onPress={() => { void prepare(true); }} />}
    {checkoutUrl && <StoryButton label="Open Whop checkout" loading={busy} onPress={() => {
      setBusy(true);
      setError("");
      void WebBrowser.openBrowserAsync(checkoutUrl).catch(() => setError("The browser couldn’t open. Please try the checkout button again.")).finally(() => setBusy(false));
    }} />}
    {checkoutUrl && <StoryText variant="caption" color="#c6c1c2">Fireflies and lights appear as soon as Whop confirms the payment.</StoryText>}
    {!!checkoutUrl && !!error && <StoryText color="#ffd27a" accessibilityRole="alert">{error}</StoryText>}
  </Panel>;
}
