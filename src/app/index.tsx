import { StyleSheet, Text, View } from "react-native";

import { Tree } from "@/components/Tree";

export default function Today() {
  return (
    <View style={styles.screen}>
      <Text style={styles.question}>What are you carrying today that you haven’t told anyone?</Text>
      <Tree timeOfDay={0.5} answers={12} mine={[]} notes={[]} lanterns={0} style={styles.tree} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0b1030", paddingTop: 80, paddingHorizontal: 20 },
  question: { color: "#f6efe6", fontSize: 28, fontStyle: "italic" },
  tree: { flex: 1 },
});
