import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { AppText } from './AppText';
import { colors, spacing } from './theme';

/**
 * Charts drawn with react-native-svg. Every chart is one element for screen readers (`summary` says what it shows); the
 * drawing inside is decoration.
 */

export type Segment = { value: number; color: string; label: string; onPress?: () => void };

const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

/**
 * A donut (ring) or, with `thickness` equal to half the size, a pie: one circle per segment, stroked with a dash that is
 * as long as the segment's share, with a hairline gap between segments.
 */
export function Donut({
  segments,
  size = 160,
  thickness = 18,
  rounded = true,
  summary,
  children,
}: {
  segments: Segment[];
  size?: number;
  thickness?: number;
  /** Round ends on the segments (good for a few segments; many small ones look better square). */
  rounded?: boolean;
  summary: string;
  /** Shown in the middle of a donut. */
  children?: ReactNode;
}) {
  const total = segments.reduce((n, s) => n + Math.max(0, s.value), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const several = total > 0 && segments.filter((s) => s.value > 0).length > 1;
  const round = rounded && several && thickness < size / 4; // a pie (thick) keeps square edges
  const gap = several ? 4 : 0; // visible space between segments
  const pad = round ? thickness : 0; // a round cap sticks out half a stroke at each end: take it out of the dash
  let offset = 0;
  const arcs =
    total > 0
      ? segments
          .filter((s) => s.value > 0)
          .map((s) => {
            const len = (s.value / total) * circumference;
            const arc = { key: s.label, color: s.color, dash: Math.max(0.01, len - gap - pad), at: offset, onPress: s.onPress };
            offset += len;
            return arc;
          })
      : [];
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={{ width: size, height: size }}>
      <View style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
            {total === 0 ? (
              <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.surfaceSunken} strokeWidth={thickness} fill="none" />
            ) : (
              arcs.map((a) => (
                <Circle
                  key={a.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={a.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${a.dash} ${circumference}`}
                  strokeDashoffset={-(a.at + (gap + pad) / 2)}
                  strokeLinecap={round ? 'round' : 'butt'}
                  fill="none"
                  onPress={a.onPress}
                />
              ))
            )}
          </G>
        </Svg>
      </View>
      {children ? <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View> : null}
    </View>
  );
}

/** Colour key for a chart: a dot and a label per segment; an item with `onPress` is a button that opens what it counts. */
export function Legend({ items }: { items: { color: string; label: string; onPress?: () => void }[] }) {
  return (
    <View style={styles.legend}>
      {items.map((i) => {
        const inner = (
          <>
            <View style={[styles.dot, { backgroundColor: i.color }]} />
            <AppText variant="caption">{i.label}</AppText>
          </>
        );
        return i.onPress ? (
          <Pressable
            key={i.label}
            accessibilityRole="button"
            accessibilityLabel={i.label}
            accessibilityHint="Shows these courses"
            onPress={i.onPress}
            hitSlop={6}
            style={styles.legendItem}
          >
            {inner}
          </Pressable>
        ) : (
          <View key={i.label} style={styles.legendItem}>
            {inner}
          </View>
        );
      })}
    </View>
  );
}

/** Horizontal bars, one per row, each with its value at the end; a row with `onPress` is a button. `max` is a full bar. */
export function BarRows({
  rows,
  max,
  color,
}: {
  rows: { label: string; value: number; text: string; color?: string; onPress?: () => void }[];
  max: number;
  color: string;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      {rows.map((r) => {
        const inner = (
          <>
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
                  { backgroundColor: r.color ?? color, width: `${Math.max(0, Math.min(1, max > 0 ? r.value / max : 0)) * 100}%` },
                ]}
              />
            </View>
          </>
        );
        return r.onPress ? (
          <Pressable
            key={r.label}
            accessibilityRole="button"
            accessibilityLabel={`${r.label}, ${r.text}`}
            accessibilityHint="Opens this course"
            onPress={r.onPress}
            style={({ pressed }) => [{ gap: spacing.xs }, pressed && { opacity: 0.6 }]}
          >
            {inner}
          </Pressable>
        ) : (
          <View key={r.label} accessible accessibilityLabel={`${r.label}, ${r.text}`} style={{ gap: spacing.xs }}>
            {inner}
          </View>
        );
      })}
    </View>
  );
}

/** A smooth curve through one value per step (monotone: it never dips below a point or overshoots one). */
function curve(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  const n = points.length;
  const dx = points.slice(1).map((p, i) => p.x - points[i]!.x);
  const slope = points.slice(1).map((p, i) => (p.y - points[i]!.y) / dx[i]!);
  const tangent = points.map((_, i) => {
    if (i === 0) return slope[0]!;
    if (i === n - 1) return slope[n - 2]!;
    return slope[i - 1]! * slope[i]! <= 0 ? 0 : (slope[i - 1]! + slope[i]!) / 2;
  });
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < n - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const h = dx[i]! / 3;
    d += ` C ${a.x + h} ${a.y + tangent[i]! * h}, ${b.x - h} ${b.y - tangent[i + 1]! * h}, ${b.x} ${b.y}`;
  }
  return d;
}

/** A smooth line with a soft fill under it, light grid lines, a dot on each point and a label under some steps. */
export function LineChart({
  values,
  labels,
  color,
  height = 130,
  summary,
  columns,
}: {
  values: number[];
  labels: string[];
  color: string;
  height?: number;
  summary: string;
  /** One entry per step: what a tap on that step says and does. Steps without one are not tappable. */
  columns?: ({ label: string; onPress: () => void } | null)[];
}) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const max = Math.max(1, ...values);
  const padX = 10;
  const padTop = 12;
  const padBottom = 8;
  const x = (i: number) => padX + (values.length > 1 ? (i * (w - 2 * padX)) / (values.length - 1) : (w - 2 * padX) / 2);
  const y = (v: number) => padTop + (1 - v / max) * (height - padTop - padBottom);
  const pts = values.map((v, i) => ({ x: x(i), y: y(v) }));
  const line = curve(pts);
  const area = pts.length > 1 ? `${line} L ${pts[pts.length - 1]!.x} ${height - padBottom} L ${pts[0]!.x} ${height - padBottom} Z` : '';
  return (
    <View style={{ gap: spacing.xs }}>
      <View accessible accessibilityRole="image" accessibilityLabel={summary} onLayout={onLayout} style={{ height }}>
        {w > 0 ? (
          <Svg width={w} height={height}>
            <Defs>
              <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity="0.28" />
                <Stop offset="1" stopColor={color} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            {[0, 0.5, 1].map((t) => (
              <Line
                key={t}
                x1={0}
                x2={w}
                y1={padTop + t * (height - padTop - padBottom)}
                y2={padTop + t * (height - padTop - padBottom)}
                stroke={colors.borderSoft}
                strokeWidth={1}
              />
            ))}
            {area ? <Path d={area} fill="url(#fade)" /> : null}
            <Path d={line} stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {pts.map((p, i) =>
              values[i]! > 0 ? <Circle key={i} cx={p.x} cy={p.y} r={4} fill={colors.surface} stroke={color} strokeWidth={2} /> : null,
            )}
          </Svg>
        ) : null}
      </View>
      {columns ? (
        <View style={[styles.columns, { height }]}>
          {columns.map((c, i) =>
            c ? (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={c.label}
                accessibilityHint="Shows these courses"
                onPress={c.onPress}
                style={{ flex: 1 }}
              />
            ) : (
              <View key={i} style={{ flex: 1 }} />
            ),
          )}
        </View>
      ) : null}
      <View {...hidden} style={styles.labels}>
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
  track: { height: 12, borderRadius: 6, backgroundColor: colors.surfaceSunken, overflow: 'hidden' },
  fill: { height: 12, borderRadius: 6 },
  labels: { flexDirection: 'row' },
  columns: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row' },
  axis: { fontSize: 11 },
});
