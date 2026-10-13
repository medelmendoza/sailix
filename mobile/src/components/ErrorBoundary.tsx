import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import { reportCrash } from '@/services/crashReporter';
import { AppText } from './AppText';
import { Button } from './Button';

type State = { failed: boolean };

/**
 * Last line of defence for a screen that throws while rendering: instead of a blank or frozen app the person sees a
 * calm message and a way to try again. It shows nothing about the error itself (no stack, no message).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    reportCrash(error, { source: 'render' });
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.box} accessibilityRole="alert">
        <AppText variant="title" accessibilityRole="header">
          Something went wrong
        </AppText>
        <AppText muted style={styles.text}>
          The app hit a problem. Your data is safe. Try again, and if it keeps happening, restart
          the app.
        </AppText>
        <Button title="Try again" onPress={() => this.setState({ failed: false })} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  text: { textAlign: 'center' },
});
