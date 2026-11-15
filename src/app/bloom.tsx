import { Text } from "react-native";

import { Screen, SessionGate, TreeNavigation } from "@/components/screens/Screen";

export default function Bloom() {
  return <SessionGate requireTree><Screen title="Bloom"><TreeNavigation /><Text>Answers stay closed until you’ve answered and the tree has bloomed.</Text><Text>Private notes and lantern checkout aren’t available yet.</Text></Screen></SessionGate>;
}
