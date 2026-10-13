import { AppText } from './AppText';
import { Screen } from './Screen';

/** M0 stand-in; each is replaced by its feature screen in a later milestone. */
export function PlaceholderScreen({ title, milestone }: { title: string; milestone: string }) {
  return (
    <Screen>
      <AppText variant="heading">{title}</AppText>
      <AppText muted>Coming in {milestone}.</AppText>
    </Screen>
  );
}
