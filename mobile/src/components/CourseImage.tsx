import { useState, type ReactNode } from 'react';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, gradients, typography } from '@/constants/theme';
import { AppText } from './AppText';
import { useBrand } from '@/theme/brand';

/**
 * A course picture. While there is none (no address, offline, or the picture fails to load) a soft placeholder shows
 * instead, with the course's first letter, so the layout never collapses or shows a broken-image symbol.
 */
export function CourseImage({
  uri,
  title,
  style,
  fallback,
}: {
  uri: string | null;
  title: string;
  style: ViewStyle;
  /** Shown instead of the first-letter placeholder (e.g. an icon for a material type). */
  fallback?: ReactNode;
}) {
  const brand = useBrand();
  const [failed, setFailed] = useState(false);
  const showPicture = uri !== null && !failed;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, style]}
    >
      {showPicture ? (
        <Image
          source={{ uri }}
          resizeMode="cover"
          onError={() => setFailed(true)}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View
          key={fallback ? 'tile' : brand.gradients.soft}
          style={[
            StyleSheet.absoluteFill,
            fallback
              ? styles.tile
              : [
                  styles.placeholder,
                  {
                    backgroundColor: brand.primary,
                    experimental_backgroundImage: brand.gradients.soft,
                  },
                ],
          ]}
        >
          {fallback ?? (
            <AppText style={[typography.title, styles.initial]}>
              {title.trim().charAt(0).toUpperCase() || '•'}
            </AppText>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: colors.surfaceSunken },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.seafoam,
    experimental_backgroundImage: gradients.soft,
  },
  tile: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSunken },
  initial: { color: colors.onPrimary, fontSize: 40, lineHeight: 48, opacity: 0.9 },
});
