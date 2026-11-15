import { useAction, useMutation } from "convex/react";
import { randomUUID } from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";

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
  const [opened, setOpened] = useState(false);

  async function prepare() {
    if (!session || !today.myAnswer || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const target = { deviceId: session.deviceId, treeId: today.tree.treeId, dayId: today.day.dayId, bundles };
      if (today.day.isDemo) {
        await demoWater({ ...target, requestId: demoRequest.forBundles(bundles).requestId });
        demoRequest.reset();
        onClose();
      } else {
        const result = await checkout({ ...target, answerId: today.myAnswer.answerId });
        setCheckoutUrl(result.checkoutUrl);
      }
    } catch {
      setError(today.day.isDemo ? "The sample watering wasn’t confirmed. Retry this choice to safely check the same request." : "Sandbox checkout isn’t available. No payment success has been confirmed. Please try again later.");
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
    {checkoutUrl && <StoryButton label="Open secure sandbox checkout" loading={busy} onPress={() => {
      setBusy(true);
      setError("");
      void WebBrowser.openBrowserAsync(checkoutUrl).then(() => setOpened(true)).catch(() => setError("The browser couldn’t open. Please try the checkout button again.")).finally(() => setBusy(false));
    }} />}
    {checkoutUrl && <StoryText variant="caption" color="#c6c1c2">{opened ? "Checkout was opened. " : ""}Closing checkout never confirms payment. Fruit appears only after the payment service verifies it.</StoryText>}
    {!!checkoutUrl && !!error && <StoryText color="#ffd27a" accessibilityRole="alert">{error}</StoryText>}
  </Panel>;
}
