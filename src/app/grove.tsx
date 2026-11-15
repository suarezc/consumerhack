import { useQuery } from "convex/react";

import { Empty, Screen, SessionGate, TreeNavigation } from "@/components/screens/Screen";
import { GroveThumbnail, ScreenState } from "@/design";
import { useSession } from "@/providers/SessionProvider";
import { api, type Id } from "@/services/api";

export default function Grove() {
  return <SessionGate requireTree><GroveDays /></SessionGate>;
}

function GroveDays() {
  const { session } = useSession();
  const days = useQuery(api.days.grove, session?.treeId ? { deviceId: session.deviceId, treeId: session.treeId as Id<"trees"> } : "skip");
  return <Screen title="Days we’ve grown together."><TreeNavigation />
    {days === undefined ? <ScreenState status="loading" title="Finding the grove…" /> : days.length === 0 ? <Empty title="A small beginning." message="Past days will gather here. A missed day is a bare sapling, not a failure." />
      : days.map((day) => <GroveThumbnail key={day.dayId} dayLabel={`${day.date} · UTC ritual day`} question={day.question} answers={day.answerCount} missed={!day.answered} />)}
  </Screen>;
}
