import type { StyleProp, ViewStyle } from "react-native";

export type TreeNote = {
  from: number;
  to: number;
  count: number;
  own: boolean;
};

export type TreeProps = {
  timeOfDay: number;
  answers: number;
  mine: number[];
  notes: TreeNote[];
  lanterns: number;
  onTapBlossom?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
};
