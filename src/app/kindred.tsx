import { Empty, Screen, SessionGate, TreeNavigation } from "@/components/screens/Screen";
import { useRitual } from "@/providers/RitualProvider";

export default function Kindred() {
  return <SessionGate requireTree><KindredAnswers /></SessionGate>;
}

function KindredAnswers() {
  const { today } = useRitual();
  return <Screen title="Somewhere, someone understands."><TreeNavigation />
    <Empty title={today?.myAnswer && today.day.bloomedAt !== undefined ? "Finding your kindred…" : "A little patience."}
      message={today?.myAnswer && today.day.bloomedAt !== undefined ? "Kindred matching is not available yet. Your circle’s answers are waiting in Bloom." : "Answer today’s question and wait for the bloom to find kindred answers from other trees."} />
  </Screen>;
}
