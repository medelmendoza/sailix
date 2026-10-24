import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pencil } from 'lucide-react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { IconButton, IconLink } from './IconButton';

describe('IconButton', () => {
  it('has the full action as its name, shows the short one as the hover text, and works', async () => {
    const onClick = vi.fn();
    render(
      <IconButton icon={Pencil} label="Edit February allotment" tip="Edit" onClick={onClick} />,
    );

    const button = screen.getByRole('button', { name: 'Edit February allotment' });
    expect(button).toHaveTextContent('Edit'); // the hover text is in the page, hidden from screen readers
    expect(button.querySelector('[aria-hidden="true"]:not(svg)')).toHaveTextContent('Edit');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('can be a link to another page', () => {
    render(
      <MemoryRouter>
        <IconLink
          to="/app/crew/c1"
          icon={Pencil}
          label="See details of Gatdula, Gian"
          tip="See details"
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'See details of Gatdula, Gian' })).toHaveAttribute(
      'href',
      '/app/crew/c1',
    );
  });
});
