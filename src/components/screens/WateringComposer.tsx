import { useAction } from "convex/react";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";

import { Panel } from "@/components/screens/Scene";
import { StoryButton, StoryField, StoryText } from "@/design";
import { useSession } from "@/providers/SessionProvider";
import { api, type Id } from "@/services/api";
import { amountInCents } from "@/services/ritual";

export function WateringComposer({ treeId, answerId, cause, onClose }: {
  treeId: Id<"trees">;
  answerId?: Id<"answers">;
  cause: string;
  onClose: () => void;
}) {
  const { session } = useSession();
  const checkout = useAction(api.waterings.checkout);
  const [amount, setAmount] = useState("1");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [opened, setOpened] = useState(false);

  async function prepare() {
    if (!session || pending.current) return;
    const amountCents = amountInCents(amount);
    if (amountCents === null) {
      setError("Choose $1 to $100 USD in $0.50 steps. Your amount has not been changed.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await checkout({ deviceId: session.deviceId, treeId, ...(answerId ? { answerId } : {}), amountCents });
      setCheckoutUrl(result.checkoutUrl);
    } catch {
      setError("Sandbox checkout isn’t available. No watering has been marked paid. Please try again later.");
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }

  return <Panel title="A little light for a cause." onClose={() => { if (!busy) onClose(); }}>
    <StoryText color="#f6efe6">{cause}</StoryText>
    <StoryText variant="caption" color="#ffd27a">Watering · sandbox checkout · test payments only</StoryText>
    <StoryText variant="caption" color="#c6c1c2">$1 minimum, then $0.50 steps. Your chosen amount is never increased automatically.</StoryText>
    {!checkoutUrl && <>
      <StoryField labelColor="#f6efe6" errorColor="#ffd27a" label="Amount in USD" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" inputMode="decimal" maxLength={6} editable={!busy} />
      <StoryButton label="Prepare sandbox checkout" loading={busy} onPress={() => { void prepare(); }} />
    </>}
    {checkoutUrl && <StoryButton label="Open secure sandbox checkout" loading={busy} onPress={() => {
      setBusy(true);
      setError("");
      void WebBrowser.openBrowserAsync(checkoutUrl).then(() => setOpened(true)).catch(() => setError("The browser couldn’t open. Please try the checkout button again.")).finally(() => setBusy(false));
    }} />}
    <StoryText variant="caption" color="#c6c1c2">{opened ? "Checkout was opened. " : ""}Closing checkout never adds fruit or extends a streak. The tree reacts only after the payment service verifies the watering.</StoryText>
    {!!error && <StoryText color="#ffd27a" accessibilityRole="alert">{error}</StoryText>}
  </Panel>;
}
