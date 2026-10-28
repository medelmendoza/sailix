import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

/**
 * The floating tab bar shrinks while you scroll down and grows back when you scroll up (as on Instagram).
 * One shared value (0 = full size, 1 = shrunk) is driven by the scrolling of whichever tab screen is open.
 */
export const tabBarCollapse = new Animated.Value(0);

let collapsed = false;
let lastY = 0;

export function setTabBarCollapsed(next: boolean) {
  if (next === collapsed) return;
  collapsed = next;
  Animated.timing(tabBarCollapse, {
    toValue: next ? 1 : 0,
    duration: 220,
    useNativeDriver: true,
  }).start();
}

/** Back to full size, for example when another tab opens. */
export function resetTabBar() {
  lastY = 0;
  setTabBarCollapsed(false);
}

/** Give this to a tab screen's ScrollView as `onScroll` (with `scrollEventThrottle={16}`). */
export function onTabScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
  const y = e.nativeEvent.contentOffset.y;
  const dy = y - lastY;
  lastY = y;
  if (y <= 16) setTabBarCollapsed(false);
  else if (dy > 8) setTabBarCollapsed(true);
  else if (dy < -8) setTabBarCollapsed(false);
}
