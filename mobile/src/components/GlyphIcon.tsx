import { StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';
import { AppText } from './AppText';

export type GlyphName =
  'person' | 'clock' | 'download' | 'trash' | 'video' | 'pdf' | 'quiz' | 'cards' | 'check';

/**
 * A tiny icon set drawn from plain shapes: no icon font and no emoji (both rendered unreliably in this app's runtimes),
 * and every icon takes its colour from the caller. Always decorative: whatever it sits next to carries the meaning.
 */
export function GlyphIcon({
  name,
  color = colors.primary,
  size = 24,
}: {
  name: GlyphName;
  color?: string;
  size?: number;
}) {
  const u = size / 24; // all shapes are drawn on a 24 x 24 grid
  const fill = { backgroundColor: color };
  const line = { borderColor: color };
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      {name === 'person' && (
        <>
          <View style={[fill, abs(8 * u, 2 * u, 8 * u, 8 * u), { borderRadius: 4 * u }]} />
          <View
            style={[
              fill,
              abs(3 * u, 13 * u, 18 * u, 9 * u),
              {
                borderTopLeftRadius: 9 * u,
                borderTopRightRadius: 9 * u,
                borderBottomLeftRadius: 2 * u,
                borderBottomRightRadius: 2 * u,
              },
            ]}
          />
        </>
      )}
      {name === 'clock' && (
        <>
          <View
            style={[
              line,
              abs(2 * u, 2 * u, 20 * u, 20 * u),
              { borderWidth: 2 * u, borderRadius: 10 * u },
            ]}
          />
          <View style={[fill, abs(11 * u, 6 * u, 2 * u, 7 * u), { borderRadius: u }]} />
          <View style={[fill, abs(11 * u, 11 * u, 6 * u, 2 * u), { borderRadius: u }]} />
        </>
      )}
      {name === 'download' && (
        <>
          <View style={[fill, abs(11 * u, 3 * u, 2.4 * u, 11 * u), { borderRadius: u }]} />
          <View
            style={[
              line,
              abs(7.5 * u, 7.5 * u, 9 * u, 9 * u),
              {
                borderRightWidth: 2.4 * u,
                borderBottomWidth: 2.4 * u,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
          <View style={[fill, abs(4 * u, 19 * u, 16 * u, 2.4 * u), { borderRadius: u }]} />
        </>
      )}
      {name === 'trash' && (
        <>
          <View style={[fill, abs(3 * u, 5 * u, 18 * u, 2.4 * u), { borderRadius: u }]} />
          <View
            style={[
              fill,
              abs(9 * u, 2 * u, 6 * u, 3 * u),
              { borderTopLeftRadius: 2 * u, borderTopRightRadius: 2 * u },
            ]}
          />
          <View
            style={[
              line,
              abs(5 * u, 8 * u, 14 * u, 14 * u),
              {
                borderWidth: 2.2 * u,
                borderBottomLeftRadius: 3 * u,
                borderBottomRightRadius: 3 * u,
              },
            ]}
          />
        </>
      )}
      {name === 'video' && (
        <>
          <View
            style={[
              line,
              abs(2 * u, 4 * u, 20 * u, 16 * u),
              { borderWidth: 2.2 * u, borderRadius: 4 * u },
            ]}
          />
          <View
            style={[
              abs(9.5 * u, 8 * u, 0, 0),
              {
                borderTopWidth: 4 * u,
                borderBottomWidth: 4 * u,
                borderLeftWidth: 7 * u,
                borderTopColor: 'transparent',
                borderBottomColor: 'transparent',
                borderLeftColor: color,
              },
            ]}
          />
        </>
      )}
      {name === 'pdf' && (
        <>
          <View
            style={[
              line,
              abs(4 * u, 2 * u, 16 * u, 20 * u),
              { borderWidth: 2.2 * u, borderRadius: 3 * u },
            ]}
          />
          <View style={[fill, abs(8 * u, 8 * u, 8 * u, 2 * u)]} />
          <View style={[fill, abs(8 * u, 12 * u, 8 * u, 2 * u)]} />
          <View style={[fill, abs(8 * u, 16 * u, 5 * u, 2 * u)]} />
        </>
      )}
      {name === 'quiz' && (
        <>
          <View
            style={[
              line,
              abs(2 * u, 2 * u, 20 * u, 20 * u),
              { borderWidth: 2.2 * u, borderRadius: 10 * u },
            ]}
          />
          <AppText
            style={{ color, fontSize: 14 * u, lineHeight: 18 * u, fontFamily: 'Quicksand_700Bold' }}
          >
            ?
          </AppText>
        </>
      )}
      {name === 'cards' && (
        <>
          <View
            style={[
              line,
              abs(2 * u, 3 * u, 14 * u, 15 * u),
              { borderWidth: 2.2 * u, borderRadius: 3 * u, transform: [{ rotate: '-8deg' }] },
            ]}
          />
          <View
            style={[
              line,
              abs(8 * u, 6 * u, 14 * u, 15 * u),
              { borderWidth: 2.2 * u, borderRadius: 3 * u, backgroundColor: colors.surface },
            ]}
          />
        </>
      )}
      {name === 'check' && (
        <View
          style={[
            line,
            abs(6 * u, 4 * u, 7 * u, 13 * u),
            { borderRightWidth: 3 * u, borderBottomWidth: 3 * u, transform: [{ rotate: '45deg' }] },
          ]}
        />
      )}
    </View>
  );
}

const abs = (left: number, top: number, width: number, height: number) =>
  StyleSheet.flatten({ position: 'absolute' as const, left, top, width, height });
