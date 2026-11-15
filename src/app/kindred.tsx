import { Text } from "react-native";

import { Screen, SessionGate, TreeNavigation } from "@/components/screens/Screen";

export default function Kindred() {
  return <SessionGate requireTree><Screen title="Kindred"><TreeNavigation /><Text>After the bloom, look for three kindred answers from other trees. No matches are available yet.</Text></Screen></SessionGate>;
}
