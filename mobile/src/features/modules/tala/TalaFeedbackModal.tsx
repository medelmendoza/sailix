import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { BrandTextInput } from '@/components/BrandTextInput';
import { AppText, Button } from '@/components';
import { colors, fonts, minTouchTarget, radius, shadows, spacing } from '@/constants/theme';
import type { Feedback } from './offline/outbox';

/**
 * Video feedback as the Tala app asks for it: a star rating (1 to 5, half stars allowed) and a comment. A video counts
 * as completed only once feedback is given; "Maybe later" leaves it incomplete, like the Tala app.
 */
export function TalaFeedbackModal({
  visible,
  title,
  onSubmit,
  onCancel,
}: {
  visible: boolean;
  title: string;
  onSubmit: (feedback: Feedback) => void;
  onCancel: () => void;
}) {
  const [stars, setStars] = useState(0);
  const [half, setHalf] = useState(false);
  const [comment, setComment] = useState('');

  const rating = stars === 0 ? 0 : half && stars >= 2 ? stars - 0.5 : stars;

  function reset() {
    setStars(0);
    setHalf(false);
    setComment('');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <AppText variant="heading" accessibilityRole="header">
            How was this video?
          </AppText>
          <AppText muted>{title}</AppText>

          <View style={styles.stars} accessibilityRole="radiogroup">
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                accessibilityRole="radio"
                accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}`}
                accessibilityState={{ checked: stars === n }}
                onPress={() => {
                  setStars(n);
                  if (n < 2) setHalf(false);
                }}
                style={styles.star}
              >
                <AppText
                  style={{
                    fontSize: 28,
                    color: n <= rating || n - 0.5 <= rating ? colors.gold : colors.borderSoft,
                  }}
                >
                  {n <= rating ? '★' : n - 0.5 === rating ? '⯨' : '☆'}
                </AppText>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Half star"
            accessibilityState={{ checked: half, disabled: stars < 2 }}
            disabled={stars < 2}
            onPress={() => setHalf((h) => !h)}
            style={[styles.half, stars < 2 && { opacity: 0.4 }]}
          >
            <AppText>{half ? '☑' : '☐'} Half star (e.g. 3.5)</AppText>
          </Pressable>
          <AppText variant="caption" muted>
            {rating > 0 ? `Your rating: ${rating} of 5` : 'Choose a rating from 1 to 5'}
          </AppText>

          <BrandTextInput
            accessibilityLabel="Comment"
            placeholder="Comment (optional)"
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={1000}
            style={styles.input}
          />
          <Button
            title="Submit feedback"
            disabled={rating < 1}
            onPress={() => {
              onSubmit({ rating, comment: comment.trim() });
              reset();
            }}
          />
          <Button
            title="Maybe later"
            variant="secondary"
            onPress={() => {
              reset();
              onCancel();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.xxl,
  },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  star: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  half: { minHeight: minTouchTarget, justifyContent: 'center' },
  input: {
    minHeight: 80,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    textAlignVertical: 'top',
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    boxShadow: shadows.inset,
  },
});
