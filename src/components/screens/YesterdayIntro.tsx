import { useMutation } from "convex/react";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { Tree } from "@/components/Tree";
import { StoryText, YesterdayImpact } from "@/design";
import type { FirstOpen } from "@/providers/RitualProvider";
import { useSession } from "@/providers/SessionProvider";
import { api, type Id } from "@/services/api";
import { mutationError } from "@/services/errors";

export function YesterdayIntro({ intro, treeId }: { intro: FirstOpen; treeId: Id<"trees"> }) {
  const { session } = useSession();
  const acknowledge = useMutation(api.days.acknowledgeYesterday);
  const pending = useRef(false);
  const active = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const yesterday = intro.yesterday;
  if (!yesterday) return null;

  async function continueToday() {
    if (!session || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await acknowledge({ deviceId: session.deviceId, treeId, dayId: intro.todayDayId });
      router.replace("/today");
    } catch (failure) {
      if (active.current) setError(mutationError(failure, "We couldn’t save that. Stay here and try again; yesterday hasn’t been dismissed."));
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }

  return <YesterdayImpact impact={yesterday} onToday={() => { void continueToday(); }} loading={busy} error={error}>
    <Tree key={yesterday.dayId} timeOfDay={1} answers={yesterday.answererCount} mine={[]} notes={[]} lanterns={0}
      fruits={yesterday.fruits.map((fruit) => ({ id: fruit.fruitId, golden: fruit.golden, mine: fruit.isMine }))}
      wateringEvent={null} style={{ height: 280 }} />
    <StoryText variant="caption">{yesterday.isDemo ? "Sample gross total · no real money" : "Sandbox gross total · not net charity proceeds. No real donation or payout is established."}</StoryText>
  </YesterdayImpact>;
}
