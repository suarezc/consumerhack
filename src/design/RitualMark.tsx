import { StyleSheet, View } from 'react-native';

export function RitualMark({ kind, golden = false }: { kind: 'blossom' | 'fruit'; golden?: boolean }) {
  return <View aria-hidden accessible={false} accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants" pointerEvents="none" style={styles.mark}>
    {kind === 'blossom' ? <>
      {[0, 72, 144, 216, 288].map((angle) => <View key={angle} style={[styles.petal,
        { transform: [{ rotate: `${angle}deg` }, { translateY: -4 }] }]} />)}
      <View style={styles.center} />
    </> : <>
      <View style={[styles.fruit, { backgroundColor: golden ? '#ffd27a' : '#d7a28c' }]} />
      <View style={styles.leaf} />
    </>}
  </View>;
}

const styles = StyleSheet.create({
  mark: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  petal: { position: 'absolute', width: 6, height: 10, borderRadius: 5, backgroundColor: '#ffe9e0' },
  center: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#ffd27a' },
  fruit: { width: 12, height: 13, borderRadius: 7, marginTop: 3 },
  leaf: { position: 'absolute', top: 1, left: 9, width: 7, height: 4, borderRadius: 5, backgroundColor: '#7fa58a', transform: [{ rotate: '-30deg' }] },
});
