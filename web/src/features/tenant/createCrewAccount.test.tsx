import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { asTenantAdmin, pageOf, renderApp, V1 } from '../../../tests/helpers';
import { server } from '../../../tests/server';
import type { Crew } from '../../services/api/types';

const applicant = {
  id: 'c1',
  status: 'pending',
  username: 'user-c1',
  email: 'c1@example.test',
  first_name: 'Jaycob',
  middle_name: null,
  last_name: 'Bustamante',
  suffix: null,
  mobile: null,
  crew_number: null,
  rank: null,
  fleet: null,
  vessel: null,
  employment_status: null,
  date_arrive: null,
  date_depart: null,
} as Crew;

function api() {
  const empty = http.get(`${V1}/tenant/documents`, () => HttpResponse.json(pageOf([])));
  server.use(
    http.get(`${V1}/tenant/crew`, () => HttpResponse.json(pageOf([applicant], { total: 1 }))),
    empty,
    http.get(`${V1}/tenant/announcements`, () => HttpResponse.json(pageOf([]))),
    http.get(`${V1}/tenant/deletion-requests`, () => HttpResponse.json(pageOf([]))),
    http.get(`${V1}/tenant/dashboard`, () =>
      HttpResponse.json({
        data: {
          crew: { total: 1, pending: pageOf([applicant], { total: 1 }) },
          documents: { pending: pageOf([]) },
          announcements: { latest: pageOf([]) },
          deletion_requests: { open: 0 },
        },
      }),
    ),
  );
}

describe('Create crew account (from the user application panel)', () => {
  it('opens from the applicant, searches the CMS with the applicant already typed, and links an account', async () => {
    asTenantAdmin();
    api();
    const { user } = renderApp('/app');

    await user.click(await screen.findByRole('button', { name: 'Bustamante, Jaycob' }));
    const search = await screen.findByRole('dialog', { name: 'Create Crew Account' });
    expect(within(search).getByText('Search Crew in CMS')).toBeInTheDocument();
    expect(within(search).getByLabelText('Enter last name')).toHaveValue('Bustamante');
    expect(within(search).getByLabelText('Enter first name')).toHaveValue('Jaycob');

    // only the applicant matches the prefilled name; clearing shows every record
    const table = within(search).getByRole('table', { name: 'Crew found in the CMS' });
    expect(within(table).getAllByRole('row')).toHaveLength(2); // header + Jaycob
    await user.click(within(search).getByRole('button', { name: 'Clear' }));
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(4);

    await user.type(within(search).getByLabelText('Enter last name'), 'gatdula');
    await user.click(within(search).getByRole('button', { name: 'Search' }));
    expect(within(table).getByText('Gatdula, Gian')).toBeInTheDocument();
    expect(within(table).queryByText('Bustamante, Jaycob')).not.toBeInTheDocument();

    await user.click(within(search).getByRole('button', { name: 'Link account of Gatdula, Gian' }));
    const details = await screen.findByRole('dialog', { name: 'Account Details' });
    expect(within(details).getByLabelText('Username')).toHaveValue('gian.gatdula');
    expect(within(details).getByLabelText('Password')).toHaveValue('19951121'); // birthday as yyyymmdd
    expect(within(details).getByLabelText('Crew ID no.')).toHaveValue('09988');
    expect(within(details).getByLabelText('Birthday')).toHaveTextContent('Nov 21, 1995');
  });

  it('shows the printable sheet from the details, and Update only says nothing was saved', async () => {
    asTenantAdmin();
    api();
    const { user } = renderApp('/app');

    await user.click(await screen.findByRole('button', { name: 'Bustamante, Jaycob' }));
    await user.click(
      await screen.findByRole('button', { name: 'Link account of Bustamante, Jaycob' }),
    );
    const details = await screen.findByRole('dialog', { name: 'Account Details' });

    await user.click(within(details).getByRole('button', { name: 'Print the account sheet' }));
    const sheet = await screen.findByRole('dialog', { name: 'Crew Account Details' });
    expect(within(sheet).getByText('Name:')).toBeInTheDocument();
    expect(within(sheet).getByText('Jaycob Bustamante')).toBeInTheDocument();
    expect(within(sheet).getByText('jaycob.bustamante')).toBeInTheDocument();
    expect(
      within(sheet).getByText(/birthdate with the format of \(yyyymmdd\)/),
    ).toBeInTheDocument();
    expect(within(sheet).getByText('Appstore')).toBeInTheDocument();
    expect(within(sheet).getByText('Playstore')).toBeInTheDocument();

    await user.click(within(sheet).getByRole('button', { name: 'Back' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Account Details' })).getByRole('button', {
        name: 'Update',
      }),
    );
    expect(await screen.findByText(/updated \(demo: nothing was saved\)/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
