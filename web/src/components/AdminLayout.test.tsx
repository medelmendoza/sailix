import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AdminLayout, type NavSection } from './AdminLayout';

const sections: NavSection[] = [
  { title: 'Overview', items: [{ to: '/app', label: 'Dashboard', icon: null, end: true }] },
  {
    title: 'People',
    items: [
      { to: '/app/crew', label: 'Crew', icon: null },
      { to: '/app/members', label: 'Members', icon: null },
    ],
  },
];

const shell = () =>
  render(
    <MemoryRouter initialEntries={['/app/crew']}>
      <AdminLayout
        sections={sections}
        portalName="SFAI"
        portalKind="Admin Portal"
        user={{ name: 'Alex Admin', role: 'Administrator' }}
        onSignOut={() => {}}
        signingOut={false}
      />
    </MemoryRouter>,
  );

afterEach(() => localStorage.clear());

describe('AdminLayout menu place', () => {
  it('puts the menu along the top by default: one-page sections as links, the others as a button with a panel', async () => {
    shell();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/app');
    const people = within(nav).getByRole('button', { name: 'People' });
    expect(people).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('aside')).toBeNull(); // no side menu

    await userEvent.click(people);
    expect(people).toHaveAttribute('aria-expanded', 'true');
    expect(within(nav).getByRole('link', { name: 'Members' })).toHaveAttribute(
      'href',
      '/app/members',
    );
    await userEvent.keyboard('{Escape}');
    expect(people).toHaveAttribute('aria-expanded', 'false');
  });

  it('can be switched to the side menu, and the choice is remembered', async () => {
    const first = shell();
    await userEvent.click(screen.getByRole('button', { name: /Account menu/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Show the menu at the side' }));
    expect(document.querySelector('aside')).not.toBeNull();
    expect(localStorage.getItem('sailix.menu')).toBe('side');
    first.unmount();

    shell(); // a new page load: still at the side
    expect(document.querySelector('aside')).not.toBeNull();
    expect(screen.getByText('People')).toBeInTheDocument(); // the section title is a heading in the side menu
  });
});
