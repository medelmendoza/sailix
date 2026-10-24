import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DateField } from './Field';

function Harness({ initial = '', min }: { initial?: string; min?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DateField label="Born" value={value} onChange={setValue} min={min} />
      <output data-testid="value">{value}</output>
    </>
  );
}

describe('DateField', () => {
  it('shows a prompt when empty', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Born')).toHaveTextContent('Select date…');
  });

  it('opens a calendar on the chosen month, picks a day and closes', async () => {
    const user = userEvent.setup();
    render(<Harness initial="1990-05-04" />);
    expect(screen.getByLabelText('Born')).toHaveTextContent('May 4, 1990');

    await user.click(screen.getByLabelText('Born'));
    const calendar = await screen.findByRole('dialog', { name: 'Choose a date' });
    expect(calendar).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'May 4, 1990' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'May 20, 1990' }));
    expect(screen.getByTestId('value')).toHaveTextContent('1990-05-20');
    expect(screen.queryByRole('dialog', { name: 'Choose a date' })).not.toBeInTheDocument();
  });

  it('closes on Escape, jumps by month and year, and clears', async () => {
    const user = userEvent.setup();
    render(<Harness initial="1990-05-04" />);

    await user.click(screen.getByLabelText('Born'));
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('button', { name: 'Jun 1, 1990' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Choose a date' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear date' }));
    expect(screen.getByTestId('value')).toHaveTextContent('');
    expect(screen.getByLabelText('Born')).toHaveTextContent('Select date…');
  });

  it('greys out days before the earliest one', async () => {
    const user = userEvent.setup();
    render(<Harness initial="2030-05-10" min="2030-05-05" />);
    await user.click(screen.getByLabelText('Born'));
    expect(screen.getByRole('button', { name: 'May 4, 2030' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'May 5, 2030' })).toBeEnabled();
  });
});
