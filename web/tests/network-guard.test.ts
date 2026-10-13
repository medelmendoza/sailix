import axios from 'axios';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * The suite must never reach a real network. A throwaway local listener stands in for "the real world":
 * if an unhandled request were allowed to pass through, it would hit this listener.
 */
describe('network guard', () => {
  it('does not let an unhandled request through to a real listener', async () => {
    let hits = 0;
    const listener = createServer((_req, res) => {
      hits += 1;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end('real network was reached');
    });
    await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve));
    const { port } = listener.address() as AddressInfo;

    try {
      await axios.get(`http://127.0.0.1:${port}/should-never-arrive`).catch(() => undefined);
    } finally {
      await new Promise<void>((resolve) => listener.close(() => resolve()));
    }

    expect(hits).toBe(0);
  });
});
