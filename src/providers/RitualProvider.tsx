import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { randomUUID } from "expo-crypto";
import Constants from "expo-constants";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { StoryTimeProvider } from "@/design";
import { useSession } from "@/providers/SessionProvider";
import { api, type Id } from "@/services/api";
import { ritualTime } from "@/services/ritual";
import { createGivingObserver, emptyGivingDispatch, type GivingDispatch } from "@/services/giving";
import { createNativeWidgetSync } from "@/widgets/native";
import { createWidgetSessionBridge } from "@/widgets/sessionBridge";

const widgetBridge = createWidgetSessionBridge(createNativeWidgetSync(Constants.expoConfig?.extra?.storytimeWidgetsEnabled === true));

export type Today = NonNullable<FunctionReturnType<typeof api.days.today>>;
export type FirstOpen = NonNullable<FunctionReturnType<typeof api.days.firstOpen>>;
const RitualContext = createContext<{
  today: Today | null | undefined;
  firstOpen: FirstOpen | null | undefined;
  now: number;
  timeOfDay: number;
  watering: GivingDispatch;
  consumeGivingFeedback: (id: string) => void;
} | null>(null);

export function RitualProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const today = useQuery(api.days.today, session?.treeId ? {
    deviceId: session.deviceId, treeId: session.treeId as Id<"trees">,
  } : "skip");
  const firstOpen = useQuery(api.days.firstOpen, session?.treeId ? {
    deviceId: session.deviceId, treeId: session.treeId as Id<"trees">,
  } : "skip");
  const widgetScope = useRef<ReturnType<typeof widgetBridge.beginScope> | null>(null);
  const widgetTreeId = session?.treeId;
  useEffect(() => {
    const scope = widgetBridge.beginScope();
    widgetScope.current = scope;
    return () => { widgetScope.current = null; void scope.close(); };
  }, [widgetTreeId]);
  useEffect(() => {
    if (today !== undefined) void widgetScope.current?.publish(today && { ...today, answererCount: today.answerCount });
  }, [today]);
  const [observer] = useState(() => createGivingObserver(randomUUID));
  const dispatch = useSyncExternalStore(observer.subscribe, observer.getSnapshot, () => emptyGivingDispatch);
  const contextId = today ? `${today.tree.treeId}:${today.day.dayId}:${today.streaks.clock.date}:${today.streaks.isDemo}` : null;
  const watering = dispatch.contextId === contextId ? dispatch : emptyGivingDispatch;
  const serverNow = today?.streaks.clock.now;
  const dayId = today?.day.dayId;
  const [tick, setTick] = useState<{ now: number; server: number | undefined; dayId: string | undefined }>(() => ({
    now: Date.now(), server: undefined, dayId: undefined,
  }));
  useEffect(() => {
    const started = performance.now();
    const anchor = serverNow ?? Date.now();
    const timer = setInterval(() => setTick({
      now: Math.floor(anchor + Math.max(0, performance.now() - started)), server: serverNow, dayId,
    }), 1000);
    return () => clearInterval(timer);
  }, [serverNow, dayId]);
  useEffect(() => {
    if (!today) {
      observer.reset();
      return;
    }
    observer.observe(contextId!,
      today.lightBundles, today.lightEvent, today.streaks.giving.count, today.streaks.isDemo);
  }, [observer, today, contextId]);
  const now = serverNow !== undefined && (tick.server !== serverNow || tick.dayId !== dayId) ? serverNow : tick.now;
  const timeOfDay = ritualTime(now, today?.day);
  return <RitualContext.Provider value={{ today, firstOpen, now, timeOfDay, watering, consumeGivingFeedback: observer.consumeFeedback }}>
    <StoryTimeProvider timeOfDay={timeOfDay}>{children}</StoryTimeProvider>
  </RitualContext.Provider>;
}

export function useRitual() {
  const value = useContext(RitualContext);
  if (!value) throw new Error("RitualProvider is required");
  return value;
}
