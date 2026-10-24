import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Table';

const meta = (over: Partial<{ current_page: number; total: number }> = {}) => ({
  current_page: 2,
  per_page: 10,
  total: 25,
  last_page: 3,
  ...over,
});

describe('Pagination', () => {
  it('says which rows are shown, which page this is, and moves by one page', async () => {
    const onPage = vi.fn();
    render(<Pagination meta={meta()} onPage={onPage} />);

    expect(screen.getByText('Showing 11-20 of 25')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPage.mock.calls).toEqual([[3], [1]]);
  });

  it('shows on a single page with both buttons off, and not at all without results', () => {
    const { rerender, container } = render(
      <Pagination
        meta={{ ...meta({ total: 4 }), current_page: 1, last_page: 1 }}
        onPage={() => {}}
      />,
    );
    expect(screen.getByText('Showing 1-4 of 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    rerender(<Pagination meta={meta({ total: 0 })} onPage={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a spinner and switches both buttons off while the next page is being fetched', () => {
    render(<Pagination meta={meta()} onPage={() => {}} loading />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });
});
