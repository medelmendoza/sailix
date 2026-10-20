import { Pressable, StyleSheet, View } from 'react-native';
import { colors, minTouchTarget, radius } from '@/constants/theme';
import { AppText } from './AppText';
import { useBrand } from '@/theme/brand';

/** A pill-shaped segmented control: one choice of a few, the picked one lifted on a quiet track. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const brand = useBrand();
  return (
    <View style={styles.track} accessibilityRole="radiogroup">
      {options.map((o) => {
        const picked = value === o.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: picked }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={[styles.segment, picked && styles.picked]}
          >
            <AppText variant="button" style={{ color: picked ? brand.primary : colors.textMuted }}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
  },
  segment: {
    flex: 1,
    minHeight: minTouchTarget - 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  picked: { backgroundColor: colors.surface, boxShadow: '0 1px 4px rgba(18, 36, 61, 0.15)' },
});
