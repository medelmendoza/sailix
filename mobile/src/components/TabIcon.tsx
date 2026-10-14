import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors } from '@/constants/theme';

const W = 2.2; // stroke of the outlined icons

/**
 * Simple tab icons drawn from plain shapes: no icon font, no emoji (which renders unreliably across devices and
 * runtimes), and they take the tab's tint colour. `filled` draws them solid (the open tab, and the round icons on the
 * Dashboard); `filled={false}` draws them as rounded outlines (the other tabs). Hidden from screen readers; the label speaks.
 */
export function TabIcon({
  name,
  color,
  filled = true,
}: {
  name: 'home' | 'person' | 'bell' | 'folder' | 'coins' | 'grid';
  color: string;
  filled?: boolean;
}) {
  // a solid shape, or just its rounded outline
  const shape = (extra: ViewStyle = {}): ViewStyle =>
    filled
      ? { backgroundColor: color, ...extra }
      : { borderColor: color, borderWidth: W, ...extra };
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.box}
    >
      {name === 'folder' ? (
        <>
          <View
            style={[
              styles.abs,
              shape({
                top: 4,
                left: 2,
                width: 11,
                height: 8,
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
                borderBottomWidth: 0,
              }),
            ]}
          />
          <View
            style={[styles.abs, shape({ top: 8, left: 2, width: 22, height: 15, borderRadius: 4 })]}
          />
        </>
      ) : name === 'coins' ? (
        <>
          <View
            style={[
              styles.abs,
              { top: 2, right: 2, width: 15, height: 15, borderRadius: 8 },
              { borderColor: color, borderWidth: W },
            ]}
          />
          <View
            style={[
              styles.abs,
              shape({
                bottom: 2,
                left: 2,
                width: 15,
                height: 15,
                borderRadius: 8,
                ...(filled ? {} : { backgroundColor: colors.surface }),
              }),
            ]}
          />
        </>
      ) : name === 'grid' ? (
        <>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.abs,
                shape({
                  width: 10,
                  height: 10,
                  borderRadius: 3.5,
                  left: 2 + (i % 2) * 12,
                  top: 2 + Math.floor(i / 2) * 12,
                }),
              ]}
            />
          ))}
        </>
      ) : name === 'bell' ? (
        <>
          <View
            style={[
              styles.abs,
              shape({
                top: 2,
                left: 4,
                width: 18,
                height: 15,
                borderTopLeftRadius: 9,
                borderTopRightRadius: 9,
                borderBottomLeftRadius: 3,
                borderBottomRightRadius: 3,
              }),
            ]}
          />
          <View
            style={[
              styles.abs,
              {
                top: 17,
                left: 2,
                width: 22,
                height: W + 0.8,
                borderRadius: 2,
                backgroundColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.abs,
              {
                top: 21,
                left: 9,
                width: 8,
                height: 4,
                borderBottomLeftRadius: 4,
                borderBottomRightRadius: 4,
                backgroundColor: color,
              },
            ]}
          />
        </>
      ) : name === 'home' ? (
        <>
          <View
            style={[
              styles.abs,
              shape({
                top: 4,
                left: 6.5,
                width: 13,
                height: 13,
                borderRadius: 3,
                transform: [{ rotate: '45deg' }],
                ...(filled ? {} : { borderRightWidth: 0, borderBottomWidth: 0 }),
              }),
            ]}
          />
          <View
            style={[
              styles.abs,
              shape({
                bottom: 2,
                left: 4,
                width: 18,
                height: 12,
                borderBottomLeftRadius: 5,
                borderBottomRightRadius: 5,
                ...(filled ? {} : { borderTopWidth: 0 }),
              }),
            ]}
          />
          <View
            style={[
              styles.abs,
              {
                bottom: 2,
                left: 10.5,
                width: 5,
                height: 7,
                borderTopLeftRadius: 2.5,
                borderTopRightRadius: 2.5,
                backgroundColor: filled ? colors.surface : color,
              },
            ]}
          />
        </>
      ) : (
        <>
          <View
            style={[styles.abs, shape({ top: 2, left: 8, width: 10, height: 10, borderRadius: 5 })]}
          />
          <View
            style={[
              styles.abs,
              shape({
                bottom: 2,
                left: 3,
                width: 20,
                height: 10,
                borderTopLeftRadius: 10,
                borderTopRightRadius: 10,
                borderBottomLeftRadius: 3,
                borderBottomRightRadius: 3,
              }),
            ]}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 26, height: 26 },
  abs: { position: 'absolute' },
});
