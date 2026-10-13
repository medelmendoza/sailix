import { StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';

/**
 * Two simple tab icons drawn from plain shapes: no icon font, no emoji (which renders unreliably across devices and
 * runtimes), and they take the tab's tint colour. Hidden from screen readers; the tab label speaks.
 */
export function TabIcon({ name, color }: { name: 'home' | 'person'; color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.box}
    >
      {name === 'home' ? (
        <>
          <View style={[styles.roof, { backgroundColor: color }]} />
          <View style={[styles.house, { backgroundColor: color }]}>
            <View style={styles.door} />
          </View>
        </>
      ) : (
        <>
          <View style={[styles.head, { backgroundColor: color }]} />
          <View style={[styles.shoulders, { backgroundColor: color }]} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  roof: {
    position: 'absolute',
    top: 3,
    width: 14,
    height: 14,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  house: {
    position: 'absolute',
    bottom: 2,
    width: 18,
    height: 12,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  door: {
    width: 5,
    height: 7,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    backgroundColor: colors.surface,
  },
  head: { position: 'absolute', top: 2, width: 10, height: 10, borderRadius: 5 },
  shoulders: {
    position: 'absolute',
    bottom: 2,
    width: 20,
    height: 10,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
});
