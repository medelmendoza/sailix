import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { FileDrop, fileSize } from './FileDrop';

function Harness() {
  const [file, setFile] = useState<File | null>(null);
  return <FileDrop file={file} onFile={setFile} accept="application/pdf" hint="A PDF." />;
}

describe('FileDrop', () => {
  it('writes sizes the short way', () => {
    expect(fileSize(10)).toBe('1 KB');
    expect(fileSize(2048)).toBe('2 KB');
    expect(fileSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  it('takes a file, shows it as a card with its size, and lets it be taken back', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    expect(screen.getByText('A PDF.')).toBeInTheDocument();

    const file = new File(['x'.repeat(2048)], 'allotment.pdf', { type: 'application/pdf' });
    await user.upload(container.querySelector('input[type="file"]')!, file);
    expect(screen.getByText('allotment.pdf')).toBeInTheDocument();
    expect(screen.getByText('2 KB')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove the chosen file' }));
    expect(screen.getByText('A PDF.')).toBeInTheDocument();
    expect(screen.queryByText('allotment.pdf')).not.toBeInTheDocument();
  });
});
