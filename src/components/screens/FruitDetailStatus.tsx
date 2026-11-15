import type { TreeDataStatus } from "@/components/Tree";
import { StoryText } from "@/design";
import { treeDetailMessage } from "@/services/tree-detail";

export function FruitDetailStatus({ status, fruitCount, color }: { status: TreeDataStatus; fruitCount: number; color?: string }) {
  const message = treeDetailMessage(status, fruitCount);
  return message ? <StoryText variant="caption" color={color} accessibilityRole="alert">{message}</StoryText> : null;
}
