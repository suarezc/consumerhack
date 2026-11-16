import { useMutation } from "convex/react";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { Tree } from "@/components/Tree";
import { FruitDetailStatus } from "@/components/screens/FruitDetailStatus";
import { getTreeDataStatus } from "@/components/tree/bridge";
import { StoryScreen, StoryText, YesterdayImpact, useStoryTime } from "@/design";
import type { FirstOpen } from "@/providers/RitualProvider";
import { useSession } from "@/providers/SessionProvider";
import { api, type Id } from "@/services/api";
import { mutationError } from "@/services/errors";

export function YesterdayIntro({ intro, treeId }: { intro: FirstOpen; treeId: Id<"trees"> }) {
  const { session } = useSession();
  const { theme } = useStoryTime();
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
  const fruits = yesterday.fruits.map((fruit) => ({ id: fruit.fruitId, golden: false, mine: fruit.isMine }));
  const fruitStatus = getTreeDataStatus({ fruits });

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

  return <View nativeID="story-secondary-safe-area" style={{ flex: 1 }}>
    <StatusBar style={theme.text === theme.paper ? "light" : "dark"} />
    <StoryScreen><YesterdayImpact impact={yesterday} onToday={() => { void continueToday(); }} error={error}
      onOpenLink={(url) => { void WebBrowser.openBrowserAsync(url).catch(() => {
        if (active.current) setError("The charity website couldn’t open. Please try again.");
      }); }}>
    <FruitDetailStatus status={fruitStatus} fruitCount={fruits.length} />
    {fruitStatus.status === "ready" && <Tree key={yesterday.dayId} timeOfDay={1} answers={yesterday.answererCount} mine={[]} notes={[]} lanterns={0}
      fruits={fruits} lightBundles={Math.ceil(yesterday.lightBundles / 2)} goldenLightBundles={Math.ceil(yesterday.goldenLightBundles / 2)} lightEvent={null} style={{ height: 280 }} />}
    {busy && <StoryText variant="caption">Opening today’s question…</StoryText>}
  </YesterdayImpact></StoryScreen></View>;
}
