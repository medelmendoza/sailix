import { screen } from '@testing-library/react-native';
import { makeMe } from '@/test-utils/fixtures';
import { mockApi } from '@/test-utils/mockApi';
import { renderApp } from '@/test-utils/render';
import { signedInAs } from '@/test-utils/session';
import { dashboardReady } from '@/test-utils/steps';

describe('features the platform switched off for the organization', () => {
  it('are not offered: no shortcut, no tile and no tab', async () => {
    mockApi({});
    signedInAs(
      makeMe({
        feature_access: {
          documents: false,
          announcements: false,
          finance: false,
          todos: false,
          feedback: false,
        },
      }),
    );
    await renderApp();
    await dashboardReady();

    for (const gone of [
      'Upload documents',
      'View finances',
      'To-do list',
      'Documents',
      'Files',
      'Announcements',
      'Finance',
    ]) {
      expect(screen.queryByRole('button', { name: gone })).toBeNull();
    }
    expect(screen.getByRole('button', { name: 'Services' })).toBeTruthy();
  });

  it('are all offered when the organization has none switched off', async () => {
    mockApi({});
    signedInAs(makeMe());
    await renderApp();
    await dashboardReady();

    expect(screen.getByRole('button', { name: 'Upload documents' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View finances' })).toBeTruthy();
    expect(screen.getByText('To-do list')).toBeTruthy();
  });
});
