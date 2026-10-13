import { createNavigationContainerRef } from '@react-navigation/native';
import type { AppStackParamList } from './types';

/** Lets code outside a screen navigate (used by the demo tour). */
export const navigationRef = createNavigationContainerRef<AppStackParamList>();
