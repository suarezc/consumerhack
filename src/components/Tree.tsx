import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

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

export function Tree({ timeOfDay, answers, lanterns, style }: TreeProps) {
  return (
    <View style={[styles.placeholder, style]}>
      <Text style={styles.label}>
        Tree placeholder · {answers} answers · {lanterns} lanterns · t={timeOfDay.toFixed(2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: "center", justifyContent: "center" },
  label: { color: "#f6efe6", fontFamily: "Menlo" },
});
