import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, fonts } from '@/constants/theme';
import { AppText } from './AppText';

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
  name: 'home' | 'person' | 'announce' | 'folder' | 'money' | 'case';
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
      ) : name === 'money' ? (
        <>
          <View
            style={[
              styles.abs,
              shape({ top: 2, left: 2, width: 22, height: 22, borderRadius: 11 }),
            ]}
          />
          <View style={[styles.abs, styles.centered]}>
            <AppText
              style={{
                fontFamily: fonts.heading,
                fontSize: 15,
                lineHeight: 20,
                color: filled ? colors.infoBg : color,
              }}
            >
              $
            </AppText>
          </View>
        </>
      ) : name === 'case' ? (
        <>
          <View
            style={[
              styles.abs,
              {
                top: 3,
                left: 8,
                width: 10,
                height: 7,
                borderTopLeftRadius: 3.5,
                borderTopRightRadius: 3.5,
                borderWidth: W,
                borderBottomWidth: 0,
                borderColor: color,
              },
            ]}
          />
          <View
            style={[styles.abs, shape({ top: 7, left: 2, width: 22, height: 16, borderRadius: 4 })]}
          />
          <View
            style={[
              styles.abs,
              {
                top: 14,
                left: 2,
                width: 22,
                height: W,
                backgroundColor: filled ? colors.infoBg : color,
              },
            ]}
          />
          <View
            style={[
              styles.abs,
              {
                top: 12.5,
                left: 11,
                width: 4,
                height: 4,
                borderRadius: 1,
                backgroundColor: filled ? colors.infoBg : color,
              },
            ]}
          />
        </>
      ) : name === 'announce' ? (
        <>
          <View
            style={[styles.abs, shape({ top: 2, left: 2, width: 22, height: 17, borderRadius: 6 })]}
          />
          <View
            style={[
              styles.abs,
              {
                top: 15,
                left: 6.5,
                width: 7,
                height: 7,
                borderRadius: 1.5,
                transform: [{ rotate: '45deg' }],
                ...(filled
                  ? { backgroundColor: color }
                  : {
                      backgroundColor: colors.surface,
                      borderColor: color,
                      borderRightWidth: W,
                      borderBottomWidth: W,
                    }),
              },
            ]}
          />
          <View
            style={[
              styles.abs,
              {
                top: 6.2,
                left: 11.3,
                width: 2.4,
                height: 6,
                borderRadius: 1.2,
                backgroundColor: filled ? colors.infoBg : color,
              },
            ]}
          />
          <View
            style={[
              styles.abs,
              {
                top: 13.6,
                left: 11.3,
                width: 2.4,
                height: 2.4,
                borderRadius: 1.2,
                backgroundColor: filled ? colors.infoBg : color,
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
  centered: {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
