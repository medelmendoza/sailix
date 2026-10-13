import { StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';

/**
 * Two simple tab icons drawn from plain shapes: no icon font, no emoji (which renders unreliably across devices and
 * runtimes), and they take the tab's tint colour. Hidden from screen readers; the tab label speaks.
 */
export function TabIcon({
  name,
  color,
}: {
  name: 'home' | 'person' | 'bell' | 'folder' | 'coins' | 'grid';
  color: string;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.box}
    >
      {name === 'folder' ? (
        <>
          <View style={[styles.folderTab, { backgroundColor: color }]} />
          <View style={[styles.folderBody, { backgroundColor: color }]} />
        </>
      ) : name === 'coins' ? (
        <>
          <View style={[styles.coinBack, { borderColor: color }]} />
          <View style={[styles.coinFront, { backgroundColor: color }]} />
        </>
      ) : name === 'grid' ? (
        <>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.cell,
                { backgroundColor: color, left: 2 + (i % 2) * 12, top: 2 + Math.floor(i / 2) * 12 },
              ]}
            />
          ))}
        </>
      ) : name === 'bell' ? (
        <>
          <View style={[styles.bellDome, { backgroundColor: color }]} />
          <View style={[styles.bellRim, { backgroundColor: color }]} />
          <View style={[styles.bellClapper, { backgroundColor: color }]} />
        </>
      ) : name === 'home' ? (
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
  folderTab: {
    position: 'absolute',
    top: 3,
    left: 2,
    width: 10,
    height: 6,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  folderBody: { position: 'absolute', top: 8, left: 2, width: 22, height: 15, borderRadius: 3 },
  coinBack: {
    position: 'absolute',
    top: 3,
    right: 2,
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 2.5,
  },
  coinFront: { position: 'absolute', bottom: 3, left: 2, width: 15, height: 15, borderRadius: 8 },
  cell: { position: 'absolute', width: 10, height: 10, borderRadius: 3 },
  bellDome: {
    position: 'absolute',
    top: 3,
    width: 16,
    height: 14,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  bellRim: { position: 'absolute', top: 16, width: 22, height: 3, borderRadius: 2 },
  bellClapper: { position: 'absolute', top: 20, width: 7, height: 4, borderRadius: 3 },
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
