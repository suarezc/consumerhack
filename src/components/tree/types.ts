import type { StyleProp, ViewStyle } from "react-native";

export type TreeNote = {
  from: number;
  to: number;
  count: number;
  own: boolean;
};

export type TreeFruit = {
  id: string;
  golden: boolean;
  mine?: boolean;
};

export type TreeWateringEvent = {
  id: string;
  fruitId: string;
  revision: number;
};

export type TreeProps = {
  timeOfDay: number;
  answers: number;
  mine: number[];
  notes: TreeNote[];
  lanterns: number;
  fruits?: readonly TreeFruit[];
  wateringEvent?: TreeWateringEvent | null;
  onTapBlossom?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
};
