import { setupServer } from 'msw/node';

/** Every API call in tests is answered by a handler. An unhandled request fails the test (no real network). */
export const server = setupServer();
