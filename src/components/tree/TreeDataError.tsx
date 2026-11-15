import { StyleSheet, Text, View } from "react-native";

export function TreeDataError({
  reason,
}: {
  reason: "capacity" | "light-capacity" | "invalid-data";
}) {
  const title =
    reason === "light-capacity"
      ? "Giving light detail unavailable for this large tree"
      : reason === "capacity"
        ? "Fruit detail unavailable for this large tree"
        : "Fruit detail unavailable";
  const detail =
    reason !== "invalid-data"
      ? "Your giving records are unchanged."
      : "This tree’s detail couldn’t be loaded. Your giving records are unchanged.";
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={title + ". " + detail}
      style={styles.overlay}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0b1030",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#f6efe6",
    fontSize: 18,
    lineHeight: 26,
    textAlign: "center",
  },
  detail: {
    color: "#d2ccdc",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 300,
  },
});
