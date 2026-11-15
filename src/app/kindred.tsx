import { useQuery } from "convex/react";
import { View } from "react-native";

import { Empty, Screen, SessionGate, TreeNavigation } from "@/components/screens/Screen";
import { ScreenState, StoryText, useStoryTime } from "@/design";
import { useRitual } from "@/providers/RitualProvider";
import { useSession } from "@/providers/SessionProvider";
import { api } from "@/services/api";

export default function Kindred() {
  return <SessionGate requireTree><KindredAnswers /></SessionGate>;
}

function KindredAnswers() {
  const { today } = useRitual();
  const { session } = useSession();
  const { theme } = useStoryTime();
  const result = useQuery(api.judges.kindred, session && today ? { deviceId: session.deviceId, dayId: today.day.dayId } : "skip");

  return <Screen title="Somewhere, someone understands."><TreeNavigation />
    {!today || result === undefined ? <ScreenState status="loading" title="Finding your kindred…" />
      : result.status === "locked" ? <Empty title="A little patience." message="Answer today’s question and wait for the bloom to find kindred answers from other trees." />
      : result.status === "pending" ? <ScreenState status="loading" title="Finding a shared feeling…" message="The judges are still listening. Your kindred answers will appear here." />
      : result.matches.length === 0 ? <Empty title="A quiet day." message="No kindred answers were found for this day. Your circle is still waiting in Bloom." />
      : <>
        <StoryText variant="caption">{today.day.isDemo ? "Demo matches · sample answers from sample trees." : `${result.matches.length} kindred ${result.matches.length === 1 ? "answer" : "answers"} from other trees. Up to three, when a shared feeling is found.`}</StoryText>
        {result.matches.map((match) => <View key={match.answerId} style={{ padding: 20, gap: 12, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.panel }}>
          <StoryText variant="meta" color={theme.muted}>{match.treeName}</StoryText>
          <StoryText variant="question" color={theme.paper}>{match.text}</StoryText>
          <StoryText variant="caption" color={theme.lantern}>{match.reason}</StoryText>
        </View>)}
      </>}
  </Screen>;
}
