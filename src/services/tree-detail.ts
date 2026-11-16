import type { TreeDataStatus } from "../components/Tree";

export function treeDetailMessage(status: TreeDataStatus, fruitCount: number) {
  if (status.status === "ready") return null;
  if (status.reason === "capacity") return `Fruit detail is unavailable for this large tree (${fruitCount} ${fruitCount === 1 ? "fruit" : "fruits"}). Paid totals and streaks remain available.`;
  return "Fruit detail couldn’t be loaded. Paid totals and streaks remain available.";
}
