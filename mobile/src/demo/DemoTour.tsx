import { StackActions } from '@react-navigation/native';
import { useEffect } from 'react';
import { navigationRef } from '@/app/navigation/navigationRef';

/** One stop of the scripted tour per interval; lets a build be filmed or screenshotted without anyone touching it. */
const STOPS: (() => void)[] = [
  () => navigationRef.navigate('MainTabs', { screen: 'Home' }),
  () => navigationRef.navigate('MainTabs', { screen: 'Files' }),
  () => navigationRef.navigate('MainTabs', { screen: 'Announcements' }),
  () => navigationRef.navigate('Announcement', { id: 'n1' }),
  () => navigationRef.navigate('MainTabs', { screen: 'Finance' }),
  () => navigationRef.navigate('MainTabs', { screen: 'Services' }),
  () => navigationRef.navigate('Module', { code: 'tala' }),
  () => navigationRef.navigate('TalaStats'),
  () => navigationRef.navigate('TalaCourse', { assignId: 'A1', name: 'Fire Safety at Sea' }),
  () =>
    navigationRef.navigate('TalaQuiz', { assignId: 'A1', quizId: 'q1', name: 'Fire safety quiz' }),
  () =>
    navigationRef.navigate('TalaFlashcards', {
      assignId: 'A1',
      cardId: 'c1',
      name: 'Safety symbols',
    }),
  () => navigationRef.navigate('Account'),
  () =>
    navigationRef.dispatch(
      StackActions.push('TalaFlashcards', {
        assignId: 'A1',
        cardId: 'c1',
        name: 'Safety symbols',
        preview: 'answer',
      }),
    ),
];

export function DemoTour({ intervalMs = 7000 }: { intervalMs?: number }) {
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (!navigationRef.isReady()) return;
      STOPS[i % STOPS.length]!();
      i += 1;
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return null;
}
