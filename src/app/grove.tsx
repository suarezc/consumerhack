import { Text } from "react-native";

import { Screen, SessionGate, TreeNavigation } from "@/components/screens/Screen";

export default function Grove() {
  return <SessionGate requireTree><Screen title="Your grove"><TreeNavigation /><Text>Past days will gather here. No history has loaded yet.</Text></Screen></SessionGate>;
}
