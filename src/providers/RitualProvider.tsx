import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { StoryTimeProvider } from "@/design";
import { useSession } from "@/providers/SessionProvider";
import { api, type Id } from "@/services/api";
import { ritualTime } from "@/services/ritual";

export type Today = NonNullable<FunctionReturnType<typeof api.days.today>>;
const RitualContext = createContext<{ today: Today | null | undefined; now: number; timeOfDay: number } | null>(null);

export function RitualProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const today = useQuery(api.days.today, session?.treeId ? {
    deviceId: session.deviceId, treeId: session.treeId as Id<"trees">,
  } : "skip");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const timeOfDay = ritualTime(now, today?.day);
  return <RitualContext.Provider value={{ today, now, timeOfDay }}>
    <StoryTimeProvider timeOfDay={timeOfDay}>{children}</StoryTimeProvider>
  </RitualContext.Provider>;
}

export function useRitual() {
  const value = useContext(RitualContext);
  if (!value) throw new Error("RitualProvider is required");
  return value;
}
