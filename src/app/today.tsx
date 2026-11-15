import { DailyTree } from "@/components/screens/DailyTree";
import { SessionGate } from "@/components/screens/Screen";

export default function Today() {
  return <SessionGate requireTree><DailyTree /></SessionGate>;
}
