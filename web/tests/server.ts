import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/**
 * Every API call in tests is answered by a handler. An unhandled request fails the test (no real network).
 * The one default: the test address names no organization (the shared sign-in), unless a test says otherwise.
 */
export const server = setupServer(
  http.get('http://localhost:8000/api/v1/public/tenant', () =>
    HttpResponse.json(
      {
        type: 'about:blank',
        title: 'Not found',
        status: 404,
        code: 'tenant_not_found',
        detail: 'No organization is configured for this address.',
      },
      { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
    ),
  ),
);
