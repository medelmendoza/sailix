import { render } from '@testing-library/react-native';
import axios from 'axios';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { talaModule, type TalaHost } from '../index';
import { assignment, deckDoc, quizDoc, snapshot } from '../direct/testing/fixtures';

const BASE = 'https://tala.example.test';
const U = '/api/v1/auth/users/tala-user-1';
const T = `${U}/teams/TEAM-1`;

export const jwt = (secondsFromNow = 3600) =>
  `h.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + secondsFromNow }))}.s`;

type Reply = { status: number; data?: unknown; delayMs?: number };

let spy: jest.SpyInstance | null = null;
/** Puts the real axios back (jest.restoreAllMocks would also reset the setup's own mocks). */
export const stopFakeTala = () => spy?.mockRestore();

/** A Tala server in memory: answers by "METHOD /path" and records every request. Unlisted paths are 404. */
export function fakeTala(over: Record<string, Reply> = {}) {
  const routes: Record<string, Reply> = {
    'POST /api/v1/login': { status: 200, data: { accessToken: jwt(), refreshToken: 'r', userId: 'tala-user-1' } },
    [`GET ${U}`]: { status: 200, data: { firstName: 'Maria', lastName: 'Santos', teamDetails: [{ teamCode: 'SECRET', roleName: 'admin' }] } },
    [`GET ${U}/teams`]: { status: 200, data: [{ teamId: 'TEAM-1', teamName: 'Deck crew' }] },
    [`GET ${T}/courses`]: { status: 200, data: [assignment()] },
    [`GET ${T}/courses/C1/sync/A1/data`]: { status: 200, data: snapshot() },
    '/api/v1/auth/users/teams/TEAM-1/up_quizzes/q1': { status: 200, data: quizDoc() },
    '/api/v1/auth/users/teams/TEAM-1/upgraded_cards/c1': { status: 200, data: deckDoc() },
    [`POST ${T}/courses/sync`]: { status: 200, data: {} },
    [`POST ${T}/courses/apply`]: { status: 200, data: {} },
    ...over,
  };
  // GET entries for the two documents above
  routes['GET /api/v1/auth/users/teams/TEAM-1/up_quizzes/q1'] = routes['/api/v1/auth/users/teams/TEAM-1/up_quizzes/q1']!;
  routes['GET /api/v1/auth/users/teams/TEAM-1/upgraded_cards/c1'] = routes['/api/v1/auth/users/teams/TEAM-1/upgraded_cards/c1']!;
  const requests: { method: string; path: string; body: unknown }[] = [];
  spy = jest.spyOn(axios, 'request').mockImplementation(async (cfg) => {
    const path = String(cfg.url).replace(BASE, '');
    const method = String(cfg.method ?? 'GET').toUpperCase();
    requests.push({ method, path, body: cfg.data });
    const reply = routes[`${method} ${path}`] ?? { status: 404 };
    if (reply.delayMs) await new Promise((r) => setTimeout(r, reply.delayMs));
    return { status: reply.status, data: JSON.stringify(reply.data ?? {}) } as never;
  });
  return {
    requests,
    posts: (path: string) => requests.filter((r) => r.method === 'POST' && r.path === path),
    set: (key: string, reply: Reply) => void (routes[key] = reply),
  };
}

export const hostOf = (over: Partial<TalaHost> = {}): TalaHost => ({
  scope: 'org:1:member:2',
  theme: { background: '#F4F8FC', text: '#0F2036', primary: '#1260D8' },
  config: { talaBaseUrl: BASE, progressWrites: true },
  onExit: jest.fn(),
  ...over,
});

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

/** The host app provides the safe area; so do the tests. */
export const renderTala = (host: TalaHost = hostOf()) =>
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <talaModule.Root host={host} />
    </SafeAreaProvider>,
  );
export const paths = { U, T };
