import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';
import { Spinner } from './Layout';
import { SkeletonShell, SkeletonTable } from './Skeleton';
import { StatTile, StatusTabs } from './Admin';

describe('loading placeholders', () => {
  it('the generic placeholder is announced as loading and is made of shimmering blocks', () => {
    const { container } = render(<Spinner label="Loading crew" />);

    expect(screen.getByRole('status', { name: 'Loading crew' })).toBeInTheDocument();
    expect(container.querySelectorAll('.shimmer').length).toBeGreaterThan(2);
    expect(container.querySelector('.animate-spin')).toBeNull(); // no spinning wheel any more
  });

  it('a table placeholder has the frame, the header and the rows, and says what is loading', () => {
    const { container } = render(
      <SkeletonTable columns={3} rows={4} label="Loading organizations" />,
    );

    expect(screen.getByRole('status', { name: 'Loading organizations' })).toBeInTheDocument();
    // header cells + 4 rows of 3 cells (the first cell of a row is an avatar and two lines)
    expect(container.querySelectorAll('.shimmer').length).toBeGreaterThan(3 + 4 * 3);
  });

  it('the console frame placeholder is one announced status, not dozens', () => {
    render(<SkeletonShell />);
    expect(screen.getAllByRole('status')).toHaveLength(2); // the frame, and the table inside it
    expect(screen.getByRole('status', { name: 'Checking your session' })).toBeInTheDocument();
  });

  it('a button that is working shimmers, keeps its label and cannot be pressed again', () => {
    const { container } = render(<Button loading>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('.shimmer-overlay')).not.toBeNull();
    expect(container.querySelector('.animate-spin')).toBeNull();
  });

  it('a figure and a tab count shimmer until they arrive', () => {
    const { container, rerender } = render(
      <StatusTabs
        label="Filter"
        tabs={[{ key: '', label: 'All', count: null }]}
        value=""
        onChange={() => {}}
      />,
    );
    expect(container.querySelectorAll('.shimmer')).toHaveLength(1);
    expect(screen.queryByText('0')).not.toBeInTheDocument();

    rerender(
      <StatusTabs
        label="Filter"
        tabs={[{ key: '', label: 'All', count: 7 }]}
        value=""
        onChange={() => {}}
      />,
    );
    expect(container.querySelectorAll('.shimmer')).toHaveLength(0);
    expect(screen.getByText('7')).toBeInTheDocument();

    const tile = render(<StatTile label="Active" value={3} hint="members can sign in" />);
    expect(tile.container.querySelectorAll('.shimmer')).toHaveLength(0);
  });
});
