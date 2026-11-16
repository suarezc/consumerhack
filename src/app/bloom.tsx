import { DailyTree } from "@/components/screens/DailyTree";
import { SessionGate } from "@/components/screens/Screen";

export default function Bloom() {
  return <SessionGate requireTree><DailyTree bloom /></SessionGate>;
}
