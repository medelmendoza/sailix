import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { AppText } from './AppText';
import { colors, spacing } from './theme';

/**
 * Small charts drawn with plain views, so the app needs no native chart or SVG library. Every chart is one element for
 * screen readers (`summary` says what it shows); the pieces inside are decoration.
 */

export type Segment = { value: number; color: string; label: string };

const SPOKES = 120; // a ring or pie is drawn as this many thin spokes

/** A donut (ring) or, with `thickness` equal to half the size, a pie. */
export function Donut({
  segments,
  size = 160,
  thickness = 26,
  summary,
  children,
}: {
  segments: Segment[];
  size?: number;
  thickness?: number;
  summary: string;
  /** Shown in the middle of a donut. */
  children?: ReactNode;
}) {
  const total = segments.reduce((n, s) => n + Math.max(0, s.value), 0);
  const r = size / 2;
  const mid = r - thickness / 2; // radius of the spokes' centres
  const width = ((2 * Math.PI * r) / SPOKES) * 1.4; // a little overlap hides the seams
  const spokes = Array.from({ length: SPOKES }, (_, i) => {
    const turn = (i + 0.5) / SPOKES;
    let acc = 0;
    let color: string = colors.surfaceSunken;
    if (total > 0) {
      for (const s of segments) {
        acc += Math.max(0, s.value) / total;
        if (turn <= acc + 1e-9) {
          color = s.color;
          break;
        }
      }
    }
    const angle = turn * 2 * Math.PI;
    return {
      key: i,
      color,
      left: r + mid * Math.sin(angle) - width / 2,
      top: r - mid * Math.cos(angle) - thickness / 2,
      deg: turn * 360,
    };
  });
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
      style={{ width: size, height: size }}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
        {spokes.map((s) => (
          <View
            key={s.key}
            style={{
              position: 'absolute',
              left: s.left,
              top: s.top,
              width,
              height: thickness,
              backgroundColor: s.color,
              transform: [{ rotate: `${s.deg}deg` }],
            }}
          />
        ))}
      </View>
      {children ? <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View> : null}
    </View>
  );
}

/** Colour key for a chart: a dot and a label per segment. */
export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <View style={styles.legend}>
      {items.map((i) => (
        <View key={i.label} style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: i.color }]} />
          <AppText variant="caption">{i.label}</AppText>
        </View>
      ))}
    </View>
  );
}

/** Horizontal bars, one per row, each with its value at the end. `max` is the full width of a bar. */
export function BarRows({
  rows,
  max,
  color,
  summary,
}: {
  rows: { label: string; value: number; text: string }[];
  max: number;
  color: string;
  summary: string;
}) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={{ gap: spacing.md }}>
      {rows.map((r) => (
        <View key={r.label} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: spacing.xs }}>
          <View style={styles.barHead}>
            <AppText variant="caption" numberOfLines={1} style={{ flex: 1 }}>
              {r.label}
            </AppText>
            <AppText variant="caption" style={{ fontFamily: 'Nunito_700Bold' }}>
              {r.text}
            </AppText>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { backgroundColor: color, width: `${Math.max(0, Math.min(1, max > 0 ? r.value / max : 0)) * 100}%` },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/** A line through one value per step, with a dot at each and a label under each step. */
export function LineChart({
  values,
  labels,
  color,
  height = 120,
  summary,
}: {
  values: number[];
  labels: string[];
  color: string;
  height?: number;
  summary: string;
}) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const max = Math.max(1, ...values);
  const pad = 8;
  const x = (i: number) => pad + (values.length > 1 ? (i * (w - 2 * pad)) / (values.length - 1) : (w - 2 * pad) / 2);
  const y = (v: number) => pad + (1 - v / max) * (height - 2 * pad);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={{ gap: spacing.xs }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onLayout={onLayout}
        style={{ height, borderBottomWidth: 1, borderBottomColor: colors.borderSoft }}
      >
        {w > 0
          ? values.map((v, i) => {
              const next = values[i + 1];
              const segment =
                next === undefined
                  ? null
                  : (() => {
                      const dx = x(i + 1) - x(i);
                      const dy = y(next) - y(v);
                      const len = Math.hypot(dx, dy);
                      return (
                        <View
                          style={{
                            position: 'absolute',
                            left: (x(i) + x(i + 1)) / 2 - len / 2,
                            top: (y(v) + y(next)) / 2 - 1,
                            width: len,
                            height: 2,
                            backgroundColor: color,
                            transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
                          }}
                        />
                      );
                    })();
              return (
                <View key={i} style={StyleSheet.absoluteFill}>
                  {segment}
                  <View
                    style={{
                      position: 'absolute',
                      left: x(i) - 4,
                      top: y(v) - 4,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: color,
                    }}
                  />
                </View>
              );
            })
          : null}
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.labels}>
        {labels.map((l, i) => {
          if (l === '') return null;
          // a label spans its own step and the blank steps after it, so it has room to stay on one line
          let span = 1;
          while (labels[i + span] === '') span++;
          return (
            <AppText key={i} variant="caption" muted numberOfLines={1} style={[styles.axis, { flex: span }]}>
              {l}
            </AppText>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
  barHead: { flexDirection: 'row', gap: spacing.sm, alignItems: 'baseline' },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.surfaceSunken, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  axis: { fontSize: 11 },
});
