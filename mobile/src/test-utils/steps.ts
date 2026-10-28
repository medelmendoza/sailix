import { fireEvent, screen } from '@testing-library/react-native';

/**
 * The steps nearly every screen test starts with, in ONE place. When wording or layout changes (the Dashboard greeting, the
 * name of a tab), this file changes instead of dozens of tests.
 */

/** The Dashboard has appeared: it is the first screen after signing in. */
export async function dashboardReady(name = 'Maria'): Promise<void> {
  await screen.findByRole('header', { name });
}

/** Presses a bottom tab. The Services tab is told apart from the Dashboard's Services shortcut. */
export async function goToTab(
  tab: 'Dashboard' | 'Files' | 'Announcements' | 'Finance' | 'Services',
): Promise<void> {
  const label = tab === 'Announcements' ? /^Announcements/ : new RegExp(`^${tab}, tab`);
  await fireEvent.press(await screen.findByLabelText(label));
}

/** Opens a service from the Services tab by the start of its card's name, for example `openService('Lodestar,')`. */
export async function openService(nameStart: string): Promise<void> {
  await goToTab('Services');
  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(`^${nameStart}`) }));
}

export const openTala = () => openService('Lodestar,');
