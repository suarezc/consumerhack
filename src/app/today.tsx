import { Text } from "react-native";

import { Screen, SessionGate, TreeNavigation } from "@/components/screens/Screen";

export default function Today() {
  return <SessionGate requireTree><Screen title="Today"><TreeNavigation /><Text>Waiting for today’s question. Your answer hasn’t been submitted.</Text></Screen></SessionGate>;
}
